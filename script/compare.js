let compareData = null;
const compareCharts = {};
const lazyChartKeys = new Set();
const LAST_COMPARE_HANDLE_KEY = 'cpinsight:lastCompareHandle';

const COLORS = {
  current: '#10b981',
  compared: '#f43f5e',
  neutral: '#94a3b8',
  codeforces: '#10b981',
  codechef: '#f59e0b',
  leetcode: '#6366f1'
};

const DISTRIBUTION_COLORS = [
  'rgba(16, 185, 129, 0.78)',
  'rgba(14, 165, 233, 0.76)',
  'rgba(99, 102, 241, 0.78)'
];

const RATING_PLATFORMS = [
  { key: 'codeforces', label: 'Codeforces' },
  { key: 'codechef', label: 'CodeChef' },
  { key: 'leetcode', label: 'LeetCode' }
];

const PLATFORM_DONUT_THEME = {
  codeforces: {
    fill: 'rgba(16, 185, 129, 0.82)',
    hover: 'rgba(52, 211, 153, 0.96)',
    border: '#34d399',
    glow: 'rgba(16, 185, 129, 0.36)'
  },
  codechef: {
    fill: 'rgba(14, 165, 233, 0.78)',
    hover: 'rgba(56, 189, 248, 0.95)',
    border: '#38bdf8',
    glow: 'rgba(14, 165, 233, 0.32)'
  },
  leetcode: {
    fill: 'rgba(99, 102, 241, 0.82)',
    hover: 'rgba(129, 140, 248, 0.96)',
    border: '#818cf8',
    glow: 'rgba(99, 102, 241, 0.34)'
  }
};

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function fmt(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  if (typeof value === 'number') return `${Math.round(value)}${suffix}`;
  return `${value}${suffix}`;
}

function formatSignedNumber(value) {
  if (!value) return '0';
  return value > 0 ? `+${fmt(value)}` : fmt(value);
}

function titleCase(value) {
  return (value || '').replace(/(^|\s)\S/g, (text) => text.toUpperCase());
}

function showShell() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.classList.add('hidden');
  const main = document.getElementById('mainApp');
  if (main) main.classList.remove('blur-md', 'pointer-events-none');
}

function getRememberedCompareHandle() {
  return localStorage.getItem(LAST_COMPARE_HANDLE_KEY) || '';
}

function rememberCompareHandle(handle) {
  localStorage.setItem(LAST_COMPARE_HANDLE_KEY, handle);
}

function clearRememberedCompareHandle() {
  localStorage.removeItem(LAST_COMPARE_HANDLE_KEY);
}

function renderSidebar(state) {
  const profile = state.profile.data;
  if (!profile) {
    renderSidebarProfilePlaceholder();
    return;
  }
  const displayName = profile.user_profile?.display_name || profile.username || 'User';
  renderUnifiedSidebarProfile({
    name: displayName,
    avatarUrl: profile.user_profile?.avatar_thumbnail || profile.user_profile?.avatar_url || ''
  });
}

async function loadComparison(username) {
  const cleaned = username.trim();
  if (!cleaned) {
    setText('compareStatus', 'Enter a CPInsight username first.');
    return;
  }

  document.getElementById('emptyState')?.classList.add('hidden');
  document.getElementById('compareContent')?.classList.add('hidden');
  document.getElementById('loadingState')?.classList.remove('hidden');
  document.querySelectorAll('#compareContent .content-fade.show').forEach((el) => el.classList.remove('show'));
  setText('compareStatus', `Loading synced records for ${cleaned}...`);

  try {
    compareData = await httpClient.get(`/analytics/compare/${encodeURIComponent(cleaned)}`);
    document.getElementById('loadingState')?.classList.add('hidden');
    rememberCompareHandle(cleaned);

    if (compareData.noComparedPlatformData) {
      setText('compareStatus', compareData.message || 'No platform data available.');
      document.getElementById('emptyState')?.classList.remove('hidden');
      document.getElementById('emptyState').innerHTML = '<h2 class="text-2xl font-black text-white mb-2">No platform data available.</h2><p>The compared user exists but has not synced connected platforms yet.</p>';
      return;
    }

    renderComparison(compareData);
    setText('compareStatus', 'Comparison loaded from synced database records.');
  } catch (error) {
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.remove('hidden');
    document.getElementById('emptyState').innerHTML = `<h2 class="text-2xl font-black text-white mb-2">${error.message === 'Compared username not found' ? 'Compared username not found.' : 'Unable to load comparison.'}</h2><p class="text-gray-400">${error.message}</p>`;
    setText('compareStatus', error.message);
  }
}

