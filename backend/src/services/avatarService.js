const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const HttpError = require('../utils/httpError');

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
const avatarsDir = path.join(uploadsRoot, 'avatars');
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 2048;

const mimeTypes = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

function parseDataUrl(imageData) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageData || '');
  if (!match) {
    throw new HttpError(400, 'Avatar must be a PNG, JPEG, or WEBP image');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

function readPngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;

    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readWebpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
}

function readDimensions(buffer, mimeType) {
  if (mimeType === 'image/png') return readPngDimensions(buffer);
  if (mimeType === 'image/jpeg') return readJpegDimensions(buffer);
  if (mimeType === 'image/webp') return readWebpDimensions(buffer);
  return null;
}

function validateAvatar(buffer, mimeType) {
  if (!mimeTypes[mimeType]) {
    throw new HttpError(400, 'Avatar must be a PNG, JPEG, or WEBP image');
  }

  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    throw new HttpError(400, 'Avatar must be smaller than 2MB');
  }

  const dimensions = readDimensions(buffer, mimeType);
  if (!dimensions) {
    throw new HttpError(400, 'Avatar image could not be validated');
  }

  if (
    dimensions.width < MIN_DIMENSION ||
    dimensions.height < MIN_DIMENSION ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION
  ) {
    throw new HttpError(400, `Avatar dimensions must be between ${MIN_DIMENSION}px and ${MAX_DIMENSION}px`);
  }
}

async function deleteAvatarFiles(userId) {
  await fs.mkdir(avatarsDir, { recursive: true });
  const files = await fs.readdir(avatarsDir).catch(() => []);
  await Promise.all(
    files
      .filter((file) => file.startsWith(`${userId}-`))
      .map((file) => fs.unlink(path.join(avatarsDir, file)).catch(() => {}))
  );
}

async function avatarExists(avatarUrl) {
  if (!avatarUrl) return true;
  let pathname;
  try {
    pathname = new URL(avatarUrl, env.apiBaseUrl).pathname;
  } catch {
    return false;
  }
  if (!pathname.startsWith('/uploads/avatars/')) return true;
  const filename = path.basename(pathname);
  if (!filename || filename !== pathname.split('/').at(-1)) return false;
  try {
    await fs.access(path.join(avatarsDir, filename));
    return true;
  } catch {
    return false;
  }
}

async function storeAvatar(userId, imageData) {
  const { mimeType, buffer } = parseDataUrl(imageData);
  validateAvatar(buffer, mimeType);

  await fs.mkdir(avatarsDir, { recursive: true });
  await deleteAvatarFiles(userId);

  const extension = mimeTypes[mimeType];
  const fingerprint = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const filename = `${userId}-${Date.now()}-${fingerprint}.${extension}`;
  const filePath = path.join(avatarsDir, filename);

  await fs.writeFile(filePath, buffer, { flag: 'wx' });

  const publicPath = `/uploads/avatars/${filename}`;
  const baseUrl = env.apiBaseUrl.replace(/\/$/, '');
  return {
    avatarUrl: `${baseUrl}${publicPath}`,
    avatarThumbnail: `${baseUrl}${publicPath}`
  };
}

module.exports = {
  storeAvatar,
  deleteAvatarFiles,
  avatarExists
};
