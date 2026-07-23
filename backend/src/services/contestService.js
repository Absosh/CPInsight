const axios = require("axios");
const { getJson, setJson } = require("../redis/client");

const CACHE_KEY = "calendar:contests:v2";
const CACHE_TTL = 60 * 15;
const UPSTREAM_TIMEOUT_MS = 6000;

const LEETCODE_CONTEST_QUERY = `
query {
  allContests {
    title
    titleSlug
    startTime
    duration
  }
}
`;

function sortByTime(events) {
  return events.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

async function withTimeout(label, work, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  let timer = null;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} contest source timed out`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getCodeforcesContests() {
  const { data } = await axios.get("https://codeforces.com/api/contest.list", {
    timeout: UPSTREAM_TIMEOUT_MS
  });

  if (data.status !== "OK") {
    throw new Error("Failed to fetch Codeforces contests.");
  }

  return data.result
    .filter((contest) => !contest.name.toLowerCase().includes("stream"))
    .map((contest) => ({
      id: `cf-${contest.id}`,
      platform: "codeforces",
      title: contest.name,
      startTimeSeconds: contest.startTimeSeconds,
      durationSeconds: contest.durationSeconds,
      phase: contest.phase,
      url: `https://codeforces.com/contest/${contest.id}`
    }));
}

async function getLeetCodeContests() {
  const { data } = await axios.post(
    "https://leetcode.com/graphql",
    { query: LEETCODE_CONTEST_QUERY },
    {
      timeout: UPSTREAM_TIMEOUT_MS,
      headers: { "content-type": "application/json" }
    }
  );

  const contests = data?.data?.allContests || [];

  return contests.map((contest) => ({
    id: `lc-${contest.titleSlug}`,
    platform: "leetcode",
    title: contest.title,
    startTimeSeconds: Number(contest.startTime),
    durationSeconds: Number(contest.duration),
    phase: Number(contest.startTime) * 1000 > Date.now() ? "BEFORE" : "FINISHED",
    url: `https://leetcode.com/contest/${contest.titleSlug}/`
  }));
}

async function getCodeChefContests() {
  const { data } = await axios.get(
    "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all",
    {
      timeout: UPSTREAM_TIMEOUT_MS,
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 CPInsight Calendar"
      }
    }
  );

  if (data?.status !== "success") {
    throw new Error("Failed to fetch CodeChef contests.");
  }

  const formatContest = (contest, phase) => ({
    id: `cc-${contest.contest_code}`,
    platform: "codechef",
    title: contest.contest_name,
    startTimeSeconds: Math.floor(new Date(contest.contest_start_date_iso).getTime() / 1000),
    durationSeconds: Number.parseInt(contest.contest_duration, 10) * 60,
    phase,
    url: `https://www.codechef.com/${contest.contest_code}`
  });

  return [
    ...(data.present_contests || []).map((contest) => formatContest(contest, "CODING")),
    ...(data.future_contests || []).map((contest) => formatContest(contest, "BEFORE")),
    ...(data.past_contests || []).map((contest) => formatContest(contest, "FINISHED"))
  ];
}

async function getCombinedContestCalendar() {
  const cached = await getJson(CACHE_KEY).catch(() => null);

  if (cached) {
    return cached;
  }

  const settled = await Promise.allSettled([
    withTimeout("Codeforces", getCodeforcesContests),
    withTimeout("LeetCode", getLeetCodeContests),
    withTimeout("CodeChef", getCodeChefContests)
  ]);

  let contests = [];

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      contests.push(...result.value);
    } else {
      console.warn("[ContestService]", result.reason.message);
    }
  });

  contests = sortByTime(contests);
  await setJson(CACHE_KEY, contests, CACHE_TTL).catch(() => {});
  return contests;
}

module.exports = {
  getCodeforcesContests,
  getLeetCodeContests,
  getCodeChefContests,
  getCombinedContestCalendar
};
