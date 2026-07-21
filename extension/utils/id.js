export function createId(prefix = 'msg') {
  const random = crypto.getRandomValues(new Uint32Array(2)).join('');
  return `${prefix}_${Date.now()}_${random}`;
}
