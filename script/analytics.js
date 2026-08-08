
    const visualizationReady = window.CPVisualization
        ? Promise.resolve(window.CPVisualization)
        : new Promise((resolve) => {
            window.addEventListener('cpinsight:visualization-ready', (event) => resolve(event.detail), { once: true });
        });

    // --- NEON PARTICLE BACKGROUND SYSTEM ---
    initParticles();
   
  async function initAnalytics() {
        showMainApp();
        initRevealAnimations();

        let accounts = [];
        try {
            const data = await httpClient.get('/platforms/accounts');
            accounts = platformService.normalizeAccounts(data);
        } catch (e) {
            console.error("Failed to load connected platforms:", e);
        }

        const codeforcesAccount = accounts.find(account => account.platform === 'codeforces' && account.handle);
        if (!codeforcesAccount) {
            renderCodeforcesNotConnected();
            return;
        }

        handle = codeforcesAccount.handle;
        renderSidebarProfile({
            handle: codeforcesAccount.handle,
            rank: codeforcesAccount.rating ? `Rating ${codeforcesAccount.rating}` : "Codeforces connected",
            titlePhoto: codeforcesAccount.avatar_url || ""
        });

        // Reset Skeletons for retry/reload scenarios
        document.querySelectorAll('.content-fade.show').forEach(el => el.classList.remove('show'));
        const radarLoader = document.getElementById('radarLoader');
        if(radarLoader) {
            radarLoader.classList.remove('hidden');
            document.getElementById('radarWrapper').classList.add('hidden');
        }
        const diffLoader = document.getElementById('diffLoader');
        if(diffLoader) {
            diffLoader.classList.remove('hidden');
            document.getElementById('diffWrapper').classList.add('hidden');
        }
        
        loadAnalyticsData();
    }

    function renderCodeforcesNotConnected() {
        const loaderIds = ["radarLoader", "diffLoader"];
        loaderIds.forEach(id => document.getElementById(id)?.classList.add("hidden"));
        document.getElementById("radarWrapper")?.classList.add("hidden");
        document.getElementById("diffWrapper")?.classList.add("hidden");

        const emptyHTML = `
            <div class="glass rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[220px] w-full">
                <div class="text-4xl opacity-70 mb-3">ðŸ”Œ</div>
                <h3 class="text-xl font-bold text-white mb-2">Codeforces account not connected.</h3>
                <p class="text-gray-400 text-sm max-w-md mb-5">Connect your Codeforces account to unlock analytics.</p>
                <button onclick="window.location.href='platforms.html'" class="bg-emerald-600 py-3 px-5 rounded-2xl font-semibold hover:bg-emerald-500 transition text-gray-900">
                    Connect Platform
                </button>
            </div>
        `;

        const topicContainer = document.getElementById("topicIntelContainer");
        if (topicContainer) {
            topicContainer.innerHTML = `<div class="md:col-span-2 xl:col-span-4">${emptyHTML}</div>`;
        }

        ["bestContestCard", "worstContestCard", "consistencyCard", "volatilityCard", "mostActDayCard", "mostActMonthCard", "streakCard", "activeDaysCard", "change30Card", "change90Card"]
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = emptyHTML;
            });

        ["avgDiffCard", "medianDiffCard", "highDiffCard"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<span class="text-2xl font-black text-gray-400">--</span>`;
        });

        const badge = document.getElementById("plateauBadge");
        if (badge) {
            badge.innerHTML = `<div class="w-2 h-2 bg-gray-400 rounded-full"></div> Not connected`;
        }

        renderSidebarProfile({
            handle: "Codeforces",
            rank: "Not connected",
            titlePhoto: ""
        });
    }

  async function loadAnalyticsData() {

    const requestHandle = handle;

    try {

        const minTimePromise =
            new Promise(resolve =>
                setTimeout(resolve, MIN_SKELETON_TIME)
            );

        const dataPromise = Promise.all([
            fetch(
                `https://codeforces.com/api/user.rating?handle=${requestHandle}`
            ).then(r => r.json()),

            fetch(
                `https://codeforces.com/api/user.status?handle=${requestHandle}`
            ).then(r => r.json())
        ]);

        const [[ratingRes, statusRes]] =
            await Promise.all([
                dataPromise,
                minTimePromise
            ]);

        if (requestHandle !== handle) {
            return;
        }

        if (ratingRes.status === "OK") {
            renderContestAnalytics(ratingRes.result);
        }

        if (statusRes.status === "OK") {
            renderStatusAnalytics(statusRes.result);
        }

        requestAnimationFrame(() => {
            setTimeout(() => {

                if (requestHandle !== handle) {
                    return;
                }

                document
                    .querySelectorAll(".content-fade")
                    .forEach(el =>
                        el.classList.add("show")
                    );

            }, 50);
        });

    } catch (e) {

        if (requestHandle !== handle) {
            return;
        }

        console.error(
            "Background Data Fetch Failed:",
            e
        );

        renderAnalyticsLoadFailed(e.message || "Unable to load analytics.");
    }
}

    function renderAnalyticsLoadFailed(message) {
        const detail = message && message.includes("fetch")
            ? "Network error. Codeforces might be down."
            : message;

        renderEmptyState(
            "topicIntelContainer",
            "Unable to load analytics.",
            detail,
            "âš "
        );

        ["radarLoader", "diffLoader"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
        renderEmptyState("radarWrapper", "No analytics available", "Try again after the current data request recovers.", "âš ");
        renderEmptyState("diffWrapper", "No analytics available", "Try again after the current data request recovers.", "âš ");
        document.getElementById("radarWrapper")?.classList.remove("hidden");
        document.getElementById("diffWrapper")?.classList.remove("hidden");
    }
    

    // --- RENDER LOGIC ---
    function renderUserInfo(user) {
        document.getElementById("username").innerText = user.handle;
        document.getElementById("rank").innerText = user.rank || "Unrated";
        document.getElementById("profileImage").src = user.titlePhoto;
        document.getElementById("profileLoader").classList.add("hidden");
        document.getElementById("profileImage").classList.remove("hidden");
    }

    function renderContestAnalytics(ratings) {
            if(!ratings || ratings.length === 0){

            document.getElementById("bestContestCard").innerHTML = `
                <div class="content-fade show flex flex-col items-center justify-center h-full text-center">
                    <div class="text-3xl mb-2">🏆</div>
                    <p class="font-bold">No Contest History</p>
                    <p class="text-xs text-gray-400 mt-2">
                        Participate in a rated contest.
                    </p>
                </div>
            `;

            document.getElementById("worstContestCard").innerHTML =
                document.getElementById("bestContestCard").innerHTML;

            document.getElementById("consistencyCard").innerHTML =
                document.getElementById("bestContestCard").innerHTML;

            document.getElementById("volatilityCard").innerHTML =
                document.getElementById("bestContestCard").innerHTML;

            return;
        }

        let best = -9999, worst = 9999, posCount = 0;
        let deltas = [];
        let revRatings = [...ratings].reverse();
        const now = Date.now() / 1000;
        const days30 = 30 * 24 * 60 * 60;
        const days90 = 90 * 24 * 60 * 60;

        let rating30DaysAgo = revRatings[0].newRating;
        let rating90DaysAgo = revRatings[0].newRating;

        ratings.forEach(r => {
            const delta = r.newRating - r.oldRating;
            if(delta > best) best = delta;
            if(delta < worst) worst = delta;
            if(delta > 0) posCount++;
            deltas.push(delta);
        });

        for(let r of revRatings) {
            if (now - r.ratingUpdateTimeSeconds > days30 && rating30DaysAgo === revRatings[0].newRating) rating30DaysAgo = r.newRating;
            if (now - r.ratingUpdateTimeSeconds > days90 && rating90DaysAgo === revRatings[0].newRating) rating90DaysAgo = r.newRating;
        }

        const currentRating = revRatings[0].newRating;
        const change30 = currentRating - rating30DaysAgo;
        const change90 = currentRating - rating90DaysAgo;
        const consistency = Math.round((posCount / ratings.length) * 100);
        const volatility = standardDeviation(deltas);

        // Inject Content structure with content-fade class
        document.getElementById("bestContestCard").innerHTML = `
            <div class="content-fade w-full h-full">
                <p class="text-gray-400 text-sm tracking-wide uppercase font-semibold">Best Contest</p>
                <h2 id="bestContest" class="text-4xl font-black mt-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">0</h2>
                <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-[250px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300"><span class="font-bold text-white block mb-1">Data: Codeforces user.rating</span>Maximum positive rating change (delta) achieved in a single contest.</div>
            </div>`;
            
        document.getElementById("worstContestCard").innerHTML = `
            <div class="content-fade w-full h-full">
                <p class="text-gray-400 text-sm tracking-wide uppercase font-semibold">Worst Contest</p>
                <h2 id="worstContest" class="text-4xl font-black mt-2 text-rose-400">0</h2>
                <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-[250px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300"><span class="font-bold text-white block mb-1">Data: Codeforces user.rating</span>Maximum negative rating change (delta) experienced in a single contest.</div>
            </div>`;
            
       document.getElementById("consistencyCard").innerHTML = `
            <div class="content-fade w-full h-full">
                <div class="inline-flex items-center gap-1.5 has-tooltip relative cursor-help mb-1" tabindex="0">
                    <p class="text-gray-400 text-sm tracking-wide uppercase font-semibold">Consistency Score</p>
                    <span class="info-icon text-gray-500 transition-colors text-[10px] leading-none">ⓘ</span>
                    <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-[220px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none">
                        Measures stability of contest performance over time.<br/><br/>
                        <span class="text-emerald-400">Higher</span> = more stable results.<br/>
                        <span class="text-rose-400">Lower</span> = larger fluctuations between contests.
                    </div>
                </div>
                <h2 id="consistencyScore" class="text-4xl font-black mt-2 text-indigo-400">0%</h2>
            </div>`;
            
        document.getElementById("volatilityCard").innerHTML = `
            <div class="content-fade w-full h-full">
                <div class="inline-flex items-center gap-1.5 has-tooltip relative cursor-help mb-1" tabindex="0">
                    <p class="text-gray-400 text-sm tracking-wide uppercase font-semibold">Volatility Score</p>
                    <span class="info-icon text-gray-500 transition-colors text-[10px] leading-none">ⓘ</span>
                    <div class="tooltip absolute z-50 bottom-full right-0 mb-2 w-[220px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none">
                        Measures rating fluctuations.<br/><br/>
                        <span class="text-emerald-400">Higher</span> = larger rating swings.<br/>
                        <span class="text-indigo-400">Lower</span> = more predictable performance.
                    </div>
                </div>
                <h2 id="volatilityScore" class="text-4xl font-black mt-2 text-white">0.0</h2>
            </div>`;

        // Apply Scroll Observers to the newly injected elements
        triggerOnScroll("bestContest", 0, best, 2000, "", "+");
        triggerOnScroll("worstContest", 0, worst, 2000, "", "");
        triggerOnScroll("consistencyScore", 0, consistency, 2000, "%");
        triggerOnScroll("volatilityScore", 0, volatility, 2000, "", "", true);

        window.tempRatingData = { change90: change90, change30: change30, lastContestTime: revRatings[0].ratingUpdateTimeSeconds };
    }

    function renderStatusAnalytics(submissions) {

   if (!submissions || submissions.length === 0) {

        renderEmptyState(
            "topicIntelContainer",
            "No Submissions Found",
            "Start solving problems to unlock analytics.",
            "📊"
        );

        renderEmptyState(
            "radarWrapper",
            "No Topic Data",
            "Solve accepted problems to generate skill radar.",
            "🧠"
        );

        renderEmptyState(
            "diffWrapper",
            "No Difficulty Data",
            "Accepted solves are required for difficulty analysis.",
            "📈"
        );

        renderEmptyState(
            "skillUniverseViz",
            "No skill universe yet",
            "Accepted submissions with topic tags are required to build your learning graph.",
            "🧠"
        );

        document.getElementById("radarLoader")?.classList.add("hidden");
        document.getElementById("diffLoader")?.classList.add("hidden");

        document.getElementById("radarWrapper")?.classList.remove("hidden");
        document.getElementById("diffWrapper")?.classList.remove("hidden");

        ["avgDiffCard", "medianDiffCard", "highDiffCard"]
        .forEach(id => {
            document.getElementById(id).innerHTML = `
                <div class="content-fade show flex items-center justify-center h-full">
                    <span class="text-2xl font-black text-gray-400">--</span>
                </div>
            `;
        });

        renderActivityAnalytics(null);
        renderGrowthAnalytics(0);

        return;
    }

   

    const topicData = computeTopicAnalytics(submissions);
   if (!topicData.strongest) {

    renderEmptyState(
        "topicIntelContainer",
        "No Accepted Submissions",
        "Solve accepted problems to generate topic intelligence.",
        "🧠"
    );

    renderEmptyState(
        "radarWrapper",
        "No Topic Data",
        "Accepted solves are required for skill radar.",
        "🎯"
    );

    renderEmptyState(
        "diffWrapper",
        "No Solved Problems",
        "Difficulty analytics requires accepted solves.",
        "📈"
    );

    renderEmptyState(
        "skillUniverseViz",
        "No skill universe yet",
        "Accepted submissions with topic tags are required to build your learning graph.",
        "🧠"
    );

    document.getElementById("radarLoader")?.classList.add("hidden");
    document.getElementById("diffLoader")?.classList.add("hidden");

    document.getElementById("radarWrapper")?.classList.remove("hidden");
    document.getElementById("diffWrapper")?.classList.remove("hidden");

    renderActivityAnalytics(null);
    renderGrowthAnalytics(0);

    return;
}

const activityData = computeActivityAnalytics(submissions);
    const difficultyData = computeDifficultyAnalytics(submissions);

    renderTopicIntelligence(topicData);
    renderSkillUniverse(topicData);
    renderActivityAnalytics(activityData);
    renderDifficultyAnalytics(difficultyData);

    renderGrowthAnalytics(activityData.subs90Days);

    setupRadarChartObserver(
        topicData.radarLabels,
        topicData.radarScores
    );

    setupDifficultyChartObserver(
        difficultyData.histogram
    );
}    
    

    // COMPUTATION HELPERS
    // ==========================================
    function computeTopicAnalytics(submissions) {
        const okSubs = submissions.filter(s => s.verdict === 'OK');
        const uniqueSolvedMap = new Map();
        okSubs.forEach(sub => {
            let problemKey = sub.problem.contestId ? `${sub.problem.contestId}-${sub.problem.index}` : sub.problem.name;
            if (!uniqueSolvedMap.has(problemKey)) uniqueSolvedMap.set(problemKey, sub);
        });
        const uniqueSolved = Array.from(uniqueSolvedMap.values());

        const ALLOWED_CF_TOPICS = new Set([
            "geometry", "bitmasks", "two pointers", "dsu", "shortest paths",
            "probabilities", "divide and conquer", "hashing", "games", "flows",
            "interactive", "matrices", "string suffix structures", "fft",
            "graph matchings", "ternary search", "expression parsing",
            "meet-in-the-middle", "2-sat", "chinese remainder theorem",
            "schedules", "sortings", "binary search", "dfs and similar",
            "trees", "strings", "number theory", "combinatorics", "math",
            "greedy", "dp", "data structures", "brute force",
            "constructive algorithms", "graphs", "implementation"
        ]);

        const radarTags = ['dp', 'graphs', 'trees', 'greedy', 'math', 'strings', 'binary search', 'data structures'];
        let topicStats = {}; 
        let filteredTags = new Set(); // For debugging blocked tags

        // 1. Process All Submissions (Attempts/Success Rates)
        submissions.forEach(s => {
            if (!s.problem || !s.problem.tags) return;
            s.problem.tags.forEach(rawTag => {
                if (!rawTag || typeof rawTag !== 'string') return;
                
                const normalized = rawTag.trim().toLowerCase();
                
                if (!ALLOWED_CF_TOPICS.has(normalized)) {
                    filteredTags.add(normalized);
                    return; // Skip invalid tags entirely
                }

                if(!topicStats[normalized]) {
                    topicStats[normalized] = { totalSubs: 0, okSubs: 0, okDiffs: [], lastSolved: 0 };
                }
                topicStats[normalized].totalSubs++;
            });
        });
        
        // 2. Process Unique Solves (Difficulty/Volume)
        uniqueSolved.forEach(s => {
            if (!s.problem || !s.problem.tags) return;
            s.problem.tags.forEach(rawTag => {
                if (!rawTag || typeof rawTag !== 'string') return;
                
                const normalized = rawTag.trim().toLowerCase();
                
                if (!ALLOWED_CF_TOPICS.has(normalized)) return;

                topicStats[normalized].okSubs++;
                if (s.problem.rating) {
                    topicStats[normalized].okDiffs.push(s.problem.rating);
                }
                if (s.creationTimeSeconds > topicStats[normalized].lastSolved) {
                    topicStats[normalized].lastSolved = s.creationTimeSeconds;
                }
            });
        });

        // 3. Absolute Scoring Calculations
        Object.keys(topicStats).forEach(tag => {
            let stats = topicStats[tag];
            stats.avgDiff = stats.okDiffs.length > 0 ? (stats.okDiffs.reduce((a, b) => a + b, 0) / stats.okDiffs.length) : 0;
        });

        let computedTopics = [];
        Object.keys(topicStats).forEach(tag => {
            let stats = topicStats[tag];
            if(stats.okSubs === 0) return;
            
            // Absolute Difficulty Score (Fixed 3500 Benchmark)
            let difficultyScore = Math.min(100, (stats.avgDiff / 3500) * 100);
            
            // Absolute Volume Score (Fixed 500 Benchmark, Logarithmic Scale)
            let volumeScore = Math.min(100, (Math.log(stats.okSubs + 1) / Math.log(500 + 1)) * 100);
            
            // Success Rate Score
            let successRateScore = stats.totalSubs > 0 ? (stats.okSubs / stats.totalSubs) * 100 : 100;
            
            // Final Absolute Strength Score (40 / 40 / 20)
            let finalStrength = (0.40 * difficultyScore) + (0.40 * volumeScore) + (0.20 * successRateScore);
            
            computedTopics.push({
                name: tag, 
                score: Math.round(finalStrength), 
                successRate: Math.round(successRateScore),
                avgDiff: Math.round(stats.avgDiff), 
                solved: stats.okSubs, 
                lastSolved: stats.lastSolved
            });
        });

        // 4. Strict Radar Mapping (Exact string matches only)
        let radarScores = radarTags.map(targetTag => {
            let t = computedTopics.find(ct => ct.name === targetTag);
            return t ? t.score : 0;
        });

        // 5. Intelligence Card Mapping
        let strongest = null, weakest = null, mostPracticed = null, mostNeglected = null;

        if(computedTopics.length > 0) {
            let byScore = [...computedTopics].sort((a,b) => b.score - a.score);
            strongest = byScore[0];
            
            let bySolved = [...computedTopics].sort((a,b) => b.solved - a.solved);
            mostPracticed = bySolved[0];
            
            let validTopics = computedTopics.filter(t => t.solved >= 5);

            
            if(validTopics.length === 0) {
                validTopics = computedTopics; 
            }

            // Weakest Topic
            validTopics.sort((a, b) => b.score - a.score);
            weakest = validTopics[validTopics.length - 1];

            // Most Neglected Topic
            validTopics.sort((a, b) => a.lastSolved - b.lastSolved);
            mostNeglected = validTopics[0];
        }

        // 6. Debugging outputs
        console.log("Filtered Out Tags:", Array.from(filteredTags));
        console.log("Allowed Topics Processed:", computedTopics.map(t => t.name));

        return { strongest, weakest, mostPracticed, mostNeglected, topics: computedTopics, radarLabels: radarTags, radarScores };
    }

    function computeActivityAnalytics(submissions) {
        const daysOfWeek = [0,0,0,0,0,0,0]; 
        const months = [0,0,0,0,0,0,0,0,0,0,0,0];
        const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthsMap = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        let uniqueDaysSet = new Set();
        let subs90Days = 0;
        const nowSec = Date.now() / 1000;

        submissions.forEach(s => {
            const d = new Date(s.creationTimeSeconds * 1000);
            daysOfWeek[d.getDay()]++;
            months[d.getMonth()]++;
            uniqueDaysSet.add(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0'));
            if(nowSec - s.creationTimeSeconds <= (90 * 86400)) subs90Days++;
        });

        let maxDayIdx = daysOfWeek.indexOf(Math.max(...daysOfWeek));
        let maxMonthIdx = months.indexOf(Math.max(...months));
        
        const sortedDays = [...uniqueDaysSet].sort();
        let currentStreak = 0, longestStreak = 0;
        if (sortedDays.length > 0) {
            let tempS = 1; longestStreak = 1;
            for (let i = 1; i < sortedDays.length; i++) {
                const d1 = new Date(sortedDays[i-1]);
                const d2 = new Date(sortedDays[i]);
                const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
                if (diff === 1) { tempS++; if (tempS > longestStreak) longestStreak = tempS; } 
                else if (diff > 1) { tempS = 1; }
            }
            const lastDate = new Date(sortedDays[sortedDays.length-1]);
            const diffFromToday = Math.round((new Date() - lastDate) / (1000 * 60 * 60 * 24));
            if (diffFromToday <= 1) currentStreak = tempS;
        }

        let activeDaysPercent = 0;
        if (submissions.length > 0) {
            const earliest = submissions[submissions.length - 1].creationTimeSeconds * 1000;
            const daysSinceStart = Math.max(1, Math.round((Date.now() - earliest) / (1000 * 60 * 60 * 24)));
            activeDaysPercent = Math.min(100, Math.round((uniqueDaysSet.size / daysSinceStart) * 100));
        }

        return { activeDaysPercent, currentStreak, longestStreak, mostActiveDay: daysMap[maxDayIdx], mostActiveMonth: monthsMap[maxMonthIdx], subs90Days };
    }

    function computeDifficultyAnalytics(submissions) {
        const okSubs = submissions.filter(s => s.verdict === 'OK');
        const uniqueSolvedMap = new Map();
        okSubs.forEach(sub => {
            let problemKey = sub.problem.contestId ? `${sub.problem.contestId}-${sub.problem.index}` : sub.problem.name;
            if (!uniqueSolvedMap.has(problemKey)) uniqueSolvedMap.set(problemKey, sub);
        });
        const uniqueSolved = Array.from(uniqueSolvedMap.values());

        let diffs = [];
        let buckets = { '800':0, '1000':0, '1200':0, '1400':0, '1600':0, '1800':0, '2000+':0 };
        
        uniqueSolved.forEach(s => {
            if(s.problem.rating) {
                let r = s.problem.rating;
                diffs.push(r);
                if(r <= 900) buckets['800']++;
                else if(r <= 1100) buckets['1000']++;
                else if(r <= 1300) buckets['1200']++;
                else if(r <= 1500) buckets['1400']++;
                else if(r <= 1700) buckets['1600']++;
                else if(r <= 1900) buckets['1800']++;
                else buckets['2000+']++;
            }
        });

        let averageDifficulty = 0, medianDifficulty = 0, highestSolved = 0;
        if(diffs.length > 0) {
            diffs.sort((a,b)=>a-b);
            const sum = diffs.reduce((a,b)=>a+b, 0);
            averageDifficulty = Math.round(sum / diffs.length);
            medianDifficulty = diffs[Math.floor(diffs.length/2)];
            highestSolved = diffs[diffs.length-1];
        }

        return { histogram: Object.values(buckets), averageDifficulty, medianDifficulty, highestSolved };
    }

    // DOM RENDER HELPERS
    // ==========================================
    function renderTopicIntelligence(topicData) {
        const { strongest, weakest, mostPracticed, mostNeglected } = topicData;
        if (!strongest) return;

        const daysSinceNeglected = mostNeglected ? Math.round((Date.now()/1000 - mostNeglected.lastSolved) / 86400) : 0;

       document.getElementById('topicIntelContainer').innerHTML = `
            <div class="glass tooltip-container rounded-3xl p-6 hover:-translate-y-1 transition h-[150px]">
                <div class="content-fade w-full h-full flex flex-col justify-between">
                    <div>
                        <div class="inline-flex items-center gap-1.5 has-tooltip relative cursor-help mb-1" tabindex="0">
                            <p class="text-emerald-400 text-xs font-bold uppercase tracking-wider">Strongest Topic</p>
                            <span class="info-icon text-gray-500 transition-colors text-[10px] leading-none">ⓘ</span>
                            <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-[220px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none">
                                Measures demonstrated strength in a topic.<br/>
                                <span class="text-white font-semibold mt-1 block">Formula:</span>
                                • 40% Difficulty Score<br/>
                                • 40% Volume Score<br/>
                                • 20% Success Rate<br/>
                                Higher = stronger performance.
                            </div>
                        </div>
                        <h3 class="text-2xl font-black text-white mb-2 truncate capitalize">${strongest.name}</h3>
                        <p class="text-gray-400 text-xs mb-3 flex items-center gap-3">
                            <span class="inline-flex items-center gap-1 has-tooltip relative cursor-help" tabindex="0">
                                Avg Diff: ${strongest.avgDiff}
                                <span class="info-icon text-gray-500 text-[9px]">ⓘ</span>
                                <span class="tooltip absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[200px] p-2 bg-gray-900 border border-white/10 rounded-lg shadow-xl text-[10px] text-gray-300 font-normal normal-case pointer-events-none">Based on average rating of accepted problems in this topic. Higher rated solves increase this score.</span>
                            </span>
                            <span class="inline-flex items-center gap-1 has-tooltip relative cursor-help" tabindex="0">
                                Win Rate: ${strongest.successRate}%
                                <span class="info-icon text-gray-500 text-[9px]">ⓘ</span>
                                <span class="tooltip absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[200px] p-2 bg-gray-900 border border-white/10 rounded-lg shadow-xl text-[10px] text-gray-300 font-normal normal-case pointer-events-none">Accepted Submissions ÷ Total Submissions × 100</span>
                            </span>
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-[2000ms] ease-out w-0" id="strongestBar"></div>
                        </div>
                        <span class="text-sm font-bold text-gray-300"><span id="strongestScore">0</span>/100</span>
                    </div>
                </div>
            </div>

            <div class="glass tooltip-container rounded-3xl p-6 hover:-translate-y-1 transition h-[150px]">
                <div class="content-fade w-full h-full flex flex-col justify-between">
                    <div>
                        <div class="inline-flex items-center gap-1.5 has-tooltip relative cursor-help mb-1" tabindex="0">
                            <p class="text-rose-400 text-xs font-bold uppercase tracking-wider">Weakest Topic</p>
                            <span class="info-icon text-gray-500 transition-colors text-[10px] leading-none">ⓘ</span>
                            <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-[220px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none">
                                Measures demonstrated strength in a topic.<br/>
                                <span class="text-white font-semibold mt-1 block">Formula:</span>
                                • 40% Difficulty Score<br/>
                                • 40% Volume Score<br/>
                                • 20% Success Rate
                            </div>
                        </div>
                        <h3 class="text-2xl font-black text-white mb-2 truncate capitalize">${weakest.name}</h3>
                        <p class="text-gray-400 text-xs mb-3">
                            Avg Diff: ${weakest.avgDiff} | Win Rate: ${weakest.successRate}%
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div class="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] transition-all duration-[2000ms] ease-out w-0" id="weakestBar"></div>
                        </div>
                        <span class="text-sm font-bold text-gray-300"><span id="weakestScore">0</span>/100</span>
                    </div>
                </div>
            </div>

            <div class="glass tooltip-container rounded-3xl p-6 hover:-translate-y-1 transition h-[150px]">
                <div class="content-fade w-full h-full flex flex-col justify-between">
                    <div>
                        <div class="inline-flex items-center gap-1.5 has-tooltip relative cursor-help mb-1" tabindex="0">
                            <p class="text-indigo-400 text-xs font-bold uppercase tracking-wider">Most Practiced</p>
                            <span class="info-icon text-gray-500 transition-colors text-[10px] leading-none">ⓘ</span>
                            <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-[200px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none">
                                Topic with the highest number of accepted solves.
                            </div>
                        </div>
                        <h3 class="text-2xl font-black text-white mb-2 truncate capitalize">${mostPracticed.name}</h3>
                    </div>
                    <div class="flex items-center gap-2 text-indigo-300 text-sm font-semibold mt-auto">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                        <span id="mostPracticedSolved">0</span> Solved Total
                    </div>
                </div>
            </div>

            <div class="glass tooltip-container rounded-3xl p-6 hover:-translate-y-1 transition h-[150px]">
                <div class="content-fade w-full h-full flex flex-col justify-between">
                    <div>
                        <div class="inline-flex items-center gap-1.5 has-tooltip relative cursor-help mb-1" tabindex="0">
                            <p class="text-amber-400 text-xs font-bold uppercase tracking-wider">Most Neglected</p>
                            <span class="info-icon text-gray-500 transition-colors text-[10px] leading-none">ⓘ</span>
                            <div class="tooltip absolute z-50 bottom-full right-0 mb-2 w-[200px] p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl text-xs text-gray-300 font-normal normal-case tracking-normal whitespace-normal text-left pointer-events-none">
                                Previously practiced topic that has not been solved recently.
                            </div>
                        </div>
                        <h3 class="text-2xl font-black text-white mb-2 truncate capitalize">${mostNeglected.name}</h3>
                    </div>
                    <div class="flex items-center gap-2 text-amber-300 text-sm font-semibold mt-auto">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span id="neglectDays">0</span> days since last solve
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            document.getElementById('strongestBar').style.width = strongest.score + '%';
            document.getElementById('weakestBar').style.width = weakest.score + '%';
            triggerOnScroll("strongestScore", 0, strongest.score, 2000);
            triggerOnScroll("weakestScore", 0, weakest.score, 2000);
            triggerOnScroll("mostPracticedSolved", 0, mostPracticed.solved, 2000);
            triggerOnScroll("neglectDays", 0, daysSinceNeglected, 2000);
        }, 100);
    }

   function renderActivityAnalytics(activityData) { 
    if ( !activityData || ( activityData.currentStreak === 0 && activityData.longestStreak === 0 && activityData.activeDaysPercent === 0 ) ){
        [ "mostActDayCard", "mostActMonthCard", "streakCard", "activeDaysCard" ].forEach(id => { const el = document.getElementById(id); 
        if (!el) return; 
        el.innerHTML = ` <div class="flex flex-col items-center justify-center h-full text-center"><div class="text-3xl mb-2">📅</div> <p class="font-bold"> No Activity Data </p> </div> `; });
        return; 
    } 
             document.getElementById( "mostActDayCard" ).innerHTML = 
             ` <div class="text-xs text-gray-400 uppercase"> Most Active Day </div> 
             <div class="text-3xl font-bold text-emerald-400 mt-2"> ${activityData.mostActiveDay} </div> `; 
             document.getElementById( "mostActMonthCard" ).innerHTML =
              ` <div class="text-xs text-gray-400 uppercase"> Most Active Month </div> 
              <div class="text-3xl font-bold text-indigo-400 mt-2"> ${activityData.mostActiveMonth} </div> `;
               document.getElementById( "streakCard" ).innerHTML = 
               ` <div class="text-xs text-gray-400 uppercase"> Current / Longest Streak </div> 
               <div class="text-3xl font-bold text-emerald-400 mt-2"> ${activityData.currentStreak} 
               <span class="text-gray-400"> / </span> ${activityData.longestStreak} </div> `; 
               document.getElementById( "activeDaysCard" ).innerHTML = 
               ` <div class="text-xs text-gray-400 uppercase"> Active Days % </div> 
               <div class="text-3xl font-bold text-white mt-2"> ${activityData.activeDaysPercent}% </div> `; 
    }

    function renderDifficultyAnalytics(difficultyData) {
        document.getElementById("avgDiffCard").innerHTML = `
            <div class="content-fade has-tooltip relative cursor-help w-full h-full">
                <p class="text-gray-500 text-[10px] font-semibold uppercase mb-1">Average Difficulty</p>
                <p id="avgDiff" class="text-white font-black text-lg">0</p>
                <div class="tooltip absolute z-50 bottom-full left-0 mb-2 w-max p-2 bg-gray-900 border border-white/10 rounded shadow-xl text-xs text-gray-300">Mean rating of all accepted problems</div>
            </div>`;
        document.getElementById("medianDiffCard").innerHTML = `
            <div class="content-fade has-tooltip relative cursor-help w-full h-full">
                <p class="text-gray-500 text-[10px] font-semibold uppercase mb-1">Median Difficulty</p>
                <p id="medianDiff" class="text-emerald-400 font-black text-lg">0</p>
                <div class="tooltip absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-gray-900 border border-white/10 rounded shadow-xl text-xs text-gray-300">Middle rating value of accepted problems</div>
            </div>`;
        document.getElementById("highDiffCard").innerHTML = `
            <div class="content-fade has-tooltip relative cursor-help w-full h-full">
                <p class="text-gray-500 text-[10px] font-semibold uppercase mb-1">Highest Solved</p>
                <p id="highDiff" class="text-indigo-400 font-black text-lg">0</p>
                <div class="tooltip absolute z-50 bottom-full right-0 mb-2 w-max p-2 bg-gray-900 border border-white/10 rounded shadow-xl text-xs text-gray-300">Maximum problem rating solved</div>
            </div>`;

        triggerOnScroll("avgDiff", 0, difficultyData.averageDifficulty, 2000);
        triggerOnScroll("medianDiff", 0, difficultyData.medianDifficulty, 2000);
        triggerOnScroll("highDiff", 0, difficultyData.highestSolved, 2000);
    }

    function renderGrowthAnalytics(subs90Days) {
       if (
    !window.tempRatingData
) { const noDataHTML = ` <div class="flex flex-col items-center justify-center h-full text-center"> <div class="text-3xl mb-2">📈</div> <p class="font-bold"> No Growth Data </p> </div> `; document.getElementById( "change30Card" )?.replaceChildren(); document.getElementById( "change90Card" )?.replaceChildren(); document.getElementById( "change30Card" ).innerHTML = noDataHTML; document.getElementById( "change90Card" ).innerHTML = noDataHTML; const badge = document.getElementById( "plateauBadge" ); if (badge) { badge.innerHTML = ` <div class="w-2 h-2 bg-gray-400 rounded-full"></div> No Data `; } return; }

        document.getElementById("change30Card").innerHTML = `
            <div class="content-fade w-full h-full flex flex-col justify-center items-center text-center">
                <p class="text-gray-500 text-xs font-semibold uppercase mb-2">30 Day Rating Change</p>
                <h3 id="change30" class="text-4xl font-black text-white">0</h3>
            </div>`;
        document.getElementById("change90Card").innerHTML = `
            <div class="content-fade w-full h-full flex flex-col justify-center items-center text-center">
                <p class="text-gray-500 text-xs font-semibold uppercase mb-2">90 Day Rating Change</p>
                <h3 id="change90" class="text-4xl font-black text-white">0</h3>
            </div>`;

        if(window.tempRatingData) {
            const c30 = window.tempRatingData.change30;
            const c90 = window.tempRatingData.change90;
            triggerOnScroll("change30", 0, c30, 2000, "", c30 >= 0 ? "+" : "");
            document.getElementById("change30").className = `text-4xl font-black ${c30 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
            
            triggerOnScroll("change90", 0, c90, 2000, "", c90 >= 0 ? "+" : "");
            document.getElementById("change90").className = `text-4xl font-black ${c90 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

            const badge = document.getElementById("plateauBadge");
            badge.classList.add("show"); 
            const isActivityHigh = subs90Days > 20; 
            const isRatingGrowthLow = c90 <= 20;
            
            if(isActivityHigh && isRatingGrowthLow) {
                badge.innerHTML = `<div class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div> Plateauing`;
                badge.className = "bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 has-tooltip relative cursor-help content-fade show";
            } else if (c90 > 20) {
                badge.innerHTML = `<div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div> Improving`;
                badge.className = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 has-tooltip relative cursor-help content-fade show";
            } else {
                badge.innerHTML = `<div class="w-2 h-2 bg-gray-400 rounded-full"></div> Stable`;
                badge.className = "bg-gray-500/20 text-gray-400 border border-gray-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 has-tooltip relative cursor-help content-fade show";
            }
        }
    }

    // --- LAZY LOADED CHART OBSERVERS ---
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'Inter';

    // --- STRICT SINGLETON OBSERVERS ---
    let radarChartInstance = null;
    let diffChartInstance = null;
    let skillUniverseInstance = null;
    let radarObserver = null;
    let diffObserver = null;

    function setupRadarChartObserver(labels, data) {
        if (radarObserver) radarObserver.disconnect(); // Prevent duplicate triggers
        
        const wrapper = document.getElementById('radarWrapper');
        radarObserver = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                document.getElementById('radarLoader').classList.add('hidden');
                wrapper.classList.remove('hidden');
                drawRadarChart(labels, data);
                obs.disconnect(); // Execute exactly once
            }
        }, { threshold: 0.2 });
        
        radarObserver.observe(wrapper.parentElement);
    }

    function setupDifficultyChartObserver(data) {
        if (diffObserver) diffObserver.disconnect(); // Prevent duplicate triggers
        
        const wrapper = document.getElementById('diffWrapper');
        diffObserver = new IntersectionObserver((entries, obs) => {
            if (entries[0].isIntersecting) {
                document.getElementById('diffLoader').classList.add('hidden');
                wrapper.classList.remove('hidden');
                drawDifficultyChart(data);
                obs.disconnect(); // Execute exactly once
            }
        }, { threshold: 0.2 });
        
        diffObserver.observe(wrapper.parentElement);
    }

    function topicCategory(topic) {
        const value = String(topic || '').toLowerCase();
        if (/graph|dfs|shortest|dsu|flow|mst/.test(value)) return 'Graph Theory';
        if (/dp|dynamic|bitmask/.test(value)) return 'Dynamic Programming';
        if (/tree|trie|segment/.test(value)) return 'Tree Structures';
        if (/string|hash|suffix/.test(value)) return 'Strings';
        if (/math|number|combin|probab|geometry/.test(value)) return 'Math';
        if (/binary|sort|two pointers|implementation|brute|greedy/.test(value)) return 'Foundations';
        return 'General';
    }

    async function renderSkillUniverse(topicData) {
        const container = document.getElementById('skillUniverseViz');
        if (!container) return;

        const topics = (topicData?.topics || []).map((topic) => {
            const mastery = Number(topic.score || 0);
            const roi = Math.max(20, 100 - mastery + Math.min(20, Number(topic.solved || 0) * 2));
            return {
                key: topic.name,
                label: topic.name,
                topic: topic.name,
                value: mastery,
                score: mastery,
                mastery,
                roi,
                priority: roi,
                confidence: Math.min(96, 52 + Number(topic.solved || 0) * 5),
                solved: topic.solved || 0,
                successRate: topic.successRate || 0,
                avgDiff: topic.avgDiff || 0,
                category: topicCategory(topic.name),
                recentlyPracticed: topic.lastSolved && ((Date.now() / 1000) - topic.lastSolved < 60 * 60 * 24 * 21),
                insight: mastery < 45
                    ? 'This topic currently has high improvement potential based on accepted-solve strength.'
                    : 'This topic is supported by recent accepted submissions and can anchor adjacent practice.'
            };
        });

        skillUniverseInstance?.destroy?.();
        if (!topics.length) {
            renderEmptyState('skillUniverseViz', 'No skill universe yet', 'Accepted submissions with topic tags are required to build your learning graph.', '🧠');
            return;
        }

        const engine = await visualizationReady;
        if (!engine) return;

        skillUniverseInstance = engine.createVisualizationLab(container, {
            id: 'analytics-skill-universe',
            title: 'AI Skill Universe',
            group: 'skillUniverse',
            types: ['skillUniverse', 'forceGraph', 'table'],
            defaultType: 'skillUniverse',
            scope: 'topic',
            entityType: 'topic',
            data: {
                labels: topics.map((topic) => topic.label),
                values: topics.map((topic) => topic.value),
                rows: topics
            },
            onSelect(selection) {
                window.dispatchEvent(new CustomEvent('cpinsight:topic-highlight', { detail: selection.payload }));
            }
        });
    }

    // --- CHART.JS CONFIGURATIONS ---

    async function drawRadarChart(labels, data) {
        if (radarChartInstance) radarChartInstance.destroy?.(); // Clear old chart memory

        const engine = await visualizationReady;
        if (!engine) return;

        radarChartInstance = engine.createVisualizationLab(document.getElementById('radarChart'), {
            id: 'analytics-topic-performance',
            title: 'Topic Performance',
            group: 'topicPerformance',
            types: ['radar', 'bar', 'treemap', 'sunburst', 'heatmap', 'bubble', 'table'],
            defaultType: 'radar',
            scope: 'topic',
            entityType: 'topic',
            data: {
                labels,
                values: data,
                rows: labels.map((label, index) => ({
                    key: label,
                    label,
                    value: data[index],
                    score: data[index],
                    size: data[index]
                }))
            }
        });
    }

    async function drawDifficultyChart(data) {
        if (diffChartInstance) diffChartInstance.destroy?.(); // Clear old chart memory

        const engine = await visualizationReady;
        if (!engine) return;

        const labels = ['<=900', '1000-1199', '1200-1399', '1400-1599', '1600-1799', '1800-1999', '2000+'];
        diffChartInstance = engine.createVisualizationLab(document.getElementById('difficultyChart'), {
            id: 'analytics-difficulty-distribution',
            title: 'Difficulty Distribution',
            group: 'distribution',
            types: ['horizontalBar', 'bar', 'histogram', 'heatmap', 'table'],
            defaultType: 'horizontalBar',
            scope: 'difficulty',
            entityType: 'difficulty-bucket',
            data: {
                labels,
                values: data,
                rows: labels.map((label, index) => ({
                    key: label,
                    label,
                    value: data[index],
                    count: data[index]
                }))
            }
        });
    }


    document.addEventListener('DOMContentLoaded', initAnalytics);
