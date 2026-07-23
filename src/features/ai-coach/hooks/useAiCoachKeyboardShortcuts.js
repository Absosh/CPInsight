import { useEffect } from 'react';

export function useAiCoachKeyboardShortcuts({ onNewSession, onFocusSearch, onAbort, onToggleLeft, onToggleRight }) {
  useEffect(() => {
    function handleKeyDown(event) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onFocusSearch?.();
      }
      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        onNewSession?.();
      }
      if (event.key === 'Escape') {
        onAbort?.();
      }
      if (modifier && event.key === '[') {
        event.preventDefault();
        onToggleLeft?.();
      }
      if (modifier && event.key === ']') {
        event.preventDefault();
        onToggleRight?.();
      }
    }
    globalThis.addEventListener?.('keydown', handleKeyDown);
    return () => globalThis.removeEventListener?.('keydown', handleKeyDown);
  }, [onNewSession, onFocusSearch, onAbort, onToggleLeft, onToggleRight]);
}
