const crypto = require('crypto');

function acceptKey(key) {
  return crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
}

function encodeFrame(payload, opcode = 0x1) {
  const body = Buffer.from(payload);
  const header = [];
  header.push(0x80 | opcode);
  if (body.length < 126) {
    header.push(body.length);
  } else if (body.length < 65536) {
    header.push(126, (body.length >> 8) & 0xff, body.length & 0xff);
  } else {
    header.push(127, 0, 0, 0, 0);
    const length = body.length;
    header.push((length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff);
  }
  return Buffer.concat([Buffer.from(header), body]);
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }
    const maskLength = masked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + length;
    if (frameEnd > buffer.length) break;
    let payload = buffer.subarray(offset + headerLength + maskLength, frameEnd);
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }
    frames.push({ opcode, payload });
    offset = frameEnd;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

module.exports = { acceptKey, encodeFrame, decodeFrames };
