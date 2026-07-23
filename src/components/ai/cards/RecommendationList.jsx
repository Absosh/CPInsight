import React from 'react';
import { RecommendationCard } from './RecommendationCard.jsx';
import { safeList } from '../base/componentUtils.js';

export function RecommendationList({ recommendations = [] }) {
  return (
    <section className="ai-recommendation-list" aria-label="Recommendations">
      {safeList(recommendations).map((item) => <RecommendationCard key={item.id || item.title || item.recommendation} recommendation={item} />)}
    </section>
  );
}
