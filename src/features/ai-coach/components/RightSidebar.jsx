import React, { useEffect, useMemo, useState } from 'react';
import { BehaviorOverview, ReflectionFeed, RecommendationList } from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

function Metric({ label, value }) {
  return (
    <div className="coach-context-metric">
      <i aria-hidden="true" />
      <span>{label}</span>
      <strong>{value ?? 'Not available'}</strong>
    </div>
  );
}

const STUDY_NAV_SECTIONS = [
  {
    group: 'Tracker',
    items: [
      ['study-daily', 'Daily Goals', 'Today task sequence'],
      ['study-weekly', 'Weekly Goals', 'Seven-day roadmap'],
      ['study-time', 'Estimated Study Time', 'Time allocation'],
      ['study-progress', 'Progress Tracking', 'Completion and consistency']
    ]
  },
  {
    group: 'Recommended',
    items: [
      ['study-today', "Today's Problems", 'Primary focus bank'],
      ['study-recommended', 'Weekly Problems', 'Practice windows'],
      ['study-recommended', 'Stretch Problems', 'Higher ROI practice']
    ]
  },
  {
    group: 'Rating',
    items: [
      ['study-target', 'Target Rating', 'Selected target'],
      ['study-target', 'Skill Gap', 'Required mastery'],
      ['study-target', 'Target Rating Roadmap', 'Milestones']
    ]
  },
  {
    group: 'Topics',
    items: [
      ['study-topics', 'Priority Topics', 'ROI ranking'],
      ['study-topics', 'Weak Topics', 'Highest expected return'],
      ['study-target', 'Recent Improvements', 'Strengths and gaps']
    ]
  }
];

function openProblemBankFromNav(label, insights) {
  const topic = label.includes('Stretch') ? insights.weakestTopics?.[1]?.name : insights.weakestTopics?.[0]?.name;
  window.dispatchEvent(new CustomEvent('cpinsight:openProblemBank', {
    detail: {
      type: 'study-navigation',
      label,
      topic: topic || label,
      reason: ['Opened from Study Navigation.']
    }
  }));
}

function StudyNavigationPanel({ insights }) {
  const [activeSection, setActiveSection] = useState('study-today');
  const sectionIds = useMemo(() => [...new Set(STUDY_NAV_SECTIONS.flatMap((section) => section.items.map(([id]) => id)))], []);

  useEffect(() => {
    const nodes = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length || !globalThis.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible?.target?.id) setActiveSection(visible.target.id);
    }, { root: null, rootMargin: '-20% 0px -55% 0px', threshold: 0.01 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sectionIds]);

  function scrollToSection(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <aside className="coach-right-sidebar study-navigation-sidebar" aria-label="Study Navigation">
      <section className="coach-context-card study-navigation-overview">
        <h2><span aria-hidden="true">SP</span> Study Navigation</h2>
        <Metric label="Daily Goals" value={insights.todaysRecommendations?.length || 0} />
        <Metric label="Weekly Goals" value={insights.weakestTopics?.length || 0} />
        <Metric label="Target Rating" value={insights.targetRating} />
      </section>
      {STUDY_NAV_SECTIONS.map((section) => (
        <section key={section.group} className="study-nav-card">
          <h3>{section.group}</h3>
          <div>
            {section.items.map(([id, label, subtitle]) => (
              <button
                key={`${section.group}-${label}`}
                type="button"
                className="study-nav-row"
                data-active={activeSection === id}
                onClick={() => scrollToSection(id)}
              >
                <span>
                  <strong>{label}</strong>
                  <small>{subtitle}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <button className="ai-button ai-focusable study-nav-problem-bank" type="button" onClick={() => openProblemBankFromNav(section.group, insights)}>
            Open {section.group} Problem Bank
          </button>
        </section>
      ))}
    </aside>
  );
}

export function RightSidebar() {
  const { state } = useAiCoachWorkspace();
  const insights = state.contextualInsights;
  if (state.activeView === 'studyPlans') return <StudyNavigationPanel insights={insights} />;
  return (
    <aside className="coach-right-sidebar" aria-label="Contextual AI insights">
      <section className="coach-context-card">
        <h2><span aria-hidden="true">CX</span> Context</h2>
        <Metric label="Current Rating" value={insights.currentRating} />
        <Metric label="Target Rating" value={insights.targetRating} />
        <Metric label="Current Goal" value={insights.currentGoal} />
        <Metric label="Learning Velocity" value={insights.learningVelocity} />
      </section>
      <BehaviorOverview profile={{ confidence: 0.74, window: 'Behavior summary', behaviors: insights.behaviorSummary }} />
      <section className="coach-topic-grid">
        <h3>Weakest Topics</h3>
        <ul>{(insights.weakestTopics || []).map((topic) => <li key={topic.name || topic}>{topic.name || topic}</li>)}</ul>
        <h3>Strongest Topics</h3>
        <ul>{(insights.strongestTopics || []).map((topic) => <li key={topic.name || topic}>{topic.name || topic}</li>)}</ul>
      </section>
      <RecommendationList recommendations={insights.todaysRecommendations} />
      <ReflectionFeed reflections={insights.recentReflections} />
    </aside>
  );
}
