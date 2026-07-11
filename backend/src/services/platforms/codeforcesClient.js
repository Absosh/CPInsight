const axios = require('axios');
const env = require('../../config/env');
const { getJson, setJson } = require('../../redis/client');

const client = axios.create({
  baseURL: env.platforms.codeforcesApiBase,
  timeout: 10000
});

async function cachedGet(cacheKey, path, params, ttlSeconds) {
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const { data } = await client.get(path, { params });
  if (data.status !== 'OK') {
    throw new Error(data.comment || 'Codeforces API returned an error');
  }
  await setJson(cacheKey, data.result, ttlSeconds).catch(() => {});
  return data.result;
}

async function getUserInfo(handle) {
  const result = await cachedGet(
    `upstream:codeforces:user.info:${handle.toLowerCase()}`,
    '/user.info',
    { handles: handle },
    600
  );
  return result[0] || null;
}

async function getUserRating(handle) {
  return cachedGet(
    `upstream:codeforces:user.rating:${handle.toLowerCase()}`,
    '/user.rating',
    { handle },
    1800
  );
}

async function getUserSubmissions(handle, count = 1000) {
  return cachedGet(
    `upstream:codeforces:user.status:${handle.toLowerCase()}:${count}`,
    '/user.status',
    { handle, from: 1, count },
    300
  );
}

module.exports = { getUserInfo, getUserRating, getUserSubmissions };