function winnerLabel(winner, data = compareData) {
  if (winner === 'current') return data.users.current.displayName || data.users.current.username;
  if (winner === 'compared') return data.users.compared.displayName || data.users.compared.username;
  return 'Tie';
}

function numericRows(rows) {
  return (rows || []).filter((row) =>
    typeof row.current === 'number' &&
    typeof row.compared === 'number' &&
    Number.isFinite(row.current) &&
    Number.isFinite(row.compared)
  );
}

function normalizedDifference(row) {
  const scale = Math.max(Math.abs(row.current), Math.abs(row.compared), 1);
  return Math.abs(row.current - row.compared) / scale;
}

function buildSummaryInsights(data) {
  const rows = numericRows(data.overview.rows);
  const wins = data.overview.overallWinner || {};
  const currentWins = wins.current || 0;
  const comparedWins = wins.compared || 0;
  const totalDecided = currentWins + comparedWins;
  const overallKey = currentWins === comparedWins ? 'tie' : (currentWins > comparedWins ? 'current' : 'compared');
  const overallName = winnerLabel(overallKey, data);
  const biggest = rows
    .filter((row) => row.winner !== 'tie')
    .sort((a, b) => normalizedDifference(b) - normalizedDifference(a))[0];
  const closest = rows
    .filter((row) => row.current !== row.compared)
    .sort((a, b) => Math.abs(a.current - a.compared) - Math.abs(b.current - b.compared))[0];
  const similarity = rows.length
    ? Math.round((rows.reduce((sum, row) => sum + (1 - Math.min(1, normalizedDifference(row))), 0) / rows.length) * 100)
    : 0;

  return [
    {
      label: 'Overall Winner',
      value: overallName,
      detail: overallKey === 'tie' ? `${currentWins} / ${totalDecided || rows.length} metrics each` : `Wins ${Math.max(currentWins, comparedWins)} / ${totalDecided || rows.length} metrics`
    },
    {
      label: 'Biggest Advantage',
      value: biggest?.metric || '--',
      detail: biggest ? `${winnerLabel(biggest.winner, data)} (${formatSignedNumber(biggest.winner === 'current' ? biggest.current - biggest.compared : biggest.compared - biggest.current)})` : 'No difference'
    },
    {
      label: 'Closest Metric',
      value: closest?.metric || '--',
      detail: closest ? `Difference: ${fmt(Math.abs(closest.current - closest.compared))}` : 'No difference'
    },
    {
      label: 'Similarity',
      value: `${similarity}%`,
      detail: 'Across compared metrics'
    }
  ];
}

function createMatchupVsMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'matchup-vs-mark');
  svg.setAttribute('viewBox', '0 0 128 64');
  svg.setAttribute('aria-label', 'versus');
  svg.setAttribute('role', 'img');
  svg.innerHTML = `
    <defs>
      <linearGradient id="vsGreenPanel" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#6ee7b7" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
      <linearGradient id="vsRedPanel" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#fb7185" />
        <stop offset="100%" stop-color="#ef4444" />
      </linearGradient>
      <filter id="vsSoftShadow" x="-20%" y="-40%" width="140%" height="180%">
        <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#020617" flood-opacity="0.45" />
      </filter>
    </defs>
    <g filter="url(#vsSoftShadow)">
      <path d="M8 15 Q10 9 17 9 H64 L50 55 H16 Q9 55 8 48 Z" fill="url(#vsGreenPanel)" />
      <path d="M64 9 H112 Q119 9 121 16 L119 49 Q117 55 110 55 H50 Z" fill="url(#vsRedPanel)" />
      <path d="M69 3 L55 31 H68 L51 61 L58 37 H45 Z" fill="#f8fafc" />
      <path d="M70 3 L56 31 H69 L52 61 L59 37 H46 Z" fill="#dbeafe" opacity="0.5" />
    </g>
    <text x="38" y="39" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="900" fill="#052e2b" opacity="0.82">v</text>
    <text x="89" y="39" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="900" fill="#450a0a" opacity="0.82">s</text>
  `;
  return svg;
}

function renderOverview(data) {
  const current = data.users.current;
  const compared = data.users.compared;
  const matchupTitle = document.getElementById('matchupTitle');
  matchupTitle.replaceChildren();
  [
    { text: current.displayName, className: 'text-emerald-300' },
    { text: compared.displayName, className: 'text-red-400' }
  ].forEach((part, index) => {
    const span = document.createElement('span');
    span.className = part.className;
    span.textContent = part.text;
    if (index === 1) matchupTitle.append(createMatchupVsMark());
    matchupTitle.append(span);
  });
  setText('currentHeader', current.displayName);
  setText('comparedHeader', compared.displayName);

  const kpis = buildSummaryInsights(data);
  document.getElementById('kpiGrid').innerHTML = kpis.map((card) => `
    <div class="glass compare-card p-6 hover:-translate-y-1 transition content-fade">
      <p class="text-gray-400 text-xs uppercase font-bold tracking-wider">${card.label}</p>
      <h3 class="text-3xl font-black mt-2 text-white">${card.value}</h3>
      <p class="text-gray-400 text-sm mt-2">${card.detail}</p>
    </div>
  `).join('');

  document.getElementById('overviewTable').innerHTML = data.overview.rows.map((row) => `
    <tr class="winner-${row.winner} border-b border-white/5">
      <td class="py-4 px-3 font-bold">${row.metric}</td>
      <td class="py-4 px-3 font-bold text-emerald-300">${fmt(row.current)}</td>
      <td class="py-4 px-3 font-bold text-rose-300">${fmt(row.compared)}</td>
    </tr>
  `).join('');

  const wins = data.overview.overallWinner;
  setText('overallWinner', `${current.displayName} wins ${wins.current || 0} metrics | ${compared.displayName} wins ${wins.compared || 0} metrics | ${wins.tie || 0} ties`);
  requestAnimationFrame(() => {
    document.querySelectorAll('#kpiGrid .content-fade').forEach((el) => el.classList.add('show'));
  });
}

function createLazyChart(key, element, draw) {
  lazyChartKeys.add(key);
  const observer = new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting || !lazyChartKeys.has(key)) return;
    draw();
    lazyChartKeys.delete(key);
    obs.disconnect();
  }, { threshold: 0.15 });
  observer.observe(element);
}

function platformKeyFromTitle(title = '') {
  const normalized = title.toLowerCase().replace(/\s+/g, '');
  return RATING_PLATFORMS.find((platform) => normalized.includes(platform.key))?.key || normalized;
}

function normalizeRatingComparisonCharts(charts = []) {
  const chartByPlatform = (charts || []).reduce((map, chart) => {
    map[platformKeyFromTitle(chart.title)] = chart;
    return map;
  }, {});

  return RATING_PLATFORMS.map((platform) => ({
    title: `${platform.label} Rating`,
    current: [],
    compared: [],
    ...chartByPlatform[platform.key],
    platform: platform.key
  }));
}

