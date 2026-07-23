import React from 'react';
import { cx, stateLabel } from './componentUtils.js';

export function StateShell({ state = 'success', title, message, onRetry, children, className }) {
  if (state === 'success' || state === 'partial' || state === 'streaming') {
    return <div className={cx('ai-state-shell', className)} data-state={state}>{children}</div>;
  }

  if (state === 'loading') {
    return (
      <div className={cx('ai-state-shell ai-card', className)} data-state="loading" aria-busy="true">
        <div className="ai-skeleton" />
        <div className="ai-skeleton" />
        <div className="ai-skeleton" />
      </div>
    );
  }

  return (
    <section className={cx('ai-state-shell ai-card', className)} data-state={state} aria-live="polite">
      <strong>{title || stateLabel(state)}</strong>
      {message ? <p>{message}</p> : null}
      {onRetry ? <button className="ai-button ai-focusable" type="button" onClick={onRetry}>Retry</button> : null}
    </section>
  );
}
