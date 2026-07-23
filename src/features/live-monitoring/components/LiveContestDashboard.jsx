import React, { useEffect, useReducer } from 'react';
import { ConfidenceBadge, EvidenceExplorer, QualityIndicator } from '../../../components/ai/index.js';
import { createLiveTelemetryClient } from '../realtime/liveTelemetryClient.js';
import { createInitialLiveContestState, liveContestReducer } from '../state/liveContestReducer.js';
import '../styles/live-contest-dashboard.css';

function Metric({ label, value }) {
  return (
    <div className="live-contest-metric">
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  );
}

export function LiveContestDashboard({ websocketUrl = '/realtime', token, userId, contestId }) {
  const [state, dispatch] = useReducer(liveContestReducer, null, createInitialLiveContestState);
  useEffect(() => {
    if (!token) return undefined;
    const client = createLiveTelemetryClient({ url: websocketUrl, token, userId, contestId });
    const off = client.onEvent((event) => dispatch(event));
    client.connect();
    return () => {
      off();
      client.disconnect();
    };
  }, [websocketUrl, token, userId, contestId]);

  return (
    <section className="live-contest-dashboard" aria-label="Live contest monitoring dashboard">
      <header>
        <div>
          <h2>Live Contest</h2>
          <p>{state.connectionStatus}</p>
        </div>
        <ConfidenceBadge value={state.confidence || 0.7} label="Live confidence" animated={state.connectionStatus === 'connected'} />
      </header>
      <div className="live-contest-grid">
        <Metric label="Solved" value={state.solved} />
        <Metric label="Attempts" value={state.attempts} />
        <Metric label="Rank" value={state.rank} />
        <Metric label="Penalty" value={state.penalty} />
      </div>
      <QualityIndicator quality={{ groundingCoverage: 1, citationQuality: 1, overallQualityScore: state.connectionStatus === 'connected' ? 0.9 : 0.4 }} status={state.connectionStatus} />
      <EvidenceExplorer evidence={state.timeline.map((item) => ({
        evidenceId: item.id,
        finding: item.eventType,
        type: 'live_telemetry',
        confidence: 0.8,
        source: 'WebSocket',
        supportingData: item.problemId || 'Contest event'
      }))} />
    </section>
  );
}