function renderRatingCharts(data) {
  const container = document.getElementById('ratingCharts');
  const charts = normalizeRatingComparisonCharts(data.ratingComparison);
  if (!charts.length) {
    container.innerHTML = '<div class="glass compare-card p-8 text-center text-gray-400">No contest rating history available for common platforms.</div>';
    return;
  }

  container.innerHTML = charts.map((chart, index) => `
    <div class="glass compare-card section-shell p-7">
      <div class="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 class="font-black text-xl">${chart.title}</h3>
          <p class="text-gray-400 text-sm">${normalizeChartPoints([...chart.current, ...chart.compared]).length ? 'Zoom, pan, and hover for contest detail.' : 'No contest appearances yet.'}</p>
        </div>
        <button class="metric-pill px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-white/10 transition" onclick="resetCompareChart('rating${index}')">Reset</button>
      </div>
      <div class="chart-box rating-chart-box relative"><canvas id="ratingChart${index}" class="absolute inset-0"></canvas></div>
    </div>
  `).join('');

  charts.forEach((chart, index) => {
    const canvas = document.getElementById(`ratingChart${index}`);
    createLazyChart(`rating${index}`, canvas.parentElement, () => drawRatingChart(`rating${index}`, canvas, chart, data));
  });
}

function normalizeChartPoints(points) {
  return (points || [])
    .filter((point) => typeof point.rating === 'number' && point.participatedAt)
    .map((point) => ({ ...point, timestamp: new Date(point.participatedAt).getTime() }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function drawRatingChart(key, canvas, chart, data) {
  const current = normalizeChartPoints(chart.current);
  const compared = normalizeChartPoints(chart.compared);
  const hasContestPoints = current.length || compared.length;
  const labels = hasContestPoints
    ? Array.from(new Set([...current, ...compared].map((point) => new Date(point.timestamp).toLocaleDateString())))
    : ['No contests'];
  const ratings = [...current, ...compared].map((point) => point.rating).filter(Number.isFinite);
  const minRating = ratings.length ? Math.min(...ratings) : 0;
  const maxRating = ratings.length ? Math.max(...ratings) : 3000;
  const padding = Math.max(80, Math.round((maxRating - minRating) * 0.16));

  function areaFill(color) {
    const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, canvas.parentElement?.clientHeight || 260);
    gradient.addColorStop(0, `${color}40`);
    gradient.addColorStop(0.55, `${color}18`);
    gradient.addColorStop(1, `${color}04`);
    return gradient;
  }

  function dataset(label, points, color) {
    const byLabel = points.reduce((map, point) => {
      map[new Date(point.timestamp).toLocaleDateString()] = point;
      return map;
    }, {});
    return {
      label,
      data: labels.map((labelText) => byLabel[labelText]?.rating ?? null),
      borderColor: color,
      backgroundColor: areaFill(color),
      fill: 'origin',
      tension: 0.42,
      spanGaps: true,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHitRadius: 14,
      metaPoints: labels.map((labelText) => byLabel[labelText] || null)
    };
  }

  compareCharts[key] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        dataset(data.users.current.displayName, current, COLORS.current),
        dataset(data.users.compared.displayName, compared, COLORS.compared)
      ].filter((item) => item.data.some((value) => value !== null))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 20, bottom: 8, left: 8 } },
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          align: 'center',
          labels: {
            color: '#d1d5db',
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 18
          }
        },
        zoom: { zoom: { wheel: { enabled: true, speed: 0.05 }, pinch: { enabled: true }, mode: 'x' }, pan: { enabled: true, mode: 'x' } },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.96)',
          enabled: Boolean(hasContestPoints),
          callbacks: {
            afterLabel(context) {
              const point = context.dataset.metaPoints?.[context.dataIndex];
              return point ? [`${point.contestName || 'Contest'}`, `Delta: ${fmt(point.delta)}`, `Rank: ${fmt(point.rank)}`] : '';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,0.045)' }
        },
        y: {
          stacked: false,
          suggestedMin: Math.max(0, minRating - padding),
          suggestedMax: maxRating + padding,
          ticks: {
            color: '#9ca3af',
            maxTicksLimit: 6,
            padding: 10
          },
          grid: { color: 'rgba(255,255,255,0.045)' }
        }
      }
    }
  });
}

