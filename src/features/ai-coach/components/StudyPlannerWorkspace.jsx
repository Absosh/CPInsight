import React, { useEffect, useMemo, useState } from 'react';
import {
  BehaviorChip,
  ConfidenceBadge,
  ProgressMilestone,
  RecommendationCard
} from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { buildProblemBank, buildStudyPlanner, refreshProblemBankStatuses } from '../utils/studyPlanner.js';

const TARGET_OPTIONS = [1200, 1400, 1600, 1800, 1900, 2000, 2100];

function StudyMetric({ label, value }) {
  return (
    <div className="study-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ value, label }) {
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="study-progress-line" aria-label={`${label}: ${progress}%`}>
      <div>
        <span>{label}</span>
        <strong>{progress}%</strong>
      </div>
      <div className="ai-progress-track"><span style={{ inlineSize: `${progress}%` }} /></div>
    </div>
  );
}

function activateOnKeyboard(event, callback) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  callback();
}

function Section({ id, title, subtitle, children, className = '' }) {
  return (
    <section id={id} className={`study-section ai-card ${className}`.trim()}>
      <header className="study-section-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function TodayFocus({ focus, onQuickStart, onOpenProblemBank }) {
  return (
    <section
      id="study-today"
      className="study-focus-card ai-card study-clickable"
      role="button"
      tabIndex={0}
      aria-label={`Open problem bank for ${focus.primaryWeakTopic}`}
      onClick={onOpenProblemBank}
      onKeyDown={(event) => activateOnKeyboard(event, onOpenProblemBank)}
    >
      <div>
        <p className="study-eyebrow">Today's Focus</p>
        <h2>{focus.goal}</h2>
        <p>{focus.why?.[0] || 'Selected from existing analytics and review evidence.'}</p>
      </div>
      <div className="study-focus-meta">
        <StudyMetric label="Primary Weak Topic" value={focus.primaryWeakTopic} />
        <StudyMetric label="Estimated Time" value={focus.estimatedCompletionTime} />
        <ConfidenceBadge value={focus.confidence} />
      </div>
      <button className="ai-button ai-focusable" type="button" onClick={(event) => { event.stopPropagation(); onQuickStart(); }}>Quick Start</button>
    </section>
  );
}

function DailyPlan({ tasks, actions, onOpenProblemBank }) {
  return (
    <Section id="study-daily" title="Daily Study Plan" subtitle="A focused sequence assembled from current priorities.">
      <div className="study-task-list">
        {tasks.map((task) => {
          const key = `${task.title}-${task.topic}`;
          const completed = actions[key]?.action === 'completed';
          return (
            <article
              key={key}
              className="study-task-card study-clickable"
              data-completed={completed}
              role="button"
              tabIndex={0}
              aria-label={`Open problem bank for ${task.topic}`}
              onClick={() => onOpenProblemBank({ type: 'daily-task', label: task.title, topic: task.topic, difficulty: task.difficulty, estimatedTime: task.duration })}
              onKeyDown={(event) => activateOnKeyboard(event, () => onOpenProblemBank({ type: 'daily-task', label: task.title, topic: task.topic, difficulty: task.difficulty, estimatedTime: task.duration }))}
            >
              <div>
                <h3>{task.title}</h3>
                <p>{task.topic}</p>
              </div>
              <dl>
                <dt>Duration</dt><dd>{task.duration}</dd>
                <dt>Difficulty</dt><dd>{task.difficulty}</dd>
                <dt>Priority</dt><dd>{task.priority}</dd>
              </dl>
              <button className="ai-button ai-focusable" type="button" onClick={(event) => { event.stopPropagation(); onOpenProblemBank({ type: 'daily-task', label: task.title, topic: task.topic, difficulty: task.difficulty, estimatedTime: task.duration }); }}>Problem Bank</button>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

function WeeklyRoadmap({ days, onOpenProblemBank }) {
  return (
    <Section id="study-weekly" title="Weekly Roadmap" subtitle="Expandable daily focus blocks for the selected rating target.">
      <div className="study-week-grid">
        {days.map((day) => (
          <details
            key={day.day}
            className="study-day-card study-clickable"
            onClick={(event) => {
              if (event.target.tagName.toLowerCase() === 'summary') return;
              onOpenProblemBank({ type: 'weekly-roadmap', label: day.day, topic: day.focusTopic, estimatedTime: day.estimatedTime, confidence: day.confidence });
            }}
          >
            <summary>
              <span>{day.day}</span>
              <strong>{day.focusTopic}</strong>
            </summary>
            <dl>
              <dt>Target problems</dt><dd>{day.targetProblems}</dd>
              <dt>Estimated time</dt><dd>{day.estimatedTime}</dd>
              <dt>Goal</dt><dd>{day.goal}</dd>
            </dl>
            <ProgressBar label="Completion" value={day.completion} />
            <button className="ai-button ai-focusable" type="button" onClick={() => onOpenProblemBank({ type: 'weekly-roadmap', label: day.day, topic: day.focusTopic, estimatedTime: day.estimatedTime, confidence: day.confidence })}>Problem Bank</button>
          </details>
        ))}
      </div>
    </Section>
  );
}

function TopicPriorities({ topics, onOpenProblemBank }) {
  return (
    <Section id="study-topics" title="Topic Priorities" subtitle="Ranked by dynamic ROI from analytics, review evidence, reflections, and target rating needs." className="study-section-wide">
      <div className="study-topic-priority-list">
        {topics.map((topic, index) => (
          <article
            key={topic.topic}
            className="study-topic-card study-clickable"
            role="button"
            tabIndex={0}
            aria-label={`Open problem bank for ${topic.topic}`}
            onClick={() => onOpenProblemBank({ type: 'topic-priority', label: topic.topic, topic: topic.topic, difficulty: topic.difficulty, confidence: topic.confidence, reason: topic.reason, roi: topic.roi })}
            onKeyDown={(event) => activateOnKeyboard(event, () => onOpenProblemBank({ type: 'topic-priority', label: topic.topic, topic: topic.topic, difficulty: topic.difficulty, confidence: topic.confidence, reason: topic.reason, roi: topic.roi }))}
          >
            <div className="study-topic-rank">#{index + 1}</div>
            <div>
              <h3>{topic.topic}</h3>
              <p>{topic.reason[0]}</p>
              <ul>
                {topic.reason.slice(1, 4).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
            <dl>
              <dt>ROI</dt><dd>{topic.roi}%</dd>
              <dt>Mastery</dt><dd>{Math.round(topic.mastery)}%</dd>
              <dt>Hours</dt><dd>{topic.estimatedHours}</dd>
              <dt>Importance</dt><dd>{topic.importance}</dd>
              <dt>Trend</dt><dd>{topic.trend}</dd>
            </dl>
            <ConfidenceBadge value={topic.confidence} />
          </article>
        ))}
      </div>
    </Section>
  );
}

function RecommendedProblems({ groups, onToggleComplete, onOpenProblemBank }) {
  const labels = [
    ['today', "Today's Practice"],
    ['week', 'This Week'],
    ['stretch', 'Stretch Goal']
  ];
  return (
    <Section id="study-recommended" title="Recommended Problems" subtitle="Existing recommendations grouped into actionable practice windows." className="study-section-wide">
      <div className="study-recommendation-groups">
        {labels.map(([key, label]) => (
          <div key={key}>
            <h3>{label}</h3>
            {(groups[key] || []).map((recommendation) => (
              <div
                key={recommendation.id}
                className="study-recommendation-click-target"
                role="button"
                tabIndex={0}
                aria-label={`Open problem bank for ${recommendation.topic}`}
                onClick={(event) => {
                  if (event.target.closest('button')) return;
                  onOpenProblemBank({ type: 'recommendation', label: recommendation.title, topic: recommendation.topic, difficulty: recommendation.difficulty, estimatedTime: recommendation.estimatedTime, confidence: recommendation.confidence, reason: recommendation.evidence });
                }}
                onKeyDown={(event) => activateOnKeyboard(event, () => onOpenProblemBank({ type: 'recommendation', label: recommendation.title, topic: recommendation.topic, difficulty: recommendation.difficulty, estimatedTime: recommendation.estimatedTime, confidence: recommendation.confidence, reason: recommendation.evidence }))}
              >
                <RecommendationCard recommendation={recommendation} onToggleComplete={onToggleComplete} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

function StudyTime({ time }) {
  return (
    <Section id="study-time" title="Estimated Study Time" subtitle="Time budget by day, week, topic, and difficulty.">
      <div className="study-time-grid">
        <StudyMetric label="Today" value={`${time.todayMinutes} min`} />
        <StudyMetric label="This Week" value={`${Math.round(time.weekMinutes / 60)} hr`} />
        {time.perTopic.map((topic) => <StudyMetric key={topic.topic} label={topic.topic} value={`${topic.hours} hr`} />)}
      </div>
      <div className="study-difficulty-bars">
        {time.perDifficulty.map((item) => <ProgressBar key={item.difficulty} label={item.difficulty} value={Math.round((item.minutes / Math.max(1, time.weekMinutes)) * 100)} />)}
      </div>
    </Section>
  );
}

function ProgressTracking({ progress }) {
  return (
    <Section id="study-progress" title="Progress Tracking" subtitle="Local progress state plus existing analytics signals.">
      <div className="study-progress-grid">
        <ProgressBar label="Daily completion" value={progress.dailyCompletion} />
        <ProgressBar label="Weekly completion" value={progress.weeklyCompletion} />
        <ProgressBar label="Topic mastery" value={progress.topicMastery} />
        <ProgressBar label="Contest preparedness" value={progress.contestPreparedness} />
        <StudyMetric label="Consistency streak" value={`${progress.consistency} days`} />
        <StudyMetric label="Hours studied" value={`${progress.hoursStudied} hr`} />
        <StudyMetric label="Problems solved this month" value={progress.problemsSolved} />
      </div>
    </Section>
  );
}

function TargetRatingRoadmap({ roadmap, onTargetChange, onOpenProblemBank }) {
  return (
    <Section id="study-target" title="Target Rating Roadmap" subtitle="A transparent skill-gap roadmap, not a rating prediction." className="study-section-wide">
      <div className="study-target-grid">
        <label className="study-rating-control">
          <span>Current Rating</span>
          <input type="number" value={roadmap.currentRating} readOnly aria-label="Current rating" />
        </label>
        <label className="study-rating-control">
          <span>Target Rating</span>
          <select value={roadmap.targetRating} onChange={(event) => onTargetChange(Number(event.target.value))} aria-label="Target rating">
            {TARGET_OPTIONS.map((rating) => <option key={rating} value={rating}>{rating === 2100 ? '2100+' : rating}</option>)}
          </select>
        </label>
        <StudyMetric label="Estimated Skill Gap" value={`${roadmap.estimatedSkillGap} rating pts`} />
        <StudyMetric label="Expected Weekly Focus" value={roadmap.insights.expectedWeeklyFocus} />
      </div>
      <div className="study-insight-grid">
        <div><h3>Current Strengths</h3>{roadmap.insights.currentStrengths.map((item) => <BehaviorChip key={item} behavior={item} kind="strength" confidence={0.8} />)}</div>
        <div><h3>Biggest Gaps</h3>{roadmap.insights.biggestGaps.map((item) => (
          <button key={item} className="study-chip-button" type="button" onClick={() => onOpenProblemBank({ type: 'rating-gap', label: item, topic: item, confidence: 0.78 })}>
            <BehaviorChip behavior={item} kind="weakness" confidence={0.78} />
          </button>
        ))}</div>
        <div><h3>Highest ROI Topic</h3><BehaviorChip behavior={roadmap.insights.highestRoiTopic} kind="pattern" confidence={0.84} /></div>
        <div><h3>Primary Bottleneck</h3><p>{roadmap.insights.primaryBottleneck}</p></div>
      </div>
      <div className="study-milestone-list">
        {roadmap.milestones.map((milestone) => (
          <article
            key={milestone.title}
            className="study-milestone-card study-clickable"
            data-status={milestone.status}
            role="button"
            tabIndex={0}
            aria-label={`Open problem bank for ${milestone.title}`}
            onClick={() => onOpenProblemBank({ type: 'milestone', label: milestone.title, topic: milestone.title, estimatedTime: `${milestone.estimatedHours} hours`, confidence: milestone.confidence, reason: [milestone.reason] })}
            onKeyDown={(event) => activateOnKeyboard(event, () => onOpenProblemBank({ type: 'milestone', label: milestone.title, topic: milestone.title, estimatedTime: `${milestone.estimatedHours} hours`, confidence: milestone.confidence, reason: [milestone.reason] }))}
          >
            <ProgressMilestone
              currentStage={milestone.title}
              completed={Math.round(milestone.progress)}
              remaining={Math.max(0, 100 - Math.round(milestone.progress))}
              estimatedCompletion={`${milestone.estimatedHours} study hours, ${milestone.recommendedProblems} problems`}
            />
            <p>{milestone.reason}</p>
            <ConfidenceBadge value={milestone.confidence} />
          </article>
        ))}
      </div>
    </Section>
  );
}

function ContestImpact({ impact, sources }) {
  return (
    <Section title="Recent Contest Impact" subtitle="How the latest completed contest review changed this plan.">
      <div className="study-impact-card">
        <h3>{impact.title}</h3>
        <p>{impact.summary}</p>
        <dl>
          <dt>Generated</dt><dd>{impact.generatedAt ? new Date(impact.generatedAt).toLocaleString() : 'No completed review yet'}</dd>
          <dt>Recommendations added</dt><dd>{impact.recommendationsAdded}</dd>
          <dt>Reflections added</dt><dd>{impact.reflectionsAdded}</dd>
        </dl>
        <ConfidenceBadge value={impact.confidence} />
      </div>
      <div className="study-source-grid" aria-label="Planner source coverage">
        <StudyMetric label="Analytics" value={sources.analyticsLoaded ? 'Loaded' : 'Missing'} />
        <StudyMetric label="Latest Review" value={sources.latestReviewLoaded ? 'Loaded' : 'Pending'} />
        <StudyMetric label="Reflections" value={sources.reflectionCount} />
        <StudyMetric label="Behavior Features" value={sources.behaviorFeatureCount} />
      </div>
    </Section>
  );
}

function StudyPlannerHero({ loading, dismissed, onClose, onRefresh }) {
  if (dismissed) return null;
  return (
    <header className="study-planner-header">
      <div>
        <p className="study-eyebrow">Adaptive Study Planner</p>
        <h1>What should I study next?</h1>
        <p>Plan updates from existing analytics, contest reviews, recommendations, behavior evidence, and reflection memory.</p>
      </div>
      <div className="study-planner-header-actions">
        <button className="ai-button ai-focusable" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Updating...' : 'Refresh Plan'}
        </button>
        <button className="study-hero-close ai-focusable" type="button" onClick={onClose} aria-label="Close study planner introduction">
          ×
        </button>
      </div>
    </header>
  );
}

function ProblemBankModal({ problemBank, filters, onFilterChange, onClose, onRefresh, refreshing }) {
  if (!problemBank) return null;
  const filteredProblems = problemBank.problems.filter((problem) => {
    const platformMatches = filters.platform === 'all' || problem.platform === filters.platform;
    const difficultyMatches = filters.difficulty === 'all' || problem.difficulty === filters.difficulty;
    const statusMatches = filters.status === 'all' || problem.status === filters.status;
    return platformMatches && difficultyMatches && statusMatches;
  });
  const grouped = filteredProblems.reduce((accumulator, problem) => {
    accumulator[problem.platform] = accumulator[problem.platform] || [];
    accumulator[problem.platform].push(problem);
    return accumulator;
  }, {});

  return (
    <div className="study-problem-bank-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="study-problem-bank-modal" role="dialog" aria-modal="true" aria-labelledby="problem-bank-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="study-problem-bank-header">
          <div>
            <p className="study-eyebrow">Problem Bank</p>
            <h2 id="problem-bank-title">{problemBank.topic}</h2>
            <p>{problemBank.reason?.[0] || 'Problems are curated from existing recommendations and topic metadata.'}</p>
          </div>
          <button className="ai-button ai-focusable" type="button" onClick={onClose} aria-label="Close problem bank">Close</button>
        </header>

        <div className="study-problem-bank-summary">
          <StudyMetric label="Source" value={problemBank.label} />
          <StudyMetric label="Estimated Solve Time" value={problemBank.estimatedTime} />
          <StudyMetric label="Completion" value={`${problemBank.progress}%`} />
          <ConfidenceBadge value={problemBank.confidence} />
        </div>

        <div className="study-problem-bank-filters" aria-label="Problem bank filters">
          <label><span>Platform</span><select value={filters.platform} onChange={(event) => onFilterChange({ ...filters, platform: event.target.value })}><option value="all">All</option><option value="Codeforces">Codeforces</option><option value="LeetCode">LeetCode</option><option value="CodeChef">CodeChef</option></select></label>
          <label><span>Difficulty</span><select value={filters.difficulty} onChange={(event) => onFilterChange({ ...filters, difficulty: event.target.value })}><option value="all">All</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></label>
          <label><span>Status</span><select value={filters.status} onChange={(event) => onFilterChange({ ...filters, status: event.target.value })}><option value="all">All</option><option value="Not Attempted">Not Attempted</option><option value="Attempted">Attempted</option><option value="Solved">Solved</option></select></label>
          <button className="ai-button ai-focusable" type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh Status'}</button>
        </div>

        <div className="study-problem-bank-body">
          <section>
            <h3>Recommended Problems</h3>
            {Object.entries(grouped).length ? Object.entries(grouped).map(([platform, problems]) => (
              <div key={platform} className="study-problem-platform-group">
                <h4>{platform}</h4>
                <div className="study-problem-card-grid">
                  {problems.map((problem) => (
                    <article key={problem.id} className="study-problem-card" data-status={problem.status}>
                      <div>
                        <span>{problem.platform}</span>
                        <h5>{problem.name}</h5>
                      </div>
                      <dl>
                        <dt>Difficulty</dt><dd>{problem.difficulty}</dd>
                        <dt>Acceptance</dt><dd>{problem.acceptanceRate || 'Not available'}</dd>
                        <dt>Time</dt><dd>{problem.estimatedSolveTime}</dd>
                        <dt>Topic</dt><dd>{problem.topic}</dd>
                        <dt>Status</dt><dd>{problem.status}</dd>
                      </dl>
                      <a className="ai-button ai-focusable" href={problem.url} target="_blank" rel="noreferrer">Open Problem</a>
                    </article>
                  ))}
                </div>
              </div>
            )) : <p>No problems match the selected filters.</p>}
          </section>
          <aside className="study-topic-info-card">
            <h3>Topic Information</h3>
            <dl>
              <dt>Difficulty Distribution</dt><dd>{Object.entries(problemBank.difficultyDistribution).map(([key, value]) => `${key}: ${value}`).join(', ') || 'Not available'}</dd>
              <dt>Required Concepts</dt><dd>{[...new Set(problemBank.problems.flatMap((problem) => problem.requiredConcepts))].join(', ')}</dd>
              <dt>Previous Attempts</dt><dd>{problemBank.problems.reduce((sum, problem) => sum + Number(problem.previousAttempts || 0), 0)}</dd>
              <dt>Updated</dt><dd>{new Date(problemBank.updatedAt).toLocaleTimeString()}</dd>
            </dl>
          </aside>
        </div>
      </section>
    </div>
  );
}

export function StudyPlannerWorkspace() {
  const { state, dispatch, refreshInsights, api } = useAiCoachWorkspace();
  const [problemBank, setProblemBank] = useState(null);
  const [problemFilters, setProblemFilters] = useState({ platform: 'all', difficulty: 'all', status: 'all' });
  const [refreshingProblems, setRefreshingProblems] = useState(false);
  const [activeStudySection, setActiveStudySection] = useState('tracker');
  const [introDismissed, setIntroDismissed] = useState(false);
  const targetRating = state.contextualInsights.targetRating;
  const planner = useMemo(() => buildStudyPlanner({
    contextualInsights: state.contextualInsights,
    analytics: state.contextualInsights.analytics,
    latestReview: state.contextualInsights.latestReview,
    behaviorProfile: state.contextualInsights.behaviorProfile,
    behaviorFeatures: state.contextualInsights.behaviorFeatures,
    reflections: state.contextualInsights.recentReflections,
    targetRating
  }), [state.contextualInsights, targetRating]);

  function openProblemBank(source) {
    setProblemFilters({ platform: 'all', difficulty: 'all', status: 'all' });
    setProblemBank(buildProblemBank({ source, planner, analytics: state.contextualInsights.analytics }));
  }

  useEffect(() => {
    function handleOpenProblemBank(event) {
      openProblemBank(event.detail || {});
    }
    window.addEventListener('cpinsight:openProblemBank', handleOpenProblemBank);
    return () => window.removeEventListener('cpinsight:openProblemBank', handleOpenProblemBank);
  }, [planner, state.contextualInsights.analytics]);

  useEffect(() => {
    function handleStudySectionSelected(event) {
      if (event.detail?.section) setActiveStudySection(event.detail.section);
    }
    window.addEventListener('cpinsight:studySectionSelected', handleStudySectionSelected);
    return () => window.removeEventListener('cpinsight:studySectionSelected', handleStudySectionSelected);
  }, []);

  useEffect(() => {
    if (!problemBank) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') setProblemBank(null);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [problemBank]);

  async function refreshSelectedProblemStatuses() {
    if (!problemBank) return;
    setRefreshingProblems(true);
    try {
      const analytics = await api.getCombinedAnalytics();
      setProblemBank((current) => refreshProblemBankStatuses(current, analytics));
    } catch {
      setProblemBank((current) => refreshProblemBankStatuses(current, state.contextualInsights.analytics));
    } finally {
      setRefreshingProblems(false);
    }
  }

  function updateTarget(nextTarget) {
    dispatch({ type: 'studyPlanner/targetChanged', targetRating: nextTarget });
  }

  function quickStart() {
    dispatch({ type: 'sessions/created', title: `Study ${planner.todaysFocus.primaryWeakTopic}`, metadata: { source: 'study-planner', topic: planner.todaysFocus.primaryWeakTopic } });
  }

  function toggleRecommendation(item) {
    dispatch({
      type: 'recommendations/actionRecorded',
      recommendationId: item.id,
      action: state.recommendationActions[item.id]?.action === 'completed' ? 'ready' : 'completed'
    });
  }

  function renderActiveSection() {
    if (activeStudySection === 'recommended') {
      return (
        <div className="study-planner-grid study-planner-focused">
          <RecommendedProblems groups={planner.recommendedProblems} onToggleComplete={toggleRecommendation} onOpenProblemBank={openProblemBank} />
          <ContestImpact impact={planner.recentContestImpact} sources={planner.sourceSummary} />
        </div>
      );
    }

    if (activeStudySection === 'rating') {
      return (
        <div className="study-planner-grid study-planner-focused">
          <TargetRatingRoadmap roadmap={planner.targetRating} onTargetChange={updateTarget} onOpenProblemBank={openProblemBank} />
        </div>
      );
    }

    if (activeStudySection === 'topics') {
      return (
        <div className="study-planner-grid study-planner-focused">
          <TopicPriorities topics={planner.topicPriorities} onOpenProblemBank={openProblemBank} />
        </div>
      );
    }

    return (
      <>
        <StudyPlannerHero
          loading={state.contextualInsights.loading}
          dismissed={introDismissed}
          onClose={() => setIntroDismissed(true)}
          onRefresh={refreshInsights}
        />
        <TodayFocus focus={planner.todaysFocus} onQuickStart={quickStart} onOpenProblemBank={() => openProblemBank({ type: 'today-focus', label: "Today's Focus", topic: planner.todaysFocus.primaryWeakTopic, estimatedTime: planner.todaysFocus.estimatedCompletionTime, confidence: planner.todaysFocus.confidence, reason: planner.todaysFocus.why })} />
        <div className="study-planner-grid study-planner-focused">
          <DailyPlan tasks={planner.dailyPlan} actions={state.recommendationActions} onOpenProblemBank={openProblemBank} />
          <WeeklyRoadmap days={planner.weeklyRoadmap} onOpenProblemBank={openProblemBank} />
          <StudyTime time={planner.estimatedStudyTime} />
          <ProgressTracking progress={planner.progress} />
        </div>
      </>
    );
  }

  return (
    <section className="coach-workspace-surface study-planner-surface" aria-label="Adaptive Study Planner">
      {state.contextualInsights.error ? (
        <section className="study-error ai-card" role="alert">
          <h2>Planner data is partially unavailable.</h2>
          <p>{state.contextualInsights.error}</p>
        </section>
      ) : null}

      {renderActiveSection()}
      <ProblemBankModal
        problemBank={problemBank}
        filters={problemFilters}
        onFilterChange={setProblemFilters}
        onClose={() => setProblemBank(null)}
        onRefresh={refreshSelectedProblemStatuses}
        refreshing={refreshingProblems}
      />
    </section>
  );
}
