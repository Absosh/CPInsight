import React from 'react';
import { ReasoningPanel } from '../reasoning/ReasoningPanel.jsx';
import { EvidenceExplorer } from './EvidenceExplorer.jsx';
import { RecommendationList } from './RecommendationList.jsx';

export function ContestReview({ review = {} }) {
  return (
    <section className="ai-contest-review">
      <header className="ai-section-header">
        <h2>{review.title || 'Contest Review'}</h2>
        <p>{review.summary || 'Evidence-backed contest analysis'}</p>
      </header>
      <ReasoningPanel reasoning={review.reasoning} />
      <EvidenceExplorer evidence={review.evidence} sources={review.sources} />
      <RecommendationList recommendations={review.recommendations} />
    </section>
  );
}