function heatColor(item) {
  if (!item.current && !item.compared) return '#2b2b2b';
  if (item.difference === 0) return '#3b82f6';
  const ratio = Math.min(1, Math.max(0, Math.abs(item.difference) - 1) / 14);
  const alpha = 0.2 + ratio * 0.75;
  return item.difference > 0 ? `rgba(16,185,129,${alpha})` : `rgba(244,63,94,${alpha})`;
}

function renderHeatmap(data) {
  const heatmap = document.getElementById('compareHeatmap');
  const payload = data.heatmapComparison;
  const days = payload.days.slice(-370);
  const daysByDate = days.reduce((map, item) => {
    map[item.date] = item;
    return map;
  }, {});

  HeatmapRenderer.renderMonthlyGrid({
    container: heatmap,
    selectedYear: 'all',
    dataByDate: daysByDate,
    getColor(item) {
      return heatColor(item || { current: 0, compared: 0, difference: 0, winner: 'tie' });
    },
    getTitle(item, { key }) {
      const day = item || { date: key, current: 0, compared: 0, difference: 0, winner: 'tie' };
      return `${key}
${data.users.current.displayName}: ${day.current} submissions
${data.users.compared.displayName}: ${day.compared} submissions
Difference: ${Math.abs(day.difference)}
Winner: ${winnerLabel(day.winner, data)}`;
    }
  });

  const stats = [
    [`${data.users.current.displayName} Active Days`, payload.stats.currentActiveDays],
    [`${data.users.compared.displayName} Active Days`, payload.stats.comparedActiveDays],
    ['Longest Streak', `${payload.stats.longestStreak} days`],
    ['Most Active Month', payload.stats.mostActiveMonth || '--']
  ];
  document.getElementById('heatmapStats').innerHTML = stats.map(([label, value]) => `
    <div class="bg-black/20 border border-white/5 rounded-2xl p-4">
      <p class="text-gray-400 text-xs uppercase font-bold tracking-wider">${label}</p>
      <p class="text-2xl font-black mt-1">${value}</p>
    </div>
  `).join('');
}

function drawSkillChart(data) {
  const canvas = document.getElementById('skillRadar');
  compareCharts.skill = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: data.skillComparison.axes,
      datasets: [
        {
          label: data.users.current.displayName,
          data: data.skillComparison.current.map((item) => item.score),
          backgroundColor: 'rgba(16,185,129,0.18)',
          borderColor: COLORS.current,
          pointBackgroundColor: COLORS.current
        },
        {
          label: data.users.compared.displayName,
          data: data.skillComparison.compared.map((item) => item.score),
          backgroundColor: 'rgba(244,63,94,0.16)',
          borderColor: COLORS.compared,
          pointBackgroundColor: COLORS.compared
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200 },
      scales: { r: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.08)' }, angleLines: { color: 'rgba(255,255,255,0.08)' }, ticks: { display: false }, pointLabels: { color: '#d1d5db' } } },
      plugins: {
        legend: { labels: { color: '#d1d5db' } },
        tooltip: {
          callbacks: {
            afterLabel(context) {
              const source = context.datasetIndex === 0 ? data.skillComparison.current : data.skillComparison.compared;
              const item = source[context.dataIndex];
              return [`Solved: ${item.solved}`, `Success Rate: ${item.successRate}%`];
            }
          }
        }
      }
    }
  });
}

