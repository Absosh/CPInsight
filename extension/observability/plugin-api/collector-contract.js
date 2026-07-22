export function validateCollectorContract(collector) {
  const requiredMethods = ['initialize', 'supports', 'collect', 'pause', 'resume', 'destroy'];
  const missing = requiredMethods.filter((method) => typeof collector?.[method] !== 'function');
  if (!collector?.id || typeof collector.id !== 'string') {
    missing.unshift('id');
  }
  if (!collector?.platform || typeof collector.platform !== 'string') {
    missing.unshift('platform');
  }
  if (missing.length > 0) {
    throw new Error(`Invalid observability collector contract: missing ${missing.join(', ')}`);
  }
  return collector;
}
