// ==================================================
// GLOBAL STATE
// ==================================================
const MIN_SKELETON_TIME = 1200;
let handle = "";
let scrollObservers = {};

function showMainApp() {
    const mainApp = document.getElementById("mainApp");
    if(mainApp) mainApp.classList.remove("blur-md", "pointer-events-none");
}

// ==================================================
// USER PROFILE RENDERING
// ==================================================
function renderSidebarProfile(user) {
    const unEl = document.getElementById("username");
    const rEl = document.getElementById("rank");
    const imgEl = document.getElementById("profileImage");
    const loaderEl = document.getElementById("profileLoader");

    if(unEl) unEl.innerText = user.handle;
    if(rEl) rEl.innerText = user.rank || "Unrated";
    if(imgEl && user.titlePhoto) {
        imgEl.src = user.titlePhoto;
        imgEl.classList.remove("hidden");
    } else if (imgEl) {
        imgEl.classList.add("hidden");
    }
    if(loaderEl) loaderEl.classList.add("hidden");
}

// ==================================================
// UTILITY FUNCTIONS
// ==================================================
function standardDeviation(arr) {
    if(arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
}

function formatDateLocal(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
}

// ==================================================
// ANIMATION HELPERS
// ==================================================
function animateValue(elementId, start, end, duration, suffix = "", prefix = "", isFloat = false) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    if (end === null || end === undefined || isNaN(end)) { obj.innerHTML = "--" + suffix; return; }

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        let currentVal = easeProgress * (end - start) + start;
        if (isFloat) currentVal = currentVal.toFixed(1);
        else currentVal = Math.round(currentVal);
        
        obj.innerHTML = prefix + currentVal + suffix;
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerHTML = prefix + (isFloat ? parseFloat(end).toFixed(1) : end) + suffix; 
    };
    window.requestAnimationFrame(step);
}

function triggerOnScroll(elementId, start, end, duration, suffix = "", prefix = "", isFloat = false) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    
    obj.innerHTML = prefix + start + suffix; // Reset UI
    if(scrollObservers[elementId]) scrollObservers[elementId].disconnect();
    
    const observer = new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) {
            animateValue(elementId, start, end, duration, suffix, prefix, isFloat);
            obs.disconnect(); 
        }
    }, { threshold: 0.1 });
    
    observer.observe(obj);
    scrollObservers[elementId] = observer;
}

function initRevealAnimations() {
    const reveals = document.querySelectorAll('.reveal');
    if(window.revealObserver) window.revealObserver.disconnect();

    window.revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.05, rootMargin: "0px 0px -50px 0px" });
    
    reveals.forEach(r => window.revealObserver.observe(r));
}

function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const particleCount = window.innerWidth < 768 ? 20 : 40; 
    const colors = ['rgba(16, 185, 129, 0.4)', 'rgba(99, 102, 241, 0.4)', 'rgba(168, 85, 247, 0.3)'];

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4;
            this.radius = Math.random() * 2 + 1; this.baseRadius = this.radius;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.pulse = Math.random() * Math.PI * 2; this.pulseSpeed = 0.02 + Math.random() * 0.03;
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            this.pulse += this.pulseSpeed;
            this.radius = this.baseRadius + Math.sin(this.pulse) * 0.5;
        }
        draw() {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color; ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fill();
        }
    }
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// Auto-initialize background particles on script load
initParticles();

function renderEmptyState(containerId, title, subtitle, icon = "📊") {

    const container = document.getElementById(containerId);

    if (!container) return;

    container.innerHTML = `
        <div class="glass rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[220px] w-full">
            <div class="text-4xl opacity-70 mb-3">
                ${icon}
            </div>

            <h3 class="text-xl font-bold text-white mb-2">
                ${title}
            </h3>

            <p class="text-gray-400 text-sm max-w-md">
                ${subtitle}
            </p>
        </div>
    `;

    container.classList.remove("hidden");
}

// ==================================================
// MOBILE SIDEBAR MANAGEMENT
// ==================================================
function openSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    const btn = document.getElementById('mobileMenuBtn');
    
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('mobileBackdrop');
    const btn = document.getElementById('mobileMenuBtn');
    
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    
    // Restore background scrolling
    document.body.style.overflow = '';
}

function initializeMobileSidebar() {
    const btn = document.getElementById('mobileMenuBtn');
    const backdrop = document.getElementById('mobileBackdrop');
    const sidebar = document.getElementById('appSidebar');

    if (btn) btn.addEventListener('click', openSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });

    // Close when selecting any link/action inside the sidebar
    if (sidebar) {
        const links = sidebar.querySelectorAll('a, button:not(#mobileMenuBtn)');
        links.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1024) {
                    closeSidebar();
                }
            });
        });
    }
}

// Auto-initialize mobile sidebar logic
document.addEventListener('DOMContentLoaded', initializeMobileSidebar);
