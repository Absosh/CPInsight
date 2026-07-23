import React from 'react';

export function AiWorkspace({ sidebar, main, dock, className = '' }) {
  return (
    <div className={`ai-workspace ${className}`.trim()}>
      {sidebar ? <nav className="ai-sidebar" aria-label="AI workspace navigation">{sidebar}</nav> : null}
      <main className="ai-workspace-main">{main}</main>
      {dock ? <aside className="ai-dock" aria-label="AI details panel">{dock}</aside> : null}
    </div>
  );
}

export function SplitView({ primary, secondary, ratio = '1fr 360px' }) {
  return (
    <div className="ai-split-view" style={{ gridTemplateColumns: ratio }}>
      <section>{primary}</section>
      <aside>{secondary}</aside>
    </div>
  );
}

export function CardGrid({ children }) {
  return <div className="ai-card-grid">{children}</div>;
}
