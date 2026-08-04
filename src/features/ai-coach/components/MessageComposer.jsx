import React, { useEffect, useState } from 'react';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

export function MessageComposer() {
  const { state, submitQuestion, abortGeneration, draftStorageKey } = useAiCoachWorkspace();
  const [question, setQuestion] = useState(() => globalThis.localStorage?.getItem(draftStorageKey) || '');
  const busy = state.streaming.active;

  useEffect(() => {
    globalThis.localStorage?.setItem(draftStorageKey, question);
  }, [draftStorageKey, question]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setQuestion('');
    globalThis.localStorage?.removeItem(draftStorageKey);
    await submitQuestion(trimmed);
  }

  return (
    <form className="coach-composer" onSubmit={handleSubmit}>
      <label>
        <span>Ask CPInsight</span>
        <div className="coach-input-shell">
          <button className="coach-attach-button" type="button" aria-label="Attachment placeholder" disabled>+</button>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask why your rating changed, what to practice, or how a contest went."
            rows={3}
            disabled={busy}
          />
        </div>
      </label>
      <div>
        <span className="coach-shortcut-hint">Enter to send after typing</span>
        <button type="submit" disabled={busy || !question.trim()}>{busy ? 'Generating' : 'Ask Coach'}</button>
        <button type="button" disabled={!busy} onClick={abortGeneration}>Abort</button>
      </div>
    </form>
  );
}
