export function observeElementResize(element, callback) {
  if (!element || typeof ResizeObserver === 'undefined') return () => {};
  const observer = new ResizeObserver(callback);
  observer.observe(element);
  return () => observer.disconnect();
}
