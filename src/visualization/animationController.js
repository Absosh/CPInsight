export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function resolveAnimationState(enabled = true) {
  return Boolean(enabled && !prefersReducedMotion());
}

export function loadMotionRuntime() {
  return import('framer-motion');
}
