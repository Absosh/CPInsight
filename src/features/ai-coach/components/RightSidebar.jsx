import React, { useEffect, useState } from 'react';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

function Metric({ label, value }) {
  return (
    <div className="coach-context-metric">
      <span>{label}</span>
      <strong>{value ?? 'Not available'}</strong>
    </div>
  );
}

function TopicList({ title, topics }) {
  const items = (topics || []).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="coach-topic-section">
      <h3>{title}</h3>
      <ul>{items.map((topic) => <li key={topic.name || topic}>{topic.name || topic}</li>)}</ul>
    </section>
  );
}

const STUDY_NAV_SECTIONS = [
  { section: 'tracker', label: 'Tracker', problemTopic: 'Daily Practice' },
  { section: 'recommended', label: 'Recommended', problemTopic: "Today's Practice" },
  { section: 'rating', label: 'Rating', problemTopic: 'Target Rating' },
  { section: 'topics', label: 'Topics', problemTopic: 'Priority Topics' }
];

function emitStudySection(section) {
  window.dispatchEvent(new CustomEvent('cpinsight:studySectionSelected', { detail: { section } }));
}

function openProblemBankFromNav(item, insights) {
  const topic = item.section === 'topics' || item.section === 'recommended'
    ? insights.weakestTopics?.[0]?.name
    : item.problemTopic;
  window.dispatchEvent(new CustomEvent('cpinsight:openProblemBank', {
    detail: {
      type: 'study-navigation',
      label: item.label,
      topic: topic || item.problemTopic,
      reason: ['Opened from Study Navigation.']
    }
  }));
}

function StudyNavigationPanel({ insights }) {
  const [activeSection, setActiveSection] = useState('tracker');

  useEffect(() => {
    function handleSectionSelected(event) {
      if (event.detail?.section) setActiveSection(event.detail.section);
    }
    window.addEventListener('cpinsight:studySectionSelected', handleSectionSelected);
    return () => window.removeEventListener('cpinsight:studySectionSelected', handleSectionSelected);
  }, []);

  function selectSection(section) {
    setActiveSection(section);
    emitStudySection(section);
  }

  return (
    <aside className="coach-right-sidebar study-navigation-sidebar" aria-label="Study Navigation">
      <nav className="study-nav-card study-nav-minimal" aria-label="Study planner sections">
        {STUDY_NAV_SECTIONS.map((item) => (
          <button
            key={item.section}
            type="button"
            className="study-nav-row"
            data-active={activeSection === item.section}
            onClick={() => selectSection(item.section)}
          >
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>
      <button
        className="ai-button ai-focusable study-nav-problem-bank"
        type="button"
        onClick={() => openProblemBankFromNav(STUDY_NAV_SECTIONS.find((item) => item.section === activeSection) || STUDY_NAV_SECTIONS[0], insights)}
      >
        Open Problem Bank
      </button>
    </aside>
  );
}

export function RightSidebar() {
  const { state } = useAiCoachWorkspace();
  const insights = state.contextualInsights;
  if (state.activeView === 'studyPlans') return <StudyNavigationPanel insights={insights} />;
  return (
    <aside className="coach-right-sidebar coach-right-sidebar-minimal" aria-label="Contextual AI insights">
      <section className="coach-context-card">
        <h2>Context</h2>
        <Metric label="Current Rating" value={insights.currentRating} />
        <Metric label="Target Rating" value={insights.targetRating} />
        <Metric label="Current Goal" value={insights.currentGoal} />
        <Metric label="Learning Velocity" value={insights.learningVelocity} />
      </section>
      <section className="coach-topic-grid">
        <TopicList title="Weakest Topics" topics={insights.weakestTopics} />
        <TopicList title="Strongest Topics" topics={insights.strongestTopics} />
      </section>
    </aside>
  );
}
