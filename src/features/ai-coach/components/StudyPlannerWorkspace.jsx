import React, { useMemo } from 'react';
import {
  BehaviorChip,
  ConfidenceBadge,
  ProgressMilestone,
  RecommendationCard
} from '../../../components/ai/index.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { buildStudyPlanner } from '../utils/studyPlanner.js';

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

function Section({ title, subtitle, children, className = '' }) {
  return (
    <section className={`study-section ai-card ${className}`.trim()}>
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

function TodayFocus({ focus, onQuickStart }) {
  return (
    <section className="study-focus-card ai-card">
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
      <button className="ai-button ai-focusable" type="button" onClick={onQuickStart}>Quick Start</button>
    </section>
  );
}

function DailyPlan({ tasks, actions }) {
  return (
    <Section title="Daily Study Plan" subtitle="A focused sequence assembled from current priorities.">
      <div className="study-task-list">
        {tasks.map((task) => {
          const key = `${task.title}-${task.topic}`;
          const completed = actions[key]?.action === 'completed';
          return (
            <article key={key} className="study-task-card" data-completed={completed}>
              <div>
                <h3>{task.title}</h3>
                <p>{task.topic}</p>
              </div>
              <dl>
                <dt>Duration</dt><dd>{task.duration}</dd>
                <dt>Difficulty</dt><dd>{task.difficulty}</dd>
                <dt>Priority</dt><dd>{task.priority}</dd>
              </dl>
              <button className="ai-button ai-focusable" type="button">Quick Start</button>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

function WeeklyRoadmap({ days }) {
  return (
    <Section title="Weekly Roadmap" subtitle="Expandable daily focus blocks for the selected rating target.">
      <div className="study-week-grid">
        {days.map((day) => (
          <details key={day.day} className="study-day-card">
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
          </details>
        ))}
      </div>
    </Section>
  );
}

function TopicPriorities({ topics }) {
  return (
    <Section title="Topic Priorities" subtitle="Ranked by dynamic ROI from analytics, review evidence, reflections, and target rating needs." className="study-section-wide">
      <div className="study-topic-priority-list">
        {topics.map((topic, index) => (
          <article key={topic.topic} className="study-topic-card">
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

function RecommendedProblems({ groups, onToggleComplete }) {
  const labels = [
    ['today', "Today's Practice"],
    ['week', 'This Week'],
    ['stretch', 'Stretch Goal']
  ];
  return (
    <Section title="Recommended Problems" subtitle="Existing recommendations grouped into actionable practice windows." className="study-section-wide">
      <div className="study-recommendation-groups">
        {labels.map(([key, label]) => (
          <div key={key}>
            <h3>{label}</h3>
            {(groups[key] || []).map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} onToggleComplete={onToggleComplete} />
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

function StudyTime({ time }) {
  return (
    <Section title="Estimated Study Time" subtitle="Time budget by day, week, topic, and difficulty.">
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
    <Section title="Progress Tracking" subtitle="Local progress state plus existing analytics signals.">
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

function TargetRatingRoadmap({ roadmap, onTargetChange }) {
  return (
    <Section title="Target Rating Roadmap" subtitle="A transparent skill-gap roadmap, not a rating prediction." className="study-section-wide">
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
        <div><h3>Biggest Gaps</h3>{roadmap.insights.biggestGaps.map((item) => <BehaviorChip key={item} behavior={item} kind="weakness" confidence={0.78} />)}</div>
        <div><h3>Highest ROI Topic</h3><BehaviorChip behavior={roadmap.insights.highestRoiTopic} kind="pattern" confidence={0.84} /></div>
        <div><h3>Primary Bottleneck</h3><p>{roadmap.insights.primaryBottleneck}</p></div>
      </div>
      <div className="study-milestone-list">
        {roadmap.milestones.map((milestone) => (
          <article key={milestone.title} className="study-milestone-card" data-status={milestone.status}>
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

export function StudyPlannerWorkspace() {
  const { state, dispatch, refreshInsights } = useAiCoachWorkspace();
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

  return (
    <section className="coach-workspace-surface study-planner-surface" aria-label="Adaptive Study Planner">
      <header className="study-planner-header">
        <div>
          <p className="study-eyebrow">Adaptive Study Planner</p>
          <h1>What should I study next?</h1>
          <p>Plan updates from existing analytics, contest reviews, recommendations, behavior evidence, and reflection memory.</p>
        </div>
        <button className="ai-button ai-focusable" type="button" onClick={refreshInsights} disabled={state.contextualInsights.loading}>
          {state.contextualInsights.loading ? 'Updating...' : 'Refresh Plan'}
        </button>
      </header>

      {state.contextualInsights.error ? (
        <section className="study-error ai-card" role="alert">
          <h2>Planner data is partially unavailable.</h2>
          <p>{state.contextualInsights.error}</p>
        </section>
      ) : null}

      <TodayFocus focus={planner.todaysFocus} onQuickStart={quickStart} />
      <div className="study-planner-grid">
        <DailyPlan tasks={planner.dailyPlan} actions={state.recommendationActions} />
        <WeeklyRoadmap days={planner.weeklyRoadmap} />
        <TopicPriorities topics={planner.topicPriorities} />
        <RecommendedProblems groups={planner.recommendedProblems} onToggleComplete={toggleRecommendation} />
        <StudyTime time={planner.estimatedStudyTime} />
        <ProgressTracking progress={planner.progress} />
        <TargetRatingRoadmap roadmap={planner.targetRating} onTargetChange={updateTarget} />
        <ContestImpact impact={planner.recentContestImpact} sources={planner.sourceSummary} />
      </div>
    </section>
  );
}
