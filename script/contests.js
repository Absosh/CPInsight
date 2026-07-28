let contestsState = {
  contests: [],
  selectedContest: null,
  review: null,
  reviewStatus: null,
  reviewStatuses: {},
  statusSocket: null,
  loadingReview: false,
  filter: 'all'
};

function contestText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalizeContest(value) {
  if (!value) return 'Unknown';
  return value.toString().replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
}

function formatSignedContestNumber(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : `${number}`;
}

function confidencePercent(value) {
  const number = Number(value);
  const normalized = Number.isFinite(number) ? (number > 1 ? number / 100 : number) : 0;
  return `${Math.round(Math.max(0, Math.min(1, normalized)) * 100)}%`;
}

function confidenceCategory(value) {
  const number = Number(value);
  const normalized = Number.isFinite(number) ? (number > 1 ? number / 100 : number) : 0;
  if (normalized >= 0.9) return 'verified';
  if (normalized >= 0.7) return 'high';
  if (normalized >= 0.45) return 'medium';
  return 'low';
}

function badge(value, label = 'Confidence') {
  return `
    <span class="ai-confidence-badge ai-focusable" data-confidence="${confidenceCategory(value)}" tabindex="0" aria-label="${escapeHtml(label)}: ${confidencePercent(value)}" title="${escapeHtml(label)}: ${confidencePercent(value)}">
      <span class="ai-confidence-dot"></span>
      <span>${confidencePercent(value)}</span>
    </span>
  `;
}

function safeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function reviewStatusKey(contest) {
  return `${contest.platform || 'unknown'}:${contest.contestId || contest.id}`;
}

function normalizeReviewStatus(status) {
  if (!status) {
    return {
      state: 'not_generated',
      label: 'Not Generated',
      tone: 'neutral',
      icon: '⚪',
      progress: 0,
      failedReason: null,
      ready: false
    };
  }

  const raw = (status.status || status.last_stage || '').toString().toLowerCase();
  if (raw === 'completed' || status.persisted_review_id || status.persistedReviewId) {
    return {
      ...status,
      state: 'ready',
      label: 'Ready',
      tone: 'ready',
      icon: '🟢',
      progress: 100,
      failedReason: null,
      ready: true
    };
  }

  if (['failed', 'dead_letter'].includes(raw)) {
    return {
      ...status,
      state: 'failed',
      label: 'Failed',
      tone: 'failed',
      icon: '🔴',
      progress: Number(status.progress_percent || status.progressPercent || 0),
      failedReason: status.error_message || status.errorMessage || 'Review processing failed.',
      ready: false
    };
  }

  if (['queued', 'claimed', 'running', 'behavior_processing', 'knowledge_graph_update', 'reasoning', 'ai_review', 'reflection', 'roadmap_update', 'persist', 'retrying'].includes(raw)) {
    const progress = Number(status.progress_percent || status.progressPercent || 0);
    return {
      ...status,
      state: 'processing',
      label: progress > 0 ? `Processing ${progress}%` : 'Processing',
      tone: 'processing',
      icon: '🟡',
      progress,
      failedReason: null,
      ready: false
    };
  }

  return {
    ...status,
    state: 'not_generated',
    label: 'Not Generated',
    tone: 'neutral',
    icon: '⚪',
    progress: 0,
    failedReason: null,
    ready: false
  };
}

function reviewStatusForContest(contest) {
  return contestsState.reviewStatuses[reviewStatusKey(contest)] || normalizeReviewStatus(null);
}

function setReviewStatusForContest(contest, status) {
  contestsState.reviewStatuses = {
    ...contestsState.reviewStatuses,
    [reviewStatusKey(contest)]: normalizeReviewStatus(status)
  };
}

function renderReviewStatusBadge(contest) {
  const status = reviewStatusForContest(contest);
  const title = status.failedReason || `Review status: ${status.label}`;
  const classes = `review-status-badge review-status-${status.tone} ai-focusable`;
  const label = `${status.icon} ${status.label}`;

  if (status.ready) {
    return `
      <button
        type="button"
        class="${classes}"
        data-review-action="open"
        data-contest-id="${escapeHtml(contest.id)}"
        title="${escapeHtml(title)}"
        aria-label="Open AI review for ${escapeHtml(contest.contestName)}"
      >${escapeHtml(label)}</button>
    `;
  }

  return `
    <span
      class="${classes}"
      title="${escapeHtml(title)}"
      aria-label="Review status for ${escapeHtml(contest.contestName)}: ${escapeHtml(status.label)}"
    >${escapeHtml(label)}</span>
  `;
}

