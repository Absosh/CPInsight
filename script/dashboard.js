let ratingChartInstance = null;
let sparkInstances = {};
let currentRows = [];
let currentSort = { column: 'date', asc: false };
let lastAnalyticsKey = null;
let isRendering = false;
let selectedHeatmapYear = 'all';

const CHART_COLORS = ['#10b981', '#6366f1', '#a855f7', '#f59e0b', '#0ea5e9', '#f43f5e'];
const visualizationReady = window.CPVisualization
    ? Promise.resolve(window.CPVisualization)
    : new Promise((resolve) => {
        window.addEventListener('cpinsight:visualization-ready', (event) => resolve(event.detail), { once: true });
    });

const KPI_CARD_IDS = {
    current: 'kpiCardCurrent',
    max: 'kpiCardMax',
    change: 'kpiCardChange',
    focus: 'kpiCardFocus',
    accepted: 'kpiCardAccepted',
    submissions: 'kpiCardSubmissions',
    contests: 'kpiCardContests',
    solved: 'kpiCardSolved'
};

function resolveDashboardLayout(selectedPlatforms = []) {
    const platforms = selectedPlatforms.filter(Boolean);
    const singlePlatform = platforms.length === 1;
    const platform = singlePlatform ? platforms[0] : 'combined';

    if (singlePlatform) {
        return {
            mode: 'single',
            platform,
            kpiCards: ['current', 'max', 'contests', 'solved'],
            labels: {
                current: 'Current Rating',
                max: 'Max Rating',
                contests: 'Contest Count',
                solved: 'Problems Solved'
            },
            ratingPlatforms: [platform],
            showRecentSubmissions: true,
            heatmapMode: 'cumulative'
        };
    }

    return {
        mode: 'combined',
        platform: 'combined',
        kpiCards: ['current', 'max', 'contests', 'solved'],
        labels: {
            current: 'CPInsight Score',
            max: 'Maximum Rating',
            contests: 'Contest Count',
            solved: 'Problems Solved'
        },
        ratingPlatforms: platforms,
        showRecentSubmissions: true,
        heatmapMode: 'cumulative'
    };
}

function animateSkeletons() {
    document.querySelectorAll('.skeleton').forEach((skeleton) => {
        const speed = (Math.random() * 1.5 + 1.8).toFixed(2);
        const delay = (Math.random() * 2).toFixed(2);
        skeleton.style.setProperty('--speed', `${speed}s`);
        skeleton.style.setProperty('--delay', `-${delay}s`);
    });
}

function showDashboardApp() {
    const mainApp = document.getElementById('mainApp');

    if (mainApp) {
        mainApp.classList.remove('blur-md', 'pointer-events-none');
    }
}

