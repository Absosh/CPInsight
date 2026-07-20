console.log("=== INSIDE CONTEST SERVICE: FILE IS LOADING ===");
const axios = require("axios");
const { getJson, setJson } = require("../redis/client");

const CACHE_KEY = "calendar:contests:v2";
const CACHE_TTL = 60 * 15; // 15 minutes

// -----------------------------
// GraphQL Query
// -----------------------------

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

// -----------------------------
// Helpers
// -----------------------------

function sortByTime(events) {
  return events.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

// -----------------------------
// Codeforces
// -----------------------------

async function getCodeforcesContests() {
  const { data } = await axios.get("https://codeforces.com/api/contest.list", {
    timeout: 10000
  });

  if (data.status !== "OK") {
    throw new Error("Failed to fetch Codeforces contests.");
  }

  return data.result
    .filter(c => !c.name.toLowerCase().includes("stream"))
    .map(c => ({
      id: `cf-${c.id}`,
      platform: "codeforces",
      title: c.name,
      startTimeSeconds: c.startTimeSeconds,
      durationSeconds: c.durationSeconds,
      phase: c.phase,
      url: `https://codeforces.com/contest/${c.id}`
    }));
}

// -----------------------------
// LeetCode
// -----------------------------

async function getLeetCodeContests() {
  const { data } = await axios.post(
    "https://leetcode.com/graphql",
    {
      query: LEETCODE_CONTEST_QUERY
    },
    {
      timeout: 10000,
      headers: {
        "content-type": "application/json"
      }
    }
  );

  const contests = data?.data?.allContests || [];

  return contests.map(c => ({
    id: `lc-${c.titleSlug}`,
    platform: "leetcode",
    title: c.title,
    startTimeSeconds: Number(c.startTime),
    durationSeconds: Number(c.duration),
    phase: Number(c.startTime) * 1000 > Date.now() ? "BEFORE" : "FINISHED",
    url: `https://leetcode.com/contest/${c.titleSlug}/`
  }));
}

// -----------------------------
// CodeChef
// -----------------------------

async function getCodeChefContests() {
  const { data } = await axios.get(
    "https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all",
    {
      timeout: 10000,
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 CPInsight Calendar"
      }
    }
  );

  if (data?.status !== "success") {
    throw new Error("Failed to fetch CodeChef contests.");
  }

  const { present_contests, future_contests, past_contests } = data;

  const formatContest = (contest, phase) => {
    return {
      id: `cc-${contest.contest_code}`,
      platform: "codechef",
      title: contest.contest_name,
      startTimeSeconds: Math.floor(new Date(contest.contest_start_date_iso).getTime() / 1000),
      durationSeconds: Number.parseInt(contest.contest_duration, 10) * 60,
      phase: phase,
      url: `https://www.codechef.com/${contest.contest_code}`
    };
  };

  const active = (present_contests || []).map(c => formatContest(c, "CODING"));
  const upcoming = (future_contests || []).map(c => formatContest(c, "BEFORE"));
  const past = (past_contests || []).map(c => formatContest(c, "FINISHED"));

  return [...active, ...upcoming, ...past];
}

// -----------------------------
// Combined Calendar
// -----------------------------

async function getCombinedContestCalendar() {
  const cached = await getJson(CACHE_KEY);

  if (cached) {
    return cached;
  }

  const settled = await Promise.allSettled([
    getCodeforcesContests(),
    getLeetCodeContests(),
    getCodeChefContests()
  ]);

  let contests = [];

  settled.forEach(result => {
    if (result.status === "fulfilled") {
      contests.push(...result.value);
    } else {
      console.error("[ContestService]", result.reason.message);
    }
  });

  contests = sortByTime(contests);

  await setJson(CACHE_KEY, contests, CACHE_TTL);

  return contests;
}

module.exports = {
  getCodeforcesContests,
  getLeetCodeContests,
  getCodeChefContests,
  getCombinedContestCalendar
};
