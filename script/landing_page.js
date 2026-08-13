(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const routes = {
    entry: localStorage.getItem("accessToken") ? "dashboard.html" : "auth.html",
    login: localStorage.getItem("accessToken") ? "dashboard.html" : "auth.html"
  };

  ["entryLink", "heroEntry", "finalEntry"].forEach((id) => {
    const link = document.getElementById(id);
    if (link) link.href = routes.entry;
  });

  const loginLink = document.getElementById("loginLink");
  if (loginLink) {
    loginLink.href = routes.login;
    loginLink.textContent = localStorage.getItem("accessToken") ? "Dashboard" : "Login";
  }

  const nav = document.querySelector("[data-nav]");
  const updateNav = () => nav && nav.classList.toggle("is-scrolled", window.scrollY > 18);
  updateNav();
  window.addEventListener("scroll", updateNav, { passive: true });

  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobileMenu");
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!open));
      mobileMenu.hidden = open;
    });
    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        mobileMenu.hidden = true;
      });
    });
  }

  const revealEls = [...document.querySelectorAll(".reveal")];
  function syncReveals() {
    const trigger = window.innerHeight * 0.9;
    revealEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < trigger && rect.bottom > 0) el.classList.add("is-visible");
    });
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
  revealEls.forEach((el) => revealObserver.observe(el));
  syncReveals();
  window.addEventListener("scroll", syncReveals, { passive: true });

  document.querySelectorAll(".magnetic").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      if (reduceMotion) return;
      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.18;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.18;
      button.style.transform = `translate(${x}px, ${y}px)`;
    });
    button.addEventListener("pointerleave", () => {
      button.style.transform = "";
    });
  });

  const nodeCopy = {
    rating: ["Rating trajectory", "Contest outcomes and historical movement become context for planning, review, and skill prioritization."],
    topics: ["Topic priority", "Solved problems and topic exposure help the product surface where practice can produce the highest improvement."],
    behavior: ["Behavior signals", "Live contest telemetry can preserve evidence such as reading time, switching, submissions, and verdict flow."],
    contests: ["Contest replay", "Completed contest context becomes a timeline for review, reflection, and follow-up recommendations."],
    ai: ["AI reasoning", "General reasoning combines with personal context only when the question needs your history and progress."],
    progress: ["Adaptive progress", "Daily study plans, roadmaps, and recommendations update as new activity changes the evidence."],
  };

  const coreInsight = document.getElementById("coreInsight");
  const coreNodes = [...document.querySelectorAll(".core-node")];
  coreNodes.forEach((node) => {
    const activate = () => {
      coreNodes.forEach((item) => item.classList.toggle("is-active", item === node));
      const [title, body] = nodeCopy[node.dataset.node] || nodeCopy.rating;
      if (coreInsight) {
        coreInsight.querySelector("strong").textContent = title;
        coreInsight.querySelector("p").textContent = body;
      }
    };
    node.addEventListener("mouseenter", activate);
    node.addEventListener("focus", activate);
    node.addEventListener("click", activate);
  });

  const heatmap = document.querySelector(".mini-heatmap");
  if (heatmap) {
    const pattern = [0, 1, 0, 2, 3, 1, 0, 2, 1, 3, 0, 2, 1, 0, 2, 3, 1, 0, 1, 2, 0, 3, 2, 1, 0, 1, 3, 2, 0, 0, 1, 2, 3, 0, 2, 1, 1, 0, 3, 2, 0, 1, 2, 3, 1, 0, 2, 1, 3, 0, 1, 2, 0, 3, 2, 1];
    pattern.forEach((level, index) => {
      const cell = document.createElement("span");
      cell.dataset.lvl = String(level);
      cell.style.animationDelay = `${index * 12}ms`;
      heatmap.appendChild(cell);
    });
  }

  const recommendations = {
    "Binary Search": "Recommended next because recent practice shows pattern hesitation around monotonic predicates.",
    DP: "Recommended when recurrence formulation and state transitions need more recent repetition.",
    Graphs: "Recommended when traversal patterns should be reinforced before contest-heavy weeks.",
    Greedy: "Recommended when proof confidence is the blocker more than implementation speed.",
    Trees: "Recommended when hierarchical structures are appearing in missed or skipped problems.",
    "Two Pointers": "Recommended when linear scanning patterns can unlock faster early-contest solves.",
  };

  const recommendationDetail = document.getElementById("recommendationDetail");
  document.querySelectorAll(".skill-network button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".skill-network button").forEach((item) => item.classList.toggle("is-selected", item === button));
      if (recommendationDetail) {
        recommendationDetail.querySelector("h3").textContent = button.dataset.topic;
        recommendationDetail.querySelector("p").textContent = recommendations[button.dataset.topic];
      }
    });
  });

  const skillDetail = document.getElementById("skillDetail");
  document.querySelectorAll(".skill-stack button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".skill-stack button").forEach((item) => item.classList.toggle("is-active", item === button));
      if (skillDetail) {
        skillDetail.querySelector("h3").textContent = button.dataset.skill;
        skillDetail.querySelector("p").textContent = `Inspect recent activity, difficulty exposure, and the next recommended step for ${button.dataset.skill}.`;
      }
    });
  });

  const tours = {
    analytics: [
      ["Input", "Platform history", "Rating, submissions, topics, difficulty, streaks, and contest history enter the analytics surface."],
      ["Understanding", "Performance map", "Trajectory, heatmap, topic strength, distribution, and growth analytics become visible."],
      ["Action", "Priority surfaced", "The product points attention toward topics and practice patterns that matter next."]
    ],
    contest: [
      ["Event stream", "Replay timeline", "Opened problems, switches, submissions, verdicts, and progress create an evidence timeline."],
      ["Review", "Behavior + mistakes", "The review interface separates evidence, reasoning, mistakes, reflection, and recommendations."],
      ["Outcome", "Improvement plan", "Contest experience becomes focused practice instead of a vague feeling."]
    ],
    coach: [
      ["Question", "Intent detected", "General questions stay general; personal questions request relevant CPInsight context."],
      ["Context", "Evidence retrieved", "History, performance, behavior, contests, and progress are used when they matter."],
      ["Answer", "Coached response", "The result is advice grounded in the kind of data CPInsight already tracks."]
    ],
    planner: [
      ["Profile", "Current state", "Rating, topic priorities, and recent activity define the starting point."],
      ["Plan", "Daily + weekly structure", "Recommended problems and study sessions become a practical roadmap."],
      ["Adapt", "Feedback loop", "New progress changes the next recommendation rather than freezing the plan."]
    ],
    monitoring: [
      ["Browser", "Activity captured", "Contest interactions and verdict flow are converted into telemetry events."],
      ["Stream", "Live signal", "Telemetry feeds the live monitoring view without turning the page into noise."],
      ["Review", "Contest intelligence", "The same evidence can support later replay and AI review."]
    ]
  };

  const tourStage = document.getElementById("tourStage");
  function renderTour(name) {
    if (!tourStage) return;
    tourStage.innerHTML = "";
    tours[name].forEach(([label, title, body], index) => {
      const card = document.createElement("article");
      card.className = "tour-card";
      card.style.animationDelay = `${index * 80}ms`;
      card.innerHTML = `<span>${label}</span><h3>${title}</h3><p>${body}</p>`;
      tourStage.appendChild(card);
    });
  }
  renderTour("analytics");

  document.querySelectorAll(".tour-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tour-tabs button").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
      renderTour(button.dataset.tour);
    });
  });

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    return { width: canvas.width, height: canvas.height, ratio };
  }

  function startAmbientCanvas() {
    const canvas = document.getElementById("ambientCanvas");
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;
    let raf = 0;
    let size = resizeCanvas(canvas);

    const points = Array.from({ length: 44 }, (_, index) => ({
      x: (index * 97) % Math.max(size.width, 1),
      y: (index * 53) % Math.max(size.height, 1),
      speed: 0.18 + (index % 5) * 0.045
    }));

    function draw() {
      frame += 1;
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.fillStyle = "rgba(103, 232, 249, 0.28)";
      points.forEach((point, index) => {
        point.y -= point.speed;
        point.x += Math.sin((frame + index * 12) / 80) * 0.12;
        if (point.y < -10) point.y = size.height + 10;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", () => { size = resizeCanvas(canvas); }, { passive: true });
    draw();
    window.addEventListener("pagehide", () => cancelAnimationFrame(raf), { once: true });
  }

  function startCoreCanvas() {
    const canvas = document.getElementById("coreCanvas");
    const stage = document.getElementById("coreStage");
    if (!canvas || !stage || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    let size = resizeCanvas(canvas);
    let raf = 0;
    let frame = 0;
    let pointer = { x: 0.5, y: 0.5 };

    const nodes = [
      [0.17, 0.27], [0.78, 0.20], [0.82, 0.61], [0.15, 0.65], [0.50, 0.08], [0.50, 0.84]
    ];
    const packets = Array.from({ length: 20 }, (_, index) => ({
      edge: index % nodes.length,
      t: (index % 10) / 10,
      speed: 0.0024 + (index % 4) * 0.0007,
      color: index % 3 === 0 ? "#34d399" : index % 3 === 1 ? "#67e8f9" : "#60a5fa"
    }));

    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      pointer = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height
      };
      stage.style.transform = `rotateX(${(0.5 - pointer.y) * 3}deg) rotateY(${(pointer.x - 0.5) * 4}deg)`;
    });
    stage.addEventListener("pointerleave", () => {
      pointer = { x: 0.5, y: 0.5 };
      stage.style.transform = "";
    });

    function draw() {
      frame += 1;
      const cx = size.width * 0.5;
      const cy = size.height * 0.5;
      ctx.clearRect(0, 0, size.width, size.height);
      nodes.forEach(([nx, ny], index) => {
        const x = size.width * nx + (pointer.x - 0.5) * (index % 2 ? 10 : -10);
        const y = size.height * ny + (pointer.y - 0.5) * (index % 2 ? -8 : 8);
        ctx.strokeStyle = "rgba(103, 232, 249, 0.20)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo((cx + x) / 2, (cy + y) / 2 + Math.sin(frame / 70 + index) * 12, x, y);
        ctx.stroke();
      });

      packets.forEach((packet) => {
        const target = nodes[packet.edge];
        packet.t += packet.speed;
        if (packet.t > 1) packet.t = 0;
        const x = cx + (size.width * target[0] - cx) * packet.t;
        const y = cy + (size.height * target[1] - cy) * packet.t + Math.sin(frame / 60 + packet.edge) * 5;
        ctx.fillStyle = packet.color;
        ctx.shadowColor = packet.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      raf = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", () => { size = resizeCanvas(canvas); }, { passive: true });
    draw();
    window.addEventListener("pagehide", () => cancelAnimationFrame(raf), { once: true });
  }

  startAmbientCanvas();
  startCoreCanvas();
})();
