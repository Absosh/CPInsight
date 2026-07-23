import React from 'react';

export function ConversationView({ children, composer }) {
  return (
    <section className="ai-conversation-view" aria-label="AI conversation">
      <div className="ai-conversation-scroll">{children}</div>
      {composer ? <footer className="ai-conversation-composer">{composer}</footer> : null}
    </section>
  );
}