function capitalize(value) {
    if (!value) return '';
    return value
        .toString()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPlatformColor(platform) {
    const key = (platform || 'combined').toString();
    let hash = 0;

    for (let i = 0; i < key.length; i += 1) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0;
    }

    return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

function getActivePlatforms(state) {
    const { accounts, selectedPlatforms } = state.platforms;
    
    // Return selected platforms that are actually connected
    if (selectedPlatforms && selectedPlatforms.length > 0) {
        return selectedPlatforms.filter(p => 
            accounts.some(a => a.platform === p)
        );
    }
    
    // Fallback to all connected accounts
    return accounts.map((account) => account.platform);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function showMetricValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function updateSortIcons() {
    setText('rankSortIcon', currentSort.column === 'rank' ? (currentSort.asc ? '▲' : '▼') : '▲▼');
    setText('newRatingSortIcon', currentSort.column === 'newRating' ? (currentSort.asc ? '▲' : '▼') : '▲▼');
    setText('changeSortIcon', currentSort.column === 'change' ? (currentSort.asc ? '▲' : '▼') : '▲▼');
}

function destroyCharts() {
    if (ratingChartInstance) {
        ratingChartInstance.destroy?.();
        ratingChartInstance = null;
    }

    Object.values(sparkInstances).forEach((instance) => instance.destroy());
    sparkInstances = {};

}

function resetVisualState() {
    destroyCharts();
    const el = (id) => {
        const el = document.getElementById(id);
        return el;
    };
    
    el('contestTable')?.innerHTML && (el('contestTable').innerHTML = '');
    el('chartLoader')?.classList.remove('hidden');
    el('ratingChart')?.classList.add('hidden');
    el('resetZoomBtn')?.classList.add('hidden');
    el('heatmapLoader')?.classList.remove('hidden');
    el('heatmapContainer')?.classList.add('hidden');
    el('heatmap')?.innerHTML && (el('heatmap').innerHTML = '');
    el('monthLabels')?.innerHTML && (el('monthLabels').innerHTML = '');
    animateSkeletons();
}

function renderSidebarProfile(profile, activePlatforms) {
    const displayName = profile?.user_profile?.display_name || profile?.username || 'User';
    const subtitle = activePlatforms.length
        ? `Tracking ${activePlatforms.map(capitalize).join(', ')}`
        : 'Connect a platform to begin';

    setText('username', displayName);
    setText('rank', subtitle);

    const loader = document.getElementById('profileLoader');
    const userDisplay = document.getElementById('userDisplay');
    const image = document.getElementById('profileImage');

    if (profile?.user_profile?.avatar_url) {
        image.src = profile.user_profile.avatar_url;
        image.classList.remove('hidden');
    } else {
        image.classList.add('hidden');
    }

    loader.classList.add('hidden');
    userDisplay.classList.remove('hidden');
}

function updateMetricLabels(layout) {
    const labels = layout.labels || {};

    setText('currentMiniLabel', layout.mode === 'combined' ? 'CP Score' : 'Current');
    setText('maxMiniLabel', layout.mode === 'combined' ? 'Max' : 'Max');
    setText('currentMetricLabel', labels.current || 'Current Rating');
    setText('maxMetricLabel', labels.max || 'Max Rating');
    setText('changeMetricLabel', 'Recent Change');
    setText('focusMetricLabel', labels.focus || 'Active Streak');
    setText('acceptedMetricLabel', 'Accepted Subs');
    setText('submissionsMetricLabel', 'Total Subs');
    setText('contestCountLabel', labels.contests || 'Contest Count');
    setText('solvedMetricLabel', labels.solved || 'Solved Problems');
    setText('secondaryColumnLabel', 'Platform');
    setText('previousRatingLabel', 'Previous');
    setText('newRatingLabel', 'New');
}

function applyKpiLayout(layout) {
    const visibleCards = new Set(layout.kpiCards || []);

    Object.entries(KPI_CARD_IDS).forEach(([key, id]) => {
        const card = document.getElementById(id);
        if (!card) return;
        card.classList.toggle('hidden', !visibleCards.has(key));
    });
}

function formatSignedNumber(value) {
    if (!value) return '0';
    return value > 0 ? `+${value}` : `${value}`;
}

function hasAnalyticsData(analytics) {
    return Boolean(
        (analytics.ratingProgression && analytics.ratingProgression.length) ||
        (analytics.topicStrength && analytics.topicStrength.length) ||
        (analytics.totalSubmissions && analytics.totalSubmissions > 0) ||
        (analytics.solvedProblems && analytics.solvedProblems > 0) ||
        (analytics.acceptedSubmissions && analytics.acceptedSubmissions > 0)
    );
}

function parseDateKey(dayKey) {
    // Keep date parsing stable across timezones.
    return new Date(`${dayKey}T00:00:00`);
}

function toDateKey(date) {
    return date.toISOString().slice(0, 10);
}

function buildAcceptedDaySet(activityHeatmap, cutoffDate = null) {
    const days = new Set();
    Object.entries(activityHeatmap || {}).forEach(([day, count]) => {
        if (!count || count <= 0) return;
        const parsed = parseDateKey(day);
        if (Number.isNaN(parsed.getTime())) return;
        if (cutoffDate && parsed < cutoffDate) return;
        days.add(day);
    });
    return days;
}

function computeMaxStreak(daySet) {
    if (!daySet || daySet.size === 0) return 0;

    let maxStreak = 0;
    daySet.forEach((day) => {
        const d = parseDateKey(day);
        const prev = new Date(d);
        prev.setDate(prev.getDate() - 1);

        // Start counting only at streak starts.
        if (daySet.has(toDateKey(prev))) return;

        let streak = 1;
        const cursor = new Date(d);
        while (true) {
            cursor.setDate(cursor.getDate() + 1);
            const nextKey = toDateKey(cursor);
            if (!daySet.has(nextKey)) break;
            streak += 1;
        }

        if (streak > maxStreak) maxStreak = streak;
    });

    return maxStreak;
}

function computeStreakMetrics(activityHeatmap) {
    const now = new Date();
    const yearCutoff = new Date(now);
    yearCutoff.setDate(yearCutoff.getDate() - 364);

    const monthCutoff = new Date(now);
    monthCutoff.setDate(monthCutoff.getDate() - 29);

    const allDays = buildAcceptedDaySet(activityHeatmap);
    const yearDays = buildAcceptedDaySet(activityHeatmap, yearCutoff);
    const monthDays = buildAcceptedDaySet(activityHeatmap, monthCutoff);

    return {
        maxStreak: computeMaxStreak(allDays),
        yearStreak: computeMaxStreak(yearDays),
        monthStreak: computeMaxStreak(monthDays)
    };
}

function computeRecentChange(ratingProgression) {
    if (!ratingProgression || ratingProgression.length === 0) {
        return 0;
    }

    const lastPoint = ratingProgression[ratingProgression.length - 1];
    if (typeof lastPoint.delta === 'number') {
        return lastPoint.delta;
    }

    if (ratingProgression.length === 1) {
        return 0;
    }

    return (lastPoint.rating || 0) - (ratingProgression[ratingProgression.length - 2].rating || 0);
}

function createSparkline(id, data, color) {
    if (sparkInstances[id]) sparkInstances[id].destroy();

    const ctx = document.getElementById(id);
    if (!ctx) return;

    sparkInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, index) => index + 1),
            datasets: [{
                data,
                borderColor: color,
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

function resetChartZoom() {
    if (ratingChartInstance) {
        ratingChartInstance.resetView?.();
    }
}

async function createChart(points, layout) {
    if (ratingChartInstance) ratingChartInstance.destroy?.();

    const chart = document.getElementById('ratingChart');
    if (!chart) return;
    const allowedPlatforms = new Set(layout?.ratingPlatforms || []);
    const normalizedPoints = points
        .map((point) => ({
            ...point,
            platform: point.platform || layout?.platform || 'combined',
            timestamp: point.participatedAt ? new Date(point.participatedAt).getTime() : null
        }))
        .filter((point) => typeof point.rating === 'number')
        .filter((point) => !allowedPlatforms.size || allowedPlatforms.has(point.platform))
        .filter((point) => Number.isFinite(point.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);

    if (!normalizedPoints.length) {
        document.getElementById('chartLoader')?.classList.add('hidden');
        renderEmptyState('ratingChart', 'No contest history available', 'Contest performance will appear here once synced.', '📈');
        return;
    }

    const labels = Array.from(new Set(
        normalizedPoints.map((point) => new Date(point.timestamp).toLocaleDateString())
    ));
    const platforms = Array.from(new Set(normalizedPoints.map((point) => point.platform)));
    const pointsByPlatform = platforms.reduce((map, platform) => {
        map[platform] = normalizedPoints.filter((point) => point.platform === platform);
        return map;
    }, {});

    const datasets = platforms.map((platform) => {
        const platformPoints = pointsByPlatform[platform];
        const valuesByLabel = platformPoints.reduce((map, point) => {
            const label = new Date(point.timestamp).toLocaleDateString();
            map[label] = point;
            return map;
        }, {});
        const color = getPlatformColor(platform);

        return {
            label: capitalize(platform),
            data: labels.map((label) => valuesByLabel[label]?.rating ?? null),
            borderColor: color,
            backgroundColor: `${color}22`,
            borderWidth: 3,
            tension: 0.35,
            fill: false,
            spanGaps: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHitRadius: 14,
            metaPoints: labels.map((label) => valuesByLabel[label] || null)
        };
    });

    const rows = labels.map((label, index) => {
        const sourcePoint = datasets
            .map((dataset) => dataset.metaPoints?.[index])
            .find(Boolean);

        return {
            key: sourcePoint?.contestName || label,
            label,
            date: label,
            contestName: sourcePoint?.contestName || 'Contest',
            platform: sourcePoint?.platform || layout?.platform || 'combined',
            value: sourcePoint?.rating ?? null,
            rating: sourcePoint?.rating ?? null,
            delta: sourcePoint?.delta ?? 0,
            rank: sourcePoint?.rank ?? null
        };
    });

    const engine = await visualizationReady;
    if (!engine) return;

    ratingChartInstance = engine.createVisualizationLab(chart, {
        id: 'dashboard-rating-progression',
        title: 'Rating Progression',
        group: 'contestProgress',
        types: ['line', 'area', 'bar', 'timeline', 'candlestick', 'table'],
        defaultType: 'line',
        scope: 'contest',
        entityType: 'contest',
        data: {
            labels,
            rows,
            datasets: datasets.map((dataset) => ({
                name: dataset.label,
                values: dataset.data
            }))
        }
    });

    document.getElementById('chartLoader').classList.add('hidden');
    document.getElementById('ratingChart').classList.remove('hidden');
    document.getElementById('resetZoomBtn')?.classList.remove('hidden');
}

function renderHeatmap(activityHeatmap) {
    const heatmap = document.getElementById('heatmap');
    const monthLabels = document.getElementById('monthLabels');

    if (!heatmap || !monthLabels) {
        return;
    }

    if (selectedHeatmapYear !== 'all' && !Number.isFinite(Number(selectedHeatmapYear))) {
        selectedHeatmapYear = 'all';
        return renderHeatmap(activityHeatmap);
    }

    if (monthLabels) monthLabels.innerHTML = '';
    const visibleKeys = HeatmapRenderer.visibleDateKeys(selectedHeatmapYear);
    const maxCount = Math.max(0, ...visibleKeys.map((key) => Number(activityHeatmap?.[key] || 0)));

    HeatmapRenderer.renderMonthlyGrid({
        container: heatmap,
        selectedYear: selectedHeatmapYear,
        dataByDate: activityHeatmap || {},
        getColor(count) {
            if (!count || count <= 0) return '#2b2b2b';
            if (maxCount <= 1) return '#0e4429';

            const ratio = count / maxCount;
            if (ratio <= 0.25) return '#0e4429';
            if (ratio <= 0.5) return '#006d32';
            if (ratio <= 0.75) return '#26a641';
            return '#39d353';
        },
        getTitle(count, { key }) {
            return `${key} : ${count || 0} accepted submissions`;
        }
    });

    document.getElementById('heatmapLoader')?.classList.add('hidden');
    document.getElementById('heatmapContainer')?.classList.remove('hidden');
}

function populateHeatmapYearSelector(activityHeatmap) {
    const select = document.getElementById('heatmapYearSelect');
    if (!select) return;

    const years = Array.from(new Set(
        Object.keys(activityHeatmap || {})
            .map((day) => Number(day.slice(0, 4)))
            .filter((year) => Number.isFinite(year))
    )).sort((a, b) => b - a);

    const currentValue = selectedHeatmapYear;
    const options = ['<option value="all">All Time</option>']
        .concat(years.map((year) => `<option value="${year}">${year}</option>`));

    select.innerHTML = options.join('');

    if (currentValue !== 'all' && years.includes(Number(currentValue))) {
        select.value = currentValue;
    } else {
        selectedHeatmapYear = 'all';
        select.value = 'all';
    }
}

function renderRecentSubmissions(submissions, visible = true) {
    const section = document.getElementById('recentSubmissionsSection');
    const list = document.getElementById('recentSubmissionsList');
    if (!section || !list) return;

    if (!visible) {
        section.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    const rows = Array.isArray(submissions)
        ? submissions
        : [];
    if (!rows.length) {
        section.classList.remove('hidden');
        list.innerHTML = '<p class="text-gray-400">Recent accepted submissions will appear here after sync.</p>';
        return;
    }

    section.classList.remove('hidden');

    list.innerHTML = rows.slice(0, 20).map((item) => {
        const submitted = item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '--';
        const platform = capitalize(item.platform || 'Platform');
        const verdict = item.verdict || 'AC';
        const problemUrl = item.problemUrl || item.url || '#';
        const linkAttrs = problemUrl === '#'
            ? ''
            : 'target="_blank" rel="noopener noreferrer"';
        return `
            <a href="${problemUrl}" ${linkAttrs} class="block glass rounded-2xl p-4 border border-white/5 hover:border-emerald-500/40 hover:bg-white/5 transition">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-semibold text-white truncate">${item.problemName || item.problemKey || 'Problem'}</p>
                        <p class="text-sm text-gray-400 truncate">${platform} • ${submitted}</p>
                    </div>
                    <span class="text-sm font-bold ${verdict === 'AC' ? 'text-emerald-400' : 'text-gray-300'}">${verdict}</span>
                </div>
            </a>
        `;
    }).join('');
}

function renderContestTable() {
    const table = document.getElementById('contestTable');
    if (!table) {
        return;
    }

    table.innerHTML = '';

    if (!currentRows.length) {
        table.innerHTML = '<tr><td colspan="6" class="py-6 text-gray-400">No rating progression available yet.</td></tr>';
        return;
    }

    currentRows.forEach((row, index) => {
        table.innerHTML += `
            <tr class="border-b border-white/5 hover:bg-white/5 transition table-row-animate" style="animation-delay: ${index * 0.02}s">
                <td class="py-4 pr-4 font-medium">${row.contestName}</td>
                <td class="py-4 pr-4">${capitalize(row.platform || 'combined')}</td>
                <td class="py-4 pr-4">${row.rank ?? '--'}</td>
                <td class="py-4 pr-4">${row.oldRating ?? '--'}</td>
                <td class="py-4 pr-4">${row.newRating ?? '--'}</td>
                <td class="py-4 ${row.change >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">${formatSignedNumber(row.change)}</td>
            </tr>
        `;
    });
}

function sortTable(column) {
    if (!['change', 'newRating', 'rank'].includes(column)) {
        return;
    }

    const scrollContainer = document.getElementById('contestTable')?.closest('.overflow-y-auto');
    const scrollTop = scrollContainer?.scrollTop || 0;

    if (currentSort.column === column) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort = { column, asc: true };
    }

    currentRows.sort((a, b) => {
        const valueA = Number(a[column] || 0);
        const valueB = Number(b[column] || 0);
        return currentSort.asc ? valueA - valueB : valueB - valueA;
    });

    updateSortIcons();
    renderContestTable();
    if (scrollContainer) {
        scrollContainer.scrollTop = scrollTop;
    }
}

function renderSummaryStats(analytics, activePlatforms, layout) {
    const ratingProgression = analytics.ratingProgression.filter((point) => typeof point.rating === 'number');
    const hasData = hasAnalyticsData(analytics);
    const singlePlatform = layout.mode === 'single';
    const currentValue = singlePlatform ? analytics.currentRating : analytics.cpInsightScore;
    const maxValue = analytics.maxRating ?? (ratingProgression.length ? Math.max(...ratingProgression.map((point) => point.rating || 0)) : null);
    const recentChange = computeRecentChange(ratingProgression);
    const focusValue = `${analytics.streak || 0}d`;

    applyKpiLayout(layout);
    updateMetricLabels(layout);

    const currentLoader = document.getElementById('currentRatingLoader');
    const maxLoader = document.getElementById('maxRatingLoader');
    currentLoader.classList.add('hidden');
    maxLoader.classList.add('hidden');
    document.getElementById('currentRating').classList.remove('hidden');
    document.getElementById('maxRating').classList.remove('hidden');

    if (!hasData) {
        showMetricValue('currentRating', '--');
        showMetricValue('mainRating', '--');
        showMetricValue('maxRating', '--');
        showMetricValue('mainMaxRating', '--');
        showMetricValue('monthChange', 'Sync pending');
        showMetricValue('globalRank', 'Pending');
        showMetricValue('topPercent', '--');
        showMetricValue('avgPerDay', '--');
        showMetricValue('contestCount', '--');
        showMetricValue('activeDays', '--');
        createSparkline('sparkCurrent', [0], '#10b981');
        createSparkline('sparkMax', [0], '#6366f1');
        createSparkline('sparkChange', [0], '#a855f7');
        createSparkline('sparkRank', [0], '#0ea5e9');
        return;
    }

    if (typeof currentValue === 'number') {
        showMetricValue('currentRating', `${currentValue}`);
        showMetricValue('mainRating', `${currentValue}`);
    } else {
        showMetricValue('currentRating', '--');
        showMetricValue('mainRating', '--');
    }

    if (typeof maxValue === 'number') {
        showMetricValue('maxRating', `${maxValue}`);
        showMetricValue('mainMaxRating', `${maxValue}`);
    } else {
        showMetricValue('maxRating', '--');
        showMetricValue('mainMaxRating', '--');
    }

    showMetricValue('monthChange', formatSignedNumber(recentChange));
    showMetricValue('globalRank', focusValue);
    showMetricValue('topPercent', `${analytics.acceptedSubmissions || 0}`);
    showMetricValue('avgPerDay', `${analytics.totalSubmissions || 0}`);
    showMetricValue('contestCount', `${analytics.contestCount || 0}`);
    showMetricValue('activeDays', `${analytics.solvedProblems || 0}`);

    const sparkRatings = ratingProgression.map((point) => point.rating || 0).slice(-20);
    const sparkChanges = ratingProgression.map((point) => point.delta || 0).slice(-20);
    let runningMax = 0;
    const sparkMax = sparkRatings.map((value) => {
        runningMax = Math.max(runningMax, value);
        return runningMax;
    });

    createSparkline('sparkCurrent', sparkRatings.length ? sparkRatings : [0], '#10b981');
    createSparkline('sparkMax', sparkMax.length ? sparkMax : [0], '#6366f1');
    createSparkline('sparkChange', sparkChanges.length ? sparkChanges : [0], '#a855f7');
    createSparkline('sparkRank', [analytics.solvedProblems || 0, analytics.acceptedSubmissions || 0], '#0ea5e9');
}

function renderDeepStats(analytics, layout) {
    if (!hasAnalyticsData(analytics)) {
        document.getElementById('chartLoader')?.classList.add('hidden');
        document.getElementById('heatmapLoader')?.classList.add('hidden');
        renderEmptyState('ratingChart', 'Analytics sync pending', 'Connected accounts are ready, but normalized contest and submission history has not been synced yet.', '⏳');
        document.getElementById('heatmapContainer')?.classList.remove('hidden');
        const monthLabels = document.getElementById('monthLabels');
        if (monthLabels) {
            monthLabels.innerHTML = '';
        }
        renderEmptyState('heatmap', 'No synced activity yet', 'Accepted submissions will populate this heatmap after analytics sync.', '🔥');
        currentRows = [];
        renderContestTable();
        showMetricValue('totalSolved', '--');
        showMetricValue('yearSolved', '--');
        showMetricValue('monthSolved', '--');
        showMetricValue('maxStreak', '--');
        showMetricValue('yearStreak', '--');
        showMetricValue('monthStreak', '--');
        renderRecentSubmissions([], layout.showRecentSubmissions);
        return;
    }

    const ratingProgression = analytics.ratingProgression.filter((point) => typeof point.rating === 'number');

    if (ratingProgression.length) {
        createChart(ratingProgression, layout);
    } else {
        document.getElementById('chartLoader')?.classList.add('hidden');
        renderEmptyState('ratingChart', 'No contest history available', 'Contest performance will appear here once synced.', '📈');
    }

    populateHeatmapYearSelector(analytics.activityHeatmap || {});
    renderHeatmap(analytics.activityHeatmap || {});
    renderRecentSubmissions(analytics.recentSubmissions || [], layout.showRecentSubmissions);

    const heatmap = analytics.activityHeatmap || {};
    const yearlySolved = analytics.solvedLastYear || 0;
    const monthlySolved = analytics.solvedLastMonth || 0;

    const streakMetrics = computeStreakMetrics(heatmap);

    const maxStreak = streakMetrics.maxStreak;
    const yearStreak = streakMetrics.yearStreak;
    const monthStreak = streakMetrics.monthStreak;

    showMetricValue('totalSolved', `${analytics.solvedProblems || 0}`);
    showMetricValue('yearSolved', `${yearlySolved}`);
    showMetricValue('monthSolved', `${monthlySolved}`);
    showMetricValue('maxStreak', `${maxStreak} day${maxStreak === 1 ? '' : 's'}`);
    showMetricValue('yearStreak', `${yearStreak} day${yearStreak === 1 ? '' : 's'}`);
    showMetricValue('monthStreak', `${monthStreak} day${monthStreak === 1 ? '' : 's'}`);

    currentRows = (analytics.ratingProgression || [])
        .slice()
        .reverse()
        .map((point) => ({
            contestName: point.contestName || 'Contest',
            platform: point.platform || analytics.platform,
            rank: point.rank ?? null,
            oldRating: typeof point.rating === 'number' && typeof point.delta === 'number' ? point.rating - point.delta : null,
            newRating: point.rating ?? null,
            change: point.delta || 0,
            date: point.participatedAt ? new Date(point.participatedAt).getTime() : 0
        }));
    updateSortIcons();
    renderContestTable();
}

function renderNoPlatforms() {
    setText('dashboardStatus', 'No platforms connected yet. Connect at least one account to unlock your dashboard.');
    document.getElementById('chartLoader')?.classList.add('hidden');
    document.getElementById('heatmapLoader')?.classList.add('hidden');
    renderEmptyState('ratingChart', 'Connect a platform first', 'Rating progression will appear after your first platform sync.', '📊');
    document.getElementById('heatmapContainer')?.classList.remove('hidden');
    const monthLabels = document.getElementById('monthLabels');
    if (monthLabels) {
        monthLabels.innerHTML = '';
    }
    renderEmptyState('heatmap', 'No activity yet', 'Accepted submissions across connected platforms will build this heatmap.', '🔥');
    renderRecentSubmissions([]);
    currentRows = [];
    renderContestTable();
}

function renderAnalytics(analytics, state) {
    const activePlatforms = getActivePlatforms(state);
    const layout = resolveDashboardLayout(activePlatforms);
    const label = activePlatforms.length
        ? activePlatforms.map(capitalize).join(', ')
        : 'all connected platforms';

    setText(
        'dashboardStatus',
        hasAnalyticsData(analytics)
            ? `Showing analytics for ${label}.`
            : `Connected to ${label}, but analytics history is still pending sync.`
    );
    renderSummaryStats(analytics, activePlatforms, layout);
    renderDeepStats(analytics, layout);
}

function maybeLoadAnalytics(state) {
    if (state.platforms.loading || state.analytics.loading) {
        return;
    }

    if (!state.platforms.accounts.length) {
        lastAnalyticsKey = null;
        return;
    }

    const activePlatforms = getActivePlatforms(state);
    const key = activePlatforms.slice().sort().join('|') || 'combined';

    // Only auto-load when platform selection changes.
    // Retrying on every render can create request storms and 429 loops.
    if (key !== lastAnalyticsKey) {
        lastAnalyticsKey = key;
        resetVisualState();
        stateManager.loadAnalytics();
    }
}

function renderState(state) {
    // Prevent recursive rendering
    if (isRendering) {
        return;
    }
    
    isRendering = true;
    try {
        const activePlatforms = getActivePlatforms(state);

        if (state.profile.data) {
            renderSidebarProfile(state.profile.data, activePlatforms);
        }

        if (!state.platforms.loading && !state.platforms.accounts.length) {
            renderNoPlatforms();
            return;
        }

        maybeLoadAnalytics(state);

        if (state.analytics.error) {
            setText('dashboardStatus', `Failed to load analytics: ${state.analytics.error}`);
            return;
        }

        if (state.analytics.data) {
            renderAnalytics(state.analytics.data, state);
        }
    } finally {
        isRendering = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showDashboardApp();
    resetVisualState();
    initRevealAnimations();
    renderState(stateManager.getState());
    stateManager.subscribe(renderState);
    
    // Function to reload analytics when platform selection changes
    window.dashboardAnalyticsNeedsRefresh = () => {
        lastAnalyticsKey = null;
        resetVisualState();
        stateManager.loadAnalytics();
    };

    const yearSelect = document.getElementById('heatmapYearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            selectedHeatmapYear = yearSelect.value || 'all';
            const state = stateManager.getState();
            if (state.analytics?.data?.activityHeatmap) {
                renderHeatmap(state.analytics.data.activityHeatmap);
            }
        });
    }
});

window.sortTable = sortTable;
window.resetChartZoom = resetChartZoom;
 
