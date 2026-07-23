import React from 'react';
import { CoachMessage } from '../base/CoachMessage.jsx';
import { QualityIndicator } from '../feedback/QualityIndicator.jsx';
import { ReasoningPanel } from '../reasoning/ReasoningPanel.jsx';
import { EvidenceCard } from './EvidenceCard.jsx';
import { RecommendationCard } from './RecommendationCard.jsx';
import { safeList } from '../base/componentUtils.js';

export function CoachResponse({ question, response, quality, reasoning, evidence = [], recommendations = [], timestamp }) {
  return (
    <section className="ai-coach-response">
      <CoachMessage question={question} response={response?.summary || response} timestamp={timestamp} metadata={response?.metadata} />
      <QualityIndicator quality={quality} status="validated" />
      <ReasoningPanel reasoning={reasoning} />
      <div className="ai-card-grid">
        {safeList(evidence).map((item) => <EvidenceCard key={item.evidenceId || item.id} evidence={item} />)}
      </div>
      <div className="ai-card-grid">
        {safeList(recommendations).map((item) => <RecommendationCard key={item.id || item.title || item.recommendation} recommendation={item} />)}
      </div>
    </section>
  );
}
