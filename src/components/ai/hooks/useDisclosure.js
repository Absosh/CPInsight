import { useCallback, useState } from 'react';

export function useDisclosure(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  return {
    open,
    setOpen,
    toggle: useCallback(() => setOpen((value) => !value), []),
    close: useCallback(() => setOpen(false), []),
    openPanel: useCallback(() => setOpen(true), [])
  };
}