function drawProblemChart(data) {
  const canvas = document.getElementById('problemBars');
  compareCharts.problem = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.problemSolving.buckets,
      datasets: [
        { label: data.users.current.displayName, data: data.problemSolving.current.buckets.map((item) => item.count), backgroundColor: COLORS.current, borderRadius: 5 },
        { label: data.users.compared.displayName, data: data.problemSolving.compared.buckets.map((item) => item.count), backgroundColor: COLORS.compared, borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200 },
      plugins: { legend: { labels: { color: '#d1d5db' } }, tooltip: { backgroundColor: 'rgba(17,24,39,0.96)' } },
      scales: {
        x: { ticks: { color: '#d1d5db' }, grid: { display: false } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderProblemStats(data) {
  const metrics = [
    ['Highest Solved Rating', 'highestSolvedRating'],
    ['Average Solved Rating', 'averageSolvedRating'],
    ['Median Solved Rating', 'medianSolvedRating'],
    ['Average Hardest 10', 'averageHardest10SolvedRatings']
  ];
  document.getElementById('problemStats').innerHTML = metrics.map(([label, key]) => `
    <div class="bg-black/20 border border-white/5 rounded-2xl p-4">
      <p class="text-gray-400 text-xs uppercase font-bold">${label}</p>
      <div class="mt-2 flex items-center justify-between gap-3">
        <span class="text-emerald-400 font-black">${fmt(data.problemSolving.current[key])}</span>
        <span class="text-gray-500">vs</span>
        <span class="text-rose-400 font-black">${fmt(data.problemSolving.compared[key])}</span>
      </div>
    </div>
  `).join('');
}

function contestValue(value) {
  if (!value || typeof value !== 'object') return fmt(value);
  if (value.contestName) {
    const detail = value.ratingGain ?? value.ratingLoss ?? value.score;
    return `${value.contestName} (${fmt(detail)})`;
  }
  return '--';
}

function renderContest(data) {
  const current = data.contestIntelligence.current;
  const compared = data.contestIntelligence.compared;
  const cards = [
    ['Best Contest', current.bestContest, compared.bestContest],
    ['Worst Contest', current.worstContest, compared.worstContest],
    ['Average Rank', current.averageRank, compared.averageRank],
    ['Rating Volatility', current.ratingVolatility, compared.ratingVolatility]
  ];
  document.getElementById('contestCards').innerHTML = cards.map(([label, left, right]) => `
    <div class="bg-black/25 border border-white/5 rounded-lg p-4">
      <p class="text-gray-400 text-xs uppercase font-bold tracking-wider">${label}</p>
      <p class="text-emerald-300 text-sm mt-3">${contestValue(left)}</p>
      <p class="text-rose-300 text-sm mt-2">${contestValue(right)}</p>
    </div>
  `).join('');

  document.getElementById('contestRows').innerHTML = data.contestIntelligence.rows.map((row) => `
    <div class="winner-${row.winner} rounded-2xl p-4 border border-white/5">
      <div class="flex items-center justify-between gap-4">
        <p class="font-black">${row.metric}</p>
        <p class="text-sm text-gray-300">${row.label}: <span class="font-black text-white">${winnerLabel(row.winner, data)}</span></p>
      </div>
    </div>
  `).join('');
}

function getDistributionTheme(platform, index = 0) {
  const key = (platform || '').toLowerCase();
  const fallback = DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length];
  return PLATFORM_DONUT_THEME[key] || {
    fill: fallback,
    hover: fallback.replace(/,\s*[\d.]+\)$/, ', 0.95)'),
    border: '#a7f3d0',
    glow: fallback.replace(/,\s*[\d.]+\)$/, ', 0.3)')
  };
}

function drawDonut(key, canvas, rows) {
  const total = rows.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const centerTextPlugin = {
    id: `${key}CenterText`,
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 22px Inter, system-ui, sans-serif';
      ctx.fillText(total.toLocaleString(), centerX, centerY - 6);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillText('SUBMISSIONS', centerX, centerY + 15);
      ctx.restore();
    }
  };

  compareCharts[key] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map((item) => titleCase(item.platform)),
      datasets: [{
        data: rows.map((item) => item.count),
        backgroundColor: rows.map((item, index) => getDistributionTheme(item.platform, index).fill),
        hoverBackgroundColor: rows.map((item, index) => getDistributionTheme(item.platform, index).hover),
        borderColor: rows.map((item, index) => getDistributionTheme(item.platform, index).border),
        hoverBorderColor: rows.map((item, index) => getDistributionTheme(item.platform, index).border),
        borderWidth: 2,
        borderRadius: 8,
        spacing: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      rotation: -115,
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1800,
        easing: 'easeOutQuart'
      },
      animations: {
        circumference: {
          duration: 1700,
          easing: 'easeOutQuart',
          from: 0,
          delay(context) {
            return context.type === 'data' ? context.dataIndex * 140 : 0;
          }
        },
        outerRadius: {
          duration: 820,
          easing: 'easeOutQuart',
          from: 0,
          delay(context) {
            return context.type === 'data' ? 140 + context.dataIndex * 100 : 0;
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#dbeafe',
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 18,
            font: { family: 'Inter', weight: 700 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(7, 11, 23, 0.96)',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          titleColor: '#f8fafc',
          bodyColor: '#dbeafe',
          displayColors: true,
          callbacks: {
            label(context) {
              const item = rows[context.dataIndex];
              return ` ${context.label}: ${item.count} submissions (${item.percentage}%)`;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}

function renderPieTable(id, rows) {
  document.getElementById(id).innerHTML = rows.map((item, index) => {
    const theme = getDistributionTheme(item.platform, index);
    return `
    <div class="distribution-row flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style="--platform-glow: ${theme.glow}; --platform-border: ${theme.border};">
      <span class="font-bold inline-flex items-center gap-3">
        <span class="distribution-swatch" style="background: ${theme.fill}; box-shadow: 0 0 18px ${theme.glow};"></span>
        ${titleCase(item.platform)}
      </span>
      <span class="text-gray-300">${item.count} submissions <span class="text-sky-200">|</span> ${item.percentage}%</span>
    </div>
  `;
  }).join('');
}

function renderDistribution(data) {
  setText('currentPieTitle', `${data.users.current.displayName} Distribution`);
  setText('comparedPieTitle', `${data.users.compared.displayName} Distribution`);
  renderPieTable('currentPieTable', data.platformDistribution.current);
  renderPieTable('comparedPieTable', data.platformDistribution.compared);
  createLazyChart('currentPie', document.getElementById('currentPie').parentElement, () => drawDonut('currentPie', document.getElementById('currentPie'), data.platformDistribution.current));
  createLazyChart('comparedPie', document.getElementById('comparedPie').parentElement, () => drawDonut('comparedPie', document.getElementById('comparedPie'), data.platformDistribution.compared));
}

function renderComparison(data) {
  Object.values(compareCharts).forEach((chart) => chart.destroy());
  Object.keys(compareCharts).forEach((key) => delete compareCharts[key]);
  lazyChartKeys.clear();

  document.getElementById('compareContent')?.classList.remove('hidden');
  renderOverview(data);
  renderRatingCharts(data);
  renderHeatmap(data);
  renderProblemStats(data);
  renderContest(data);
  renderDistribution(data);

  createLazyChart('skill', document.getElementById('skillRadar').parentElement, () => drawSkillChart(data));
  createLazyChart('problem', document.getElementById('problemBars').parentElement, () => drawProblemChart(data));
  initRevealAnimations();
}

function resetCompareChart(key) {
  compareCharts[key]?.resetZoom?.();
}

document.addEventListener('DOMContentLoaded', () => {
  showShell();
  initRevealAnimations();
  renderSidebar(stateManager.getState());
  stateManager.subscribe(renderSidebar);

  if (typeof authService !== 'undefined' && !authService.isLoggedIn()) {
    clearRememberedCompareHandle();
    return;
  }

  const rememberedHandle = getRememberedCompareHandle();
  if (rememberedHandle) {
    const input = document.getElementById('compareUsername');
    if (input) input.value = rememberedHandle;
    loadComparison(rememberedHandle);
  }

  document.getElementById('compareForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadComparison(document.getElementById('compareUsername')?.value || '');
  });
});

window.addEventListener('auth:logout', clearRememberedCompareHandle);

window.resetCompareChart = resetCompareChart;
