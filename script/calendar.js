// --- GLOBAL STATE ---
    let calendarEvents = [];
    let calDate = new Date();

    // Note: initParticles() is automatically called by shared.js now.

    const platformTheme = {
        codeforces: {
            bg: "bg-emerald-500/20",
            border: "border-emerald-500/40",
            text: "text-emerald-300",
            icon: "⚡",
            name: "Codeforces"
        },
        leetcode: {
            bg: "bg-amber-500/20",
            border: "border-amber-500/40",
            text: "text-amber-300",
            icon: "💻",
            name: "LeetCode"
        }
    };

    // --- INIT LOGIC ---
    function initApp() {
        const modalInput = document.getElementById("modalInput").value.trim();
        if (!modalInput) {
            triggerRecovery("EMPTY_HANDLE");
            return; 
        }
        
        // 1. Read handle but DO NOT save to localStorage or hide modal yet
        handle = modalInput;
        
        const launchBtn = document.getElementById("launchBtn");
        if(launchBtn) launchBtn.innerText = "Validating...";

        initRevealAnimations();
        loadCalendarPageData();
    }

    async function loadCalendarPageData() {
        try {
            // 1. Pre-emptive Validation Check via user.info
            const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
            if (infoRes.status === 400) throw new Error("INVALID_HANDLE");
            if (infoRes.status === 429) throw new Error("RATE_LIMIT");
            if (!infoRes.ok) throw new Error("NETWORK_ERROR");
            
            const infoData = await infoRes.json();
            if (infoData.status !== 'OK') throw new Error("INVALID_HANDLE");

            // ==========================================
            // 2. VALIDATION SUCCESS FLOW
            // ==========================================
            localStorage.setItem('cf_handle', handle);
            showMainApp();

            // 3. Delegate sidebar DOM updates to shared.js
            if (typeof renderSidebarProfile === 'function') {
                renderSidebarProfile(infoData.result[0]);
            }

            // Proceed to load calendar data
            await loadCalendar();

        } catch (e) {
            console.error("Calendar Load Failed:", e);
            triggerRecovery(e.message);
        } finally {
            const launchBtn = document.getElementById("launchBtn");
            if(launchBtn) launchBtn.innerText = "Launch Calendar";
        }
    }
    
    // --- CALENDAR LOGIC ---
    async function loadCalendar() {
        if (calendarEvents.length === 0) {
            document.getElementById('calendarLoader').classList.remove('hidden');
            document.getElementById('calendarGrid').classList.add('hidden');
            
            try {
                const res = await fetch('http://localhost:4000/api/calendar/contests');
                const data = await res.json();
                calendarEvents = data;
            } catch (e) {
                console.error("Failed to fetch contests:", e);
            }
            
            document.getElementById('calendarLoader').classList.add('hidden');
            document.getElementById('calendarGrid').classList.remove('hidden');
        }
        renderCalendar();
    }

    function changeMonth(dir) {
        calDate.setMonth(calDate.getMonth() + dir);
        renderCalendar();
    }

    function goToToday() {
        calDate = new Date();
        renderCalendar();
    }

    function renderCalendar() {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        document.getElementById('calendarMonthYear').innerText = `${monthNames[month]} ${year}`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const weeks = Math.ceil((firstDay + daysInMonth) / 7);
        const grid = document.getElementById('calendarGrid');
        grid.style.gridTemplateRows = `repeat(${weeks}, minmax(0, 1fr))`;
        grid.innerHTML = '';
        
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="p-2 opacity-0"></div>`;
        }
        
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let i = 1; i <= daysInMonth; i++) {
            const dayContests = calendarEvents.filter(c => {
                const cDate = new Date(c.startTimeSeconds * 1000);
                return cDate.getFullYear() === year && cDate.getMonth() === month && cDate.getDate() === i;
            });
            
            let contestsHtml = dayContests.map(c => {
                const theme = platformTheme[c.platform] || platformTheme.codeforces;
                const isUpcoming = c.phase === 'BEFORE';
                const bg = isUpcoming ? theme.bg : 'bg-white/5';
                const text = isUpcoming ? `${theme.text} font-semibold` : 'text-gray-400';
                const border = isUpcoming ? `${theme.border} shadow-sm` : 'border-white/10';
                const timeStr = new Date(c.startTimeSeconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                return `
                    <div class="text-[10px] sm:text-xs leading-tight px-2 py-1.5 mb-1.5 rounded-lg ${bg} ${text} border ${border} truncate cursor-pointer transition hover:scale-[1.03] hover:shadow-md pointer-events-none">
                        <span class="opacity-70 mr-1 text-[9px] uppercase">${timeStr}</span><br/>${theme.icon} ${c.title}
                    </div>
                `;
            }).join('');
            
            const isToday = isCurrentMonth && today.getDate() === i;
            const borderClass = isToday ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-white/5' : 'border-white/5';
            const numClass = isToday ? 'bg-emerald-500 text-gray-900 rounded-md px-1.5 py-0.5 shadow-md' : 'text-gray-400';
            
            // Add click listener and hover effects ONLY if there are contests
            const cellInteractions = dayContests.length > 0 
                ? `cursor-pointer hover:bg-white/10 hover:border-emerald-500/50 hover:scale-[1.02] transform transition shadow-lg` 
                : `transition hover:bg-white/5`;
            const onClickAttr = dayContests.length > 0 ? `onclick="openDayModal(${year}, ${month}, ${i})"` : "";

            grid.innerHTML += `
                <div class="glass rounded-xl p-1 sm:p-2 flex flex-col min-h-0 ${borderClass} ${cellInteractions}" ${onClickAttr}>
                    <div class="mb-1 text-right"><span class="text-xs font-bold ${numClass}">${i}</span></div>
                    <div class="flex-1 overflow-y-auto scrollbar pr-1 pointer-events-none">
                        ${contestsHtml}
                    </div>
                </div>
            `;
        }
    }

    // --- DAY MODAL LOGIC ---
    function openDayModal(year, month, day) {
        const dayContests = calendarEvents.filter(c => {
            const cDate = new Date(c.startTimeSeconds * 1000);
            return cDate.getFullYear() === year && cDate.getMonth() === month && cDate.getDate() === day;
        });

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('dayModalTitle').innerText = `${monthNames[month]} ${day}, ${year}`;

        const content = document.getElementById('dayModalContent');
        content.innerHTML = dayContests.map(c => {
            const theme = platformTheme[c.platform] || platformTheme.codeforces;
            const isUpcoming = c.phase === 'BEFORE';
            const bg = isUpcoming ? theme.bg : 'bg-white/5';
            const text = isUpcoming ? `${theme.text} font-semibold` : 'text-gray-300';
            const border = isUpcoming ? `${theme.border} shadow-sm` : 'border-white/10';
            const timeStr = new Date(c.startTimeSeconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Format duration easily
            const hrs = Math.floor(c.durationSeconds / 3600);
            const mins = Math.floor((c.durationSeconds % 3600) / 60);
            const duration = `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm' : ''}`.trim();

            return `
                <div class="glass rounded-xl p-4 flex flex-col ${border} ${bg} transition hover:bg-white/10 cursor-default">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-sm uppercase tracking-wider ${theme.text} opacity-80 font-bold flex items-center gap-1">
                            ${theme.icon} ${theme.name} &bull; ${timeStr}
                        </span>
                        <span class="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded-md font-semibold">${duration}</span>
                    </div>
                    <span class="${text} text-lg leading-snug mb-3">${c.title}</span>
                    <a href="${c.url}" target="_blank" class="w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2 rounded-lg transition font-medium text-sm">
                        Open Contest
                    </a>
                </div>
            `;
        }).join('');

        const modal = document.getElementById('dayModal');
        const card = document.getElementById('dayModalCard');
        modal.classList.remove('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-95');
    }

    function closeDayModal() {
        const modal = document.getElementById('dayModal');
        const card = document.getElementById('dayModalCard');
        modal.classList.add('opacity-0', 'pointer-events-none');
        card.classList.add('scale-95');
    }


    setupWelcomeModal(initApp);