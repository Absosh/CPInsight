const userRepository = require('../repositories/userRepository');
const platformRepository = require('../repositories/platformRepository');
const { getJson, setJson, delByPattern } = require('../redis/client');
const avatarService = require('./avatarService');
const { listColleges, findCollege } = require('../data/colleges');
const HttpError = require('../utils/httpError');

function serializeCollege(collegeId) {
  return findCollege(collegeId);
}

async function getProfile(userId) {
  const cacheKey = `profile:${userId}`;
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached) {
    const available = await avatarService.avatarExists(cached.profile?.avatarUrl);
    if (available) return cached;
    await userRepository.deleteAvatar(userId);
    await delByPattern(cacheKey).catch(() => {});
  }

  const profile = await userRepository.getProfile(userId);
  if (!profile) throw new HttpError(404, 'User profile not found');
  if (profile.avatar_url && !(await avatarService.avatarExists(profile.avatar_url))) {
    await userRepository.deleteAvatar(userId);
    profile.avatar_url = null;
    profile.avatar_thumbnail = null;
    profile.avatar_updated_at = new Date();
  }

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
      collegeId: profile.college_id,
      college: serializeCollege(profile.college_id),
      avatarUrl: profile.avatar_url,
      avatarThumbnail: profile.avatar_thumbnail,
      avatarUpdatedAt: profile.avatar_updated_at,
      preferences: profile.preferences
    },
    platformAccounts
  };

  await setJson(cacheKey, payload, 600).catch(() => {});
  return payload;
}

async function updateProfile(userId, payload) {
  if (payload.collegeId && !findCollege(payload.collegeId)) {
    throw new HttpError(400, 'Selected college is not supported');
  }

  await userRepository.updateProfile(userId, payload);
  await delByPattern(`profile:${userId}`).catch(() => {});
  return getProfile(userId);
}

async function searchColleges(query) {
  return { colleges: listColleges(query) };
}

async function uploadAvatar(userId, imageData) {
  const avatar = await avatarService.storeAvatar(userId, imageData);
  await userRepository.updateAvatar(userId, avatar);
  await delByPattern(`profile:${userId}`).catch(() => {});
  return getProfile(userId);
}

async function deleteAvatar(userId) {
  await avatarService.deleteAvatarFiles(userId);
  await userRepository.deleteAvatar(userId);
  await delByPattern(`profile:${userId}`).catch(() => {});
  return getProfile(userId);
}

module.exports = {
  getProfile,
  updateProfile,
  searchColleges,
  uploadAvatar,
  deleteAvatar
};
