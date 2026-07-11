const userRepository = require('../repositories/userRepository');
const platformRepository = require('../repositories/platformRepository');
const { getJson, setJson, delByPattern } = require('../redis/client');
const HttpError = require('../utils/httpError');

async function getProfile(userId) {
  const cacheKey = `profile:${userId}`;
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const profile = await userRepository.getProfile(userId);
  if (!profile) throw new HttpError(404, 'User profile not found');

  const platformAccounts = await platformRepository.listAccounts(userId);
  const payload = {
    user: {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    },
    profile: {
      displayName: profile.display_name,
      timezone: profile.timezone,
      country: profile.country,
      avatarUrl: profile.avatar_url,
      preferences: profile.preferences
    },
    platformAccounts
  };

  await setJson(cacheKey, payload, 600).catch(() => {});
  return payload;
}

async function updateProfile(userId, payload) {
  const profile = await userRepository.updateProfile(userId, payload);
  await delByPattern(`profile:${userId}`).catch(() => {});
  return profile;
}

module.exports = { getProfile, updateProfile };