async function getReviewApi(endpoint) {
  const request = async () => fetch(`${httpClient.baseURL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('accessToken')
        ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        : {})
    }
  });

  let response = await request();
  if (response.status === 401 && await httpClient.refreshToken()) {
    response = await request();
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }
  return response.json();
}

function getContestStableId(contest, index) {
  return contest.contestId || contest.contest_id || contest.id || contest.contestName || `contest-${index}`;
}

function normalizeContestRows(analytics) {
  return safeList(analytics?.ratingProgression)
    .filter((point) => point && (point.contestName || point.contestId || point.participatedAt))
    .map((point, index) => ({
      id: getContestStableId(point, index),
      contestId: point.contestId || point.contest_id || getContestStableId(point, index),
      contestName: point.contestName || point.name || 'Contest',
      platform: point.platform || analytics.platform || 'combined',
      rank: point.rank ?? null,
      oldRating: typeof point.rating === 'number' && typeof point.delta === 'number' ? point.rating - point.delta : null,
      newRating: point.rating ?? null,
      change: point.delta || 0,
      solved: point.solved ?? point.solvedCount ?? null,
      duration: point.duration || point.durationSeconds || null,
      participatedAt: point.participatedAt || point.date || null
    }))
    .sort((a, b) => new Date(b.participatedAt || 0) - new Date(a.participatedAt || 0));
}

function selectedContests() {
  if (contestsState.filter === 'all') return contestsState.contests;
  return contestsState.contests.filter((contest) => contest.platform === contestsState.filter);
}

function renderContestFilters() {
  const select = document.getElementById('contestPlatformFilter');
  if (!select) return;
  const platforms = Array.from(new Set(contestsState.contests.map((contest) => contest.platform).filter(Boolean))).sort();
  select.innerHTML = ['<option value="all">All platforms</option>']
    .concat(platforms.map((platform) => `<option value="${escapeHtml(platform)}">${escapeHtml(capitalizeContest(platform))}</option>`))
    .join('');
  select.value = contestsState.filter;
}

function renderContestList() {
  const list = document.getElementById('contestList');
  if (!list) return;

  const rows = selectedContests();
  if (!rows.length) {
    list.innerHTML = '<div class="ai-card p-5 text-gray-400">No completed contests are available yet. Sync a supported platform to populate contest history.</div>';
    return;
  }

  list.innerHTML = rows.map((contest) => {
    const selected = contestsState.selectedContest?.id === contest.id;
    return `
      <article
        class="contest-list-row ai-card ai-focusable w-full text-left p-4 transition"
        aria-selected="${selected}"
        data-contest-id="${escapeHtml(contest.id)}"
      >
        <button type="button" class="contest-list-main w-full text-left" data-contest-id="${escapeHtml(contest.id)}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-bold text-white truncate">${escapeHtml(contest.contestName)}</h3>
              <p class="text-sm text-gray-400 mt-1">${escapeHtml(capitalizeContest(contest.platform))} - ${escapeHtml(formatDate(contest.participatedAt))}</p>
            </div>
            <span class="${contest.change >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">${escapeHtml(formatSignedContestNumber(contest.change))}</span>
          </div>
        </button>
        <div class="contest-metrics-grid mt-4 text-sm">
          <span><span class="text-gray-500">Rank</span><br>${escapeHtml(contest.rank ?? '--')}</span>
          <span><span class="text-gray-500">Rating</span><br>${escapeHtml(contest.newRating ?? '--')}</span>
          <span><span class="text-gray-500">Solved</span><br>${escapeHtml(contest.solved ?? '--')}</span>
          <div class="min-w-0">
            <span class="text-gray-500">Review</span><br>
            ${renderReviewStatusBadge(contest)}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderContestDetail() {
  const detail = document.getElementById('contestDetail');
  if (!detail) return;

  const contest = contestsState.selectedContest;
  if (!contest) {
    detail.innerHTML = `
      <div class="ai-card p-8">
        <h2 class="text-2xl font-bold text-white">Select a contest</h2>
        <p class="text-gray-400 mt-2">Choose a completed contest to view details and retrieve its existing AI review.</p>
      </div>
    `;
    return;
  }

  const status = contestsState.reviewStatus?.status || contestsState.reviewStatus?.last_stage || (contestsState.review ? 'completed' : 'no_review');
  const listStatus = reviewStatusForContest(contest);
  const statusLabel = listStatus.state === 'not_generated' ? status : listStatus.label;
  detail.innerHTML = `
    <header class="ai-card overflow-hidden">
      <div class="ai-card-header">
        <span class="ai-icon ai-icon-md" aria-label="Contest">CT</span>
        <div class="min-w-0">
          <p class="ai-muted">Contest Details</p>
          <h2 class="text-xl font-bold text-white truncate">${escapeHtml(contest.contestName)}</h2>
        </div>
        <span class="ml-auto rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-emerald-300">${escapeHtml(capitalizeContest(statusLabel))}</span>
      </div>
      <dl class="ai-meta-grid">
        <dt>Platform</dt><dd>${escapeHtml(capitalizeContest(contest.platform))}</dd>
        <dt>Contest date</dt><dd>${escapeHtml(formatDate(contest.participatedAt))}</dd>
        <dt>Duration</dt><dd>${escapeHtml(contest.duration ? `${Math.round(Number(contest.duration) / 60)} min` : 'Not available')}</dd>
        <dt>Rating change</dt><dd>${escapeHtml(formatSignedContestNumber(contest.change))}</dd>
        <dt>Rank</dt><dd>${escapeHtml(contest.rank ?? '--')}</dd>
        <dt>Solved</dt><dd>${escapeHtml(contest.solved ?? '--')}</dd>
        <dt>Review generated</dt><dd>${escapeHtml(formatDateTime(contestsState.review?.created_at || contestsState.review?.createdAt))}</dd>
      </dl>
      <div class="ai-card-actions">
        <button id="viewAiReviewBtn" class="ai-button ai-focusable" type="button">View AI Review</button>
      </div>
    </header>
  `;
}

function normalizeReview(review) {
  const response = review?.validated_response || review?.validatedResponse || {};
  const quality = review?.quality_report || review?.qualityReport || {};
  const reasoning = review?.reasoning_context || review?.reasoningContext || {};
  const evidence = review?.evidence_package || review?.evidencePackage || {};
  const recommendations = safeList(review?.recommendations || response.recommendations);
  const roadmap = review?.roadmap || {};
  const reflections = safeList(review?.reflections || response.reflections);

  return {
    title: review?.title || 'Contest Review',
    summary: review?.summary || response.summary || 'No summary was stored for this review.',
    generatedAt: review?.created_at || review?.createdAt,
    overallConfidence: response.confidence || quality.overallQualityScore || quality.groundingCoverage || 0,
    observations: safeList(response.observations),
    inferences: safeList(response.inferences),
    findings: safeList(reasoning.primaryFindings || evidence.insights || response.inferences),
    evidence: safeList(evidence.evidence || evidence.items || evidence.relevantFeatures || evidence.supportingContests),
    reasoning,
    quality,
    recommendations,
    roadmap,
    reflections,
    behavior: safeList(reasoning.primaryFindings || evidence.behaviorProfile || evidence.insights),
    mistakes: safeList(response.mistakes || evidence.mistakes || quality.recommendationFailures),
    comparison: evidence.historicalComparison || evidence.confidenceSummary || {}
  };
}

function renderLoadingReview() {
  const panel = document.getElementById('contestReviewPanel');
  if (!panel) return;
  panel.innerHTML = `
    <section class="ai-card p-8">
      <div class="ai-skeleton h-5 w-48 mb-4"></div>
      <div class="ai-skeleton h-4 w-full mb-2"></div>
      <div class="ai-skeleton h-4 w-2/3"></div>
    </section>
  `;
}

function renderPendingReview() {
  const panel = document.getElementById('contestReviewPanel');
  if (!panel) return;
  const status = contestsState.reviewStatus?.status || 'No Review';
  const progress = contestsState.reviewStatus?.progress_percent || 0;
  panel.innerHTML = `
    <section class="ai-card p-8" id="aiContestReview">
      <p class="text-emerald-400 text-sm font-bold uppercase tracking-[0.3em]">AI Contest Review</p>
      <h2 class="text-2xl font-bold text-white mt-2">Review pending...</h2>
      <p class="text-gray-400 mt-2">No completed AI review is available for this contest yet. This viewer only retrieves stored reviews and does not trigger generation.</p>
      <dl class="ai-meta-grid mt-6 p-0">
        <dt>Status</dt><dd>${escapeHtml(capitalizeContest(status))}</dd>
        <dt>Progress</dt><dd>${escapeHtml(progress)}%</dd>
      </dl>
    </section>
  `;
}

function renderFindingCards(review) {
  const findings = review.findings.length ? review.findings : review.inferences;
  if (!findings.length) return '<p class="ai-muted px-4 pb-4">No findings were stored.</p>';
  return findings.slice(0, 8).map((finding, index) => `
    <article class="ai-card ai-reveal" data-interactive="true">
      <div class="ai-card-header">
        <span class="ai-icon ai-icon-md" aria-label="Finding">FD</span>
        <div>
          <h3>${escapeHtml(finding.title || finding.label || finding.behaviorFinding || finding.conceptId || `Finding ${index + 1}`)}</h3>
          <p>${escapeHtml(finding.severity || finding.findingType || 'Behavior finding')}</p>
        </div>
        ${badge(finding.confidence || review.overallConfidence)}
      </div>
      <details open>
        <summary>Detailed explanation</summary>
        <p class="ai-muted">${escapeHtml(finding.description || finding.summary || finding.reason || finding.text || 'Detailed explanation was not stored.')}</p>
      </details>
    </article>
  `).join('');
}

function renderEvidenceCards(review) {
  if (!review.evidence.length) return '<p class="ai-muted px-4 pb-4">No evidence references were stored.</p>';
  return review.evidence.slice(0, 10).map((item, index) => `
    <article class="ai-card ai-evidence-card ai-reveal" data-interactive="true">
      <div class="ai-card-header">
        <span class="ai-icon ai-icon-md" aria-label="Evidence">EV</span>
        <div>
          <h3>${escapeHtml(item.finding || item.title || item.type || `Evidence ${index + 1}`)}</h3>
          <p>${escapeHtml(item.source || item.evidenceType || 'Stored evidence')}</p>
        </div>
        ${badge(item.confidence || review.overallConfidence)}
      </div>
      <p class="ai-muted">${escapeHtml(item.supportingData || item.summary || item.description || item.value || 'Evidence detail was not stored.')}</p>
      <details>
        <summary>Inspect citations</summary>
        <ul>${safeList(item.citations || item.evidenceIds || item.references).map((citation) => `<li>${escapeHtml(citation)}</li>`).join('') || '<li>No citation identifiers stored.</li>'}</ul>
      </details>
    </article>
  `).join('');
}

function renderReasoning(review) {
  const chain = safeList(review.reasoning.reasoningChain || review.reasoning.causalChains);
  return `
    <aside class="ai-card ai-reasoning-panel" aria-label="Reasoning details">
      <div class="ai-card-header">
        <span class="ai-icon ai-icon-md" aria-label="Reasoning">RS</span>
        <div>
          <h3>Reasoning</h3>
          <p>Reasoning chain, evidence support, contradictions, and missing context</p>
        </div>
      </div>
      <details class="ai-reasoning-section" open>
        <summary>Reasoning chain</summary>
        <ol class="ai-chain">${chain.map((step, index) => `<li>${escapeHtml(step.label || step.conceptId || step.summary || step || `Step ${index + 1}`)}</li>`).join('') || '<li>No reasoning chain stored.</li>'}</ol>
      </details>
      <details class="ai-reasoning-section">
        <summary>Contradictions</summary>
        <ul>${safeList(review.reasoning.contradictions).map((item) => `<li>${escapeHtml(item.summary || item.reason || item)}</li>`).join('') || '<li>No contradictions stored.</li>'}</ul>
      </details>
      <details class="ai-reasoning-section">
        <summary>Missing evidence</summary>
        <ul>${safeList(review.reasoning.missingEvidence).map((item) => `<li>${escapeHtml(item.summary || item.source || item)}</li>`).join('') || '<li>No missing evidence recorded.</li>'}</ul>
      </details>
    </aside>
  `;
}

function renderBehavior(review) {
  if (!review.behavior.length) return '<p class="ai-muted px-4 pb-4">No behavior analysis was stored.</p>';
  return review.behavior.slice(0, 10).map((item) => `
    <span class="ai-behavior-chip" data-kind="${escapeHtml(item.findingType || item.type || 'pattern')}">
      <span>${escapeHtml(item.label || item.conceptId || item.behaviorFinding || item.title || 'Behavior')}</span>
      <small>${escapeHtml(confidencePercent(item.confidence || review.overallConfidence))}</small>
    </span>
  `).join('');
}

function renderMistakes(review) {
  if (!review.mistakes.length) return '<p class="ai-muted px-4 pb-4">No mistake analysis was stored.</p>';
  return review.mistakes.slice(0, 8).map((item, index) => `
    <article class="ai-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="font-bold text-white">${escapeHtml(item.category || item.title || `Mistake ${index + 1}`)}</h3>
          <p class="text-gray-400 text-sm mt-1">${escapeHtml(item.recommendation || item.description || item.reason || 'No recommendation stored.')}</p>
        </div>
        <span class="text-rose-300 text-sm font-bold">${escapeHtml(item.severity || 'review')}</span>
      </div>
    </article>
  `).join('');
}

function renderRecommendations(review) {
  if (!review.recommendations.length) return '<p class="ai-muted px-4 pb-4">No recommendations were stored.</p>';
  return review.recommendations.slice(0, 8).map((item) => `
    <article class="ai-card ai-recommendation-card ai-reveal" data-priority="${escapeHtml(item.priority || 'medium')}" data-interactive="true">
      <div class="ai-card-header">
        <span class="ai-icon ai-icon-md" aria-label="Recommendation">RC</span>
        <div>
          <h3>${escapeHtml(item.title || item.recommendation || 'Recommendation')}</h3>
          <p>${escapeHtml(item.priority || 'medium')} priority</p>
        </div>
        ${badge(item.confidence || item.expectedImpact || review.overallConfidence, 'Expected impact')}
      </div>
      <p>${escapeHtml(item.description || item.nextAction || 'Action details were not stored.')}</p>
      <dl class="ai-meta-grid">
        <dt>Difficulty</dt><dd>${escapeHtml(item.difficulty || 'moderate')}</dd>
        <dt>Estimated time</dt><dd>${escapeHtml(item.estimatedTime || 'not estimated')}</dd>
      </dl>
    </article>
  `).join('');
}

function renderRoadmap(review) {
  const roadmap = review.roadmap || {};
  const milestones = safeList(roadmap.milestones || roadmap.weeks || roadmap.tasks);
  if (!milestones.length) return '<p class="ai-muted px-4 pb-4">No improvement plan was stored.</p>';
  return milestones.slice(0, 6).map((item, index) => `
    <article class="ai-card ai-progress-milestone p-4">
      <h3 class="font-bold text-white">${escapeHtml(item.title || item.goal || `Week ${index + 1}`)}</h3>
      <p class="text-gray-400 text-sm mt-1">${escapeHtml(item.description || item.task || item.focus || 'Milestone detail was not stored.')}</p>
      <div class="ai-progress-track mt-4 mx-0 mb-0" aria-label="Progress ${escapeHtml(item.progress || 0)}%">
        <span style="inline-size:${Math.max(0, Math.min(100, Number(item.progress || 0)))}%"></span>
      </div>
    </article>
  `).join('');
}

function renderReflections(review) {
  if (!review.reflections.length) return '<p class="ai-muted px-4 pb-4">No reflection memory was stored.</p>';
  return `
    <ol class="ai-timeline-list">
      ${review.reflections.slice(0, 8).map((reflection) => `
        <li>
          <span class="ai-timeline-marker"></span>
          <div>
            <time>${escapeHtml(formatDateTime(reflection.createdAt || reflection.created_at || review.generatedAt))}</time>
            <h4>${escapeHtml(reflection.behaviorFinding || reflection.type || 'Reflection')}</h4>
            ${badge(reflection.confidence || review.overallConfidence)}
          </div>
        </li>
      `).join('')}
    </ol>
  `;
}

function renderReview(reviewRecord) {
  const panel = document.getElementById('contestReviewPanel');
  if (!panel) return;
  const review = normalizeReview(reviewRecord);
  panel.innerHTML = `
    <section id="aiContestReview" class="review-section">
      <header class="ai-card overflow-hidden">
        <div class="ai-card-header">
          <span class="ai-icon ai-icon-lg" aria-label="AI review">AI</span>
          <div>
            <p class="ai-muted">AI Contest Review</p>
            <h2>${escapeHtml(review.title)}</h2>
          </div>
          ${badge(review.overallConfidence, 'Overall confidence')}
        </div>
        <div class="px-4 pb-4">
          <p class="text-gray-200 text-lg leading-8">${escapeHtml(review.summary)}</p>
        </div>
        <dl class="ai-meta-grid">
          <dt>Contest grade</dt><dd>${escapeHtml(review.quality.grade || review.quality.validationStatus || 'Stored review')}</dd>
          <dt>Generated</dt><dd>${escapeHtml(formatDateTime(review.generatedAt))}</dd>
          <dt>Quality score</dt><dd>${escapeHtml(confidencePercent(review.quality.overallQualityScore || review.overallConfidence))}</dd>
        </dl>
      </header>

      <div class="review-grid">
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Key Findings</h2>
          ${renderFindingCards(review)}
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Evidence</h2>
          ${renderEvidenceCards(review)}
        </section>
        <section class="review-section-wide">
          ${renderReasoning(review)}
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Behavior Analysis</h2>
          <div class="ai-chip-row p-0">${renderBehavior(review)}</div>
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Mistake Analysis</h2>
          ${renderMistakes(review)}
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Recommendations</h2>
          ${renderRecommendations(review)}
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Improvement Plan</h2>
          ${renderRoadmap(review)}
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Reflection</h2>
          <article class="ai-card ai-reflection-timeline p-4">${renderReflections(review)}</article>
        </section>
        <section class="review-section">
          <h2 class="text-xl font-bold text-white">Comparison</h2>
          <article class="ai-card p-4">
            <dl class="ai-meta-grid p-0">
              <dt>Current contest</dt><dd>${escapeHtml(contestsState.selectedContest?.contestName || 'Selected contest')}</dd>
              <dt>Previous baseline</dt><dd>${escapeHtml(review.comparison.previousContest || review.comparison.baseline || 'Not stored')}</dd>
              <dt>Improvement</dt><dd>${escapeHtml(review.comparison.improvement || review.comparison.summary || 'Not stored')}</dd>
            </dl>
          </article>
        </section>
        <section class="review-section-wide">
          <h2 class="text-xl font-bold text-white">Export</h2>
          <div class="review-export-row">
            <button class="ai-button ai-focusable" type="button" data-export="pdf">Export PDF</button>
            <button class="ai-button ai-focusable" type="button" data-export="markdown">Export Markdown</button>
            <button class="ai-button ai-focusable" type="button" data-export="json">Export JSON</button>
            <button class="ai-button ai-focusable" type="button" data-export="copy">Copy Summary</button>
            <button class="ai-button ai-focusable" type="button" data-export="print">Print</button>
          </div>
        </section>
      </div>
    </section>
  `;
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reviewAsMarkdown() {
  const review = normalizeReview(contestsState.review);
  return [
    `# ${review.title}`,
    '',
    `Generated: ${formatDateTime(review.generatedAt)}`,
    `Confidence: ${confidencePercent(review.overallConfidence)}`,
    '',
    '## Summary',
    review.summary,
    '',
    '## Recommendations',
    ...review.recommendations.map((item) => `- ${item.title || item.recommendation || item.nextAction || 'Recommendation'}`)
  ].join('\n');
}

async function handleExport(type) {
  if (!contestsState.review) return;
  const contest = contestsState.selectedContest;
  const baseName = `${contest?.platform || 'contest'}-${contest?.contestId || 'review'}`.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();

  if (type === 'pdf' || type === 'print') {
    window.print();
    return;
  }
  if (type === 'json') {
    downloadFile(`${baseName}-review.json`, JSON.stringify(contestsState.review, null, 2), 'application/json');
    return;
  }
  if (type === 'markdown') {
    downloadFile(`${baseName}-review.md`, reviewAsMarkdown(), 'text/markdown');
    return;
  }
  if (type === 'copy') {
    const review = normalizeReview(contestsState.review);
    await navigator.clipboard.writeText(review.summary);
    stateManager?.showNotification?.('Review summary copied.', 'success');
  }
}

async function loadReviewStatusesForContests(contests = contestsState.contests) {
  const unique = [];
  const seen = new Set();
  contests.forEach((contest) => {
    const key = reviewStatusKey(contest);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(contest);
  });

  for (let index = 0; index < unique.length; index += 6) {
    const batch = unique.slice(index, index + 6);
    const results = await Promise.all(batch.map(async (contest) => {
      const contestId = encodeURIComponent(contest.contestId);
      const platformQuery = contest.platform ? `?platform=${encodeURIComponent(contest.platform)}` : '';
      const response = await getReviewApi(`/reviews/status/${contestId}${platformQuery}`).catch(() => null);
      return { contest, status: response?.status || null };
    }));

    results.forEach(({ contest, status }) => setReviewStatusForContest(contest, status));
    renderContestList();
    renderContestDetail();
  }
}

function updateStatusFromReviewEvent(event) {
  const eventType = event?.metadata?.domainEventType || event?.messageType || event?.type;
  if (!eventType || !eventType.startsWith('review.')) return;

  const payload = event.payload || {};
  const matchingContest = contestsState.contests.find((contest) => {
    const status = reviewStatusForContest(contest);
    return status.id === payload.jobId || status.job_id === payload.jobId;
  });

  if (matchingContest && eventType === 'review.progress') {
    setReviewStatusForContest(matchingContest, {
      ...reviewStatusForContest(matchingContest),
      status: payload.status || 'running',
      progress_percent: payload.progressPercent
    });
    renderContestList();
    return;
  }

  if (['review.completed', 'review.ready', 'review.failed', 'review.retrying', 'review.processing'].includes(eventType)) {
    loadReviewStatusesForContests(matchingContest ? [matchingContest] : contestsState.contests);
  }
}

function connectReviewStatusSocket() {
  if (contestsState.statusSocket || !window.WebSocket || !localStorage.getItem('accessToken')) return;

  const realtimeUrl = new URL(httpClient.baseURL.replace(/\/api$/, '').replace(/^http/, 'ws'));
  realtimeUrl.pathname = '/realtime';
  realtimeUrl.searchParams.set('token', localStorage.getItem('accessToken'));

  try {
    const socket = new WebSocket(realtimeUrl.toString());
    contestsState.statusSocket = socket;

    socket.addEventListener('open', () => {
      const userId = stateManager.getState().profile.data?.id || stateManager.getState().profile.data?.user?.id;
      if (userId) {
        socket.send(JSON.stringify({ messageType: 'SUBSCRIBE', payload: { channel: `user:${userId}` } }));
      }
      socket.send(JSON.stringify({ messageType: 'SUBSCRIBE', payload: { channel: 'system' } }));
    });

    socket.addEventListener('message', (message) => {
      try {
        updateStatusFromReviewEvent(JSON.parse(message.data));
      } catch {
        // Ignore malformed realtime frames; the status API remains the source of truth.
      }
    });

    socket.addEventListener('close', () => {
      contestsState.statusSocket = null;
    });
  } catch {
    contestsState.statusSocket = null;
  }
}

async function loadReviewForContest(contest) {
  contestsState.loadingReview = true;
  contestsState.review = null;
  contestsState.reviewStatus = null;
  renderContestDetail();
  renderLoadingReview();

  const contestId = encodeURIComponent(contest.contestId);
  const platformQuery = contest.platform ? `?platform=${encodeURIComponent(contest.platform)}` : '';

  try {
    const statusResponse = await getReviewApi(`/reviews/status/${contestId}${platformQuery}`);
    contestsState.reviewStatus = statusResponse?.status || null;
    setReviewStatusForContest(contest, contestsState.reviewStatus);
    const reviewResponse = await getReviewApi(`/reviews/contest/${contestId}${platformQuery}`);
    contestsState.review = reviewResponse?.review || null;
    if (contestsState.review && !contestsState.reviewStatus) {
      setReviewStatusForContest(contest, { status: 'completed', persisted_review_id: contestsState.review.id });
    }
  } catch (error) {
    contestsState.reviewStatus = { status: 'failed', error: error.message };
  } finally {
    contestsState.loadingReview = false;
    renderContestDetail();
    if (contestsState.review) {
      renderReview(contestsState.review);
    } else {
      renderPendingReview();
    }
  }
}

function selectContest(contestId) {
  const contest = contestsState.contests.find((item) => item.id === contestId);
  if (!contest) return;
  contestsState.selectedContest = contest;
  const params = new URLSearchParams(window.location.search);
  params.set('contest', contest.id);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  renderContestList();
  loadReviewForContest(contest);
}

async function loadContestAnalytics() {
  contestText('contestPageStatus', 'Loading connected platform analytics...');
  try {
    let analytics;
    const state = stateManager.getState();
    const platforms = state.platforms.selectedPlatforms || [];
    if (platforms.length === 1) {
      analytics = await analyticsService.getAnalytics(platforms[0]);
    } else {
      analytics = await analyticsService.getCombinedAnalytics();
    }

    contestsState.contests = normalizeContestRows(analytics);
    renderContestFilters();
    renderContestList();
    contestText('contestPageStatus', contestsState.contests.length ? 'Completed contest history loaded.' : 'No completed contest history is available yet.');
    loadReviewStatusesForContests();
    connectReviewStatusSocket();

    const params = new URLSearchParams(window.location.search);
    const requested = params.get('contest');
    const initial = contestsState.contests.find((contest) => contest.id === requested) || contestsState.contests[0] || null;
    if (initial) selectContest(initial.id);
    else renderContestDetail();
  } catch (error) {
    contestText('contestPageStatus', `Failed to load contests: ${error.message}`);
    document.getElementById('contestList').innerHTML = `<div class="ai-card p-5 text-rose-300">${escapeHtml(error.message)}</div>`;
    renderContestDetail();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRevealAnimations();
  const mainApp = document.getElementById('mainApp');
  mainApp?.classList.remove('blur-md', 'pointer-events-none');

  const list = document.getElementById('contestList');
  list?.addEventListener('click', (event) => {
    const reviewAction = event.target.closest('[data-review-action="open"]');
    if (reviewAction) {
      event.stopPropagation();
      selectContest(reviewAction.dataset.contestId);
      setTimeout(() => document.getElementById('aiContestReview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      return;
    }

    const row = event.target.closest('[data-contest-id]');
    if (row) selectContest(row.dataset.contestId);
  });

  document.getElementById('contestPlatformFilter')?.addEventListener('change', (event) => {
    contestsState.filter = event.target.value;
    const rows = selectedContests();
    if (!rows.some((contest) => contest.id === contestsState.selectedContest?.id)) {
      contestsState.selectedContest = rows[0] || null;
      if (contestsState.selectedContest) {
        selectContest(contestsState.selectedContest.id);
      } else {
        renderContestList();
        renderContestDetail();
        renderPendingReview();
      }
      return;
    }
    renderContestList();
  });

  document.addEventListener('click', (event) => {
    const reviewButton = event.target.closest('#viewAiReviewBtn');
    if (reviewButton && contestsState.selectedContest) {
      document.getElementById('aiContestReview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const exportButton = event.target.closest('[data-export]');
    if (exportButton) {
      handleExport(exportButton.dataset.export);
    }
  });

  const unsubscribe = stateManager.subscribe((state) => {
    if (!state.platforms.loading && state.profile.data && !contestsState.contests.length) {
      loadContestAnalytics();
      unsubscribe?.();
    }
  });

  const initialState = stateManager.getState();
  if (!initialState.platforms.loading && initialState.profile.data) {
    loadContestAnalytics();
    unsubscribe?.();
  }
});
