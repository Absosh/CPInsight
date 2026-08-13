import {
  animate,
  hover,
  inView,
  motionValue,
  press,
  scroll,
  springValue,
  stagger,
} from "motion";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktopMotion = window.matchMedia("(min-width: 1081px)");
const cleanups = [];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const springOptions = { type: "spring", stiffness: 240, damping: 24, mass: 0.72 };

document.documentElement.classList.add("motion-ready");

function addCleanup(cleanup) {
  if (typeof cleanup === "function") cleanups.push(cleanup);
  return cleanup;
}

function initRoutes() {
  const signedIn = Boolean(localStorage.getItem("accessToken"));
  const entry = signedIn ? "dashboard.html" : "auth.html";

  ["entryLink", "heroEntry", "finalEntry"].forEach((id) => {
    const link = document.getElementById(id);
    if (link) link.href = entry;
  });

  const loginLink = document.getElementById("loginLink");
  if (loginLink) {
    loginLink.href = entry;
    loginLink.textContent = signedIn ? "Dashboard" : "Login";
  }
}

function initNavigation() {
  const nav = document.querySelector("[data-nav]");
  const updateNav = () => nav?.classList.toggle("is-scrolled", window.scrollY > 18);
  updateNav();
  window.addEventListener("scroll", updateNav, { passive: true });
  addCleanup(() => window.removeEventListener("scroll", updateNav));

  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobileMenu");
  if (!menuToggle || !mobileMenu) return;

  const closeMenu = async () => {
    menuToggle.setAttribute("aria-expanded", "false");
    if (!reduceMotion && !mobileMenu.hidden) {
      await animate(mobileMenu, { opacity: [1, 0], y: [0, -12], scale: [1, 0.98] }, { duration: 0.2 });
    }
    mobileMenu.hidden = true;
  };

  menuToggle.addEventListener("click", async () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    if (open) {
      await closeMenu();
      return;
    }

    menuToggle.setAttribute("aria-expanded", "true");
    mobileMenu.hidden = false;
    if (!reduceMotion) {
      animate(mobileMenu, { opacity: [0, 1], y: [-12, 0], scale: [0.98, 1] }, springOptions);
      animate(mobileMenu.querySelectorAll("a"), { x: [-16, 0] }, { delay: stagger(0.035), ...springOptions });
    }
  });

  mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
}

function initCursorAura() {
  const aura = document.getElementById("cursorAura");
  if (!aura || reduceMotion || matchMedia("(pointer: coarse)").matches) return;

  const pointerX = motionValue(window.innerWidth / 2);
  const pointerY = motionValue(window.innerHeight / 2);
  const smoothX = springValue(pointerX, { stiffness: 95, damping: 22, mass: 0.8 });
  const smoothY = springValue(pointerY, { stiffness: 95, damping: 22, mass: 0.8 });
  let currentX = pointerX.get();
  let currentY = pointerY.get();
  let visible = false;

  const render = () => {
    aura.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  };
  const unsubscribeX = smoothX.on("change", (value) => { currentX = value; render(); });
  const unsubscribeY = smoothY.on("change", (value) => { currentY = value; render(); });
  const onMove = (event) => {
    pointerX.set(event.clientX);
    pointerY.set(event.clientY);
    if (!visible) {
      visible = true;
      animate(aura, { opacity: [0, 0.78] }, { duration: 0.6 });
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  addCleanup(() => {
    window.removeEventListener("pointermove", onMove);
    unsubscribeX();
    unsubscribeY();
  });
}

function initMagneticButtons() {
  document.querySelectorAll(".magnetic").forEach((button) => {
    const targetX = motionValue(0);
    const targetY = motionValue(0);
    const x = springValue(targetX, { stiffness: 250, damping: 20, mass: 0.45 });
    const y = springValue(targetY, { stiffness: 250, damping: 20, mass: 0.45 });
    const unsubscribeX = x.on("change", (value) => button.style.setProperty("--magnetic-x", `${value}px`));
    const unsubscribeY = y.on("change", (value) => button.style.setProperty("--magnetic-y", `${value}px`));

    const onMove = (event) => {
      if (reduceMotion || matchMedia("(pointer: coarse)").matches) return;
      const rect = button.getBoundingClientRect();
      targetX.set((event.clientX - rect.left - rect.width / 2) * 0.16);
      targetY.set((event.clientY - rect.top - rect.height / 2) * 0.16);
    };
    const onLeave = () => { targetX.set(0); targetY.set(0); };
    button.addEventListener("pointermove", onMove);
    button.addEventListener("pointerleave", onLeave);

    const cancelPress = reduceMotion ? null : press(button, () => {
      animate(button, { scale: 0.975 }, { duration: 0.12 });
      return () => animate(button, { scale: 1 }, springOptions);
    });

    addCleanup(() => {
      unsubscribeX();
      unsubscribeY();
      cancelPress?.();
      button.removeEventListener("pointermove", onMove);
      button.removeEventListener("pointerleave", onLeave);
    });
  });
}

function initHeroEntrance() {
  if (reduceMotion) return;

  const words = document.querySelectorAll(".headline-word");
  animate(".hero-copy .eyebrow", {
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
    x: [-18, 0],
  }, { duration: 0.72, delay: 0.08, ease: [0.16, 1, 0.3, 1] });
  animate(words, {
    y: ["115%", "0%"],
    rotateX: [38, 0],
    filter: ["blur(12px)", "blur(0px)"],
  }, { duration: 0.95, delay: stagger(0.055, { startDelay: 0.22 }), ease: [0.16, 1, 0.3, 1] });
  animate(".hero-lede", {
    clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"],
    y: [24, 0],
    filter: ["blur(8px)", "blur(0px)"],
  }, { duration: 0.8, delay: 0.72, ease: [0.16, 1, 0.3, 1] });
  animate(".hero-actions .button", { y: [22, 0], scale: [0.94, 1] }, {
    duration: 0.65,
    delay: stagger(0.08, { startDelay: 0.92 }),
    ...springOptions,
  });
  animate(".platform-strip > *", { x: [-18, 0], filter: ["blur(5px)", "blur(0px)"] }, {
    duration: 0.58,
    delay: stagger(0.045, { startDelay: 1.08 }),
  });
  animate(".hero-visual", {
    clipPath: ["inset(48% 48% 48% 48% round 30px)", "inset(0% 0% 0% 0% round 24px)"],
    scale: [0.9, 1],
    rotateY: [-6, 0],
    filter: ["blur(14px)", "blur(0px)"],
  }, { duration: 1.25, delay: 0.32, ease: [0.16, 1, 0.3, 1] });
  animate(".core-center", { scale: [0.2, 1.06, 1], rotate: [-8, 0] }, {
    duration: 1.1,
    delay: 0.92,
    ...springOptions,
  });
  animate(".core-node", { scale: [0.15, 1], filter: ["blur(10px)", "blur(0px)"] }, {
    duration: 0.82,
    delay: stagger(0.09, { startDelay: 1.18 }),
    ...springOptions,
  });
  animate(".core-insight", { x: [42, 0], clipPath: ["inset(0 0 0 100%)", "inset(0 0 0 0%)"] }, {
    duration: 0.82,
    delay: 1.72,
    ease: [0.16, 1, 0.3, 1],
  });
}

const nodeCopy = {
  rating: {
    title: "Rating trajectory",
    body: "Contest outcomes and historical movement become context for planning, review, and skill prioritization.",
    signals: ["Contests", "Trajectory", "Progress"],
    related: ["contests", "progress"],
  },
  topics: {
    title: "Topic priority",
    body: "Solved problems and topic exposure help surface where practice can produce the highest improvement.",
    signals: ["Strength", "Frequency", "Difficulty", "Recent activity"],
    related: ["behavior", "progress"],
  },
  behavior: {
    title: "Behavior signals",
    body: "Live contest telemetry preserves evidence such as reading time, problem switching, focus, and submission patterns.",
    signals: ["Reading time", "Switching", "Focus", "Submissions"],
    related: ["contests", "ai"],
  },
  contests: {
    title: "Contest replay",
    body: "Problems, submissions, verdicts, rank movement, and elapsed time become a timeline for review.",
    signals: ["Problems", "Submissions", "Rank", "Time"],
    related: ["behavior", "rating"],
  },
  ai: {
    title: "AI reasoning",
    body: "General intelligence combines with personal context only when the question needs your history and progress.",
    signals: ["Evidence", "Context", "Reasoning", "Answer"],
    related: ["behavior", "progress"],
  },
  progress: {
    title: "Adaptive progress",
    body: "Daily study plans, roadmaps, and recommendations update as new activity changes the evidence.",
    signals: ["Daily plan", "Roadmap", "Practice", "Feedback"],
    related: ["topics", "rating", "ai"],
  },
};

function initHeroCore() {
  const stage = document.getElementById("coreStage");
  const insight = document.getElementById("coreInsight");
  const nodes = [...document.querySelectorAll(".core-node")];
  const paths = [...document.querySelectorAll("[data-core-link]")];
  if (!stage || !insight || !nodes.length) return;

  const pointerX = motionValue(0);
  const pointerY = motionValue(0);
  const smoothX = springValue(pointerX, { stiffness: 120, damping: 24, mass: 0.75 });
  const smoothY = springValue(pointerY, { stiffness: 120, damping: 24, mass: 0.75 });
  let x = 0;
  let y = 0;
  const renderTilt = () => {
    stage.style.setProperty("--tilt-x", `${y * -3.2}deg`);
    stage.style.setProperty("--tilt-y", `${x * 4.2}deg`);
    stage.__pointer = { x: x * 0.5 + 0.5, y: y * 0.5 + 0.5 };
  };
  const unsubX = smoothX.on("change", (value) => { x = value; renderTilt(); });
  const unsubY = smoothY.on("change", (value) => { y = value; renderTilt(); });

  const onPointerMove = (event) => {
    if (reduceMotion || matchMedia("(pointer: coarse)").matches) return;
    const rect = stage.getBoundingClientRect();
    pointerX.set(clamp((event.clientX - rect.left) / rect.width, 0, 1) * 2 - 1);
    pointerY.set(clamp((event.clientY - rect.top) / rect.height, 0, 1) * 2 - 1);
  };
  const onPointerLeave = () => { pointerX.set(0); pointerY.set(0); };
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerleave", onPointerLeave);

  let selected = "rating";
  let userHoldUntil = 0;
  const activate = async (key, isUser = false) => {
    const config = nodeCopy[key] || nodeCopy.rating;
    selected = key;
    if (isUser) userHoldUntil = performance.now() + 7000;
    stage.dataset.focus = key;

    nodes.forEach((node) => {
      const nodeKey = node.dataset.node;
      const active = nodeKey === key;
      const related = config.related.includes(nodeKey);
      node.classList.toggle("is-active", active);
      node.classList.toggle("is-related", related);
      if (!reduceMotion) {
        animate(node, {
          scale: active ? 1.09 : related ? 1.025 : 0.94,
          y: active ? -5 : 0,
          opacity: active || related ? 1 : 0.48,
          filter: active ? "brightness(1.16)" : related ? "brightness(1.04)" : "brightness(0.72)",
        }, springOptions);
      } else {
        node.style.opacity = active || related ? "1" : "0.62";
      }
    });

    paths.forEach((path) => {
      const pathKey = path.dataset.coreLink;
      path.classList.toggle("is-related", pathKey === key || config.related.includes(pathKey));
      path.classList.toggle("is-muted", pathKey !== key && !config.related.includes(pathKey));
    });

    if (!reduceMotion) {
      await animate(insight, { x: [0, 16], filter: ["blur(0px)", "blur(7px)"], opacity: [1, 0.35] }, { duration: 0.16 });
    }
    insight.querySelector("strong").textContent = config.title;
    insight.querySelector("p").textContent = config.body;
    insight.querySelector(".core-insight-signals").innerHTML = config.signals.map((signal) => `<i>${signal}</i>`).join("");
    if (!reduceMotion) {
      animate(insight, { x: [16, 0], filter: ["blur(7px)", "blur(0px)"], opacity: [0.35, 1] }, { duration: 0.42, ease: [0.16, 1, 0.3, 1] });
      animate(insight.querySelectorAll("i"), { y: [8, 0], scale: [0.9, 1] }, { delay: stagger(0.035), ...springOptions });
    }
  };

  nodes.forEach((node) => {
    const activateFromUser = () => activate(node.dataset.node, true);
    node.addEventListener("pointerenter", activateFromUser);
    node.addEventListener("focus", activateFromUser);
    node.addEventListener("click", activateFromUser);
  });

  let cycleTimer = 0;
  const keys = Object.keys(nodeCopy);
  const stopCycle = () => { if (cycleTimer) window.clearInterval(cycleTimer); cycleTimer = 0; };
  addCleanup(inView(stage, () => {
    if (!reduceMotion) {
      cycleTimer = window.setInterval(() => {
        if (performance.now() < userHoldUntil || document.hidden) return;
        const next = (keys.indexOf(selected) + 1) % keys.length;
        activate(keys[next]);
      }, 3200);
    }
    const breath = reduceMotion ? null : animate(".core-center", { scale: [1, 1.035, 1] }, { duration: 4.6, repeat: Infinity, ease: "easeInOut" });
    return () => { stopCycle(); breath?.cancel(); };
  }, { margin: "60px" }));

  activate("rating");
  addCleanup(() => {
    stopCycle();
    unsubX();
    unsubY();
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerleave", onPointerLeave);
  });
}

function initCoreStreams() {
  const stage = document.getElementById("coreStage");
  const particleGroup = document.querySelector(".core-particles");
  const paths = [...document.querySelectorAll("[data-core-link]")];
  if (!stage || !particleGroup || !paths.length || reduceMotion) return;

  let initialized = false;
  let controls = [];
  addCleanup(inView(stage, () => {
    if (!initialized) {
      initialized = true;
      paths.forEach((path, pathIndex) => {
        controls.push(animate(path, { strokeDashoffset: [1, 0], opacity: [0.08, 0.72] }, {
          duration: 0.95,
          delay: 0.82 + pathIndex * 0.1,
          ease: [0.16, 1, 0.3, 1],
        }));

        const length = path.getTotalLength();
        const samples = Array.from({ length: 28 }, (_, index) => path.getPointAtLength(length * index / 27));
        for (let packetIndex = 0; packetIndex < 2; packetIndex += 1) {
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          const color = packetIndex === 0 ? "#67e8f9" : pathIndex % 2 ? "#34d399" : "#60a5fa";
          circle.setAttribute("r", packetIndex === 0 ? "3.2" : "2.3");
          circle.setAttribute("fill", color);
          circle.style.color = color;
          particleGroup.appendChild(circle);
          controls.push(animate(circle, {
            cx: samples.map((point) => point.x),
            cy: samples.map((point) => point.y),
            opacity: [0, 0.95, 0.95, 0],
          }, {
            duration: 3.2 + pathIndex * 0.22,
            delay: 1.3 + packetIndex * 1.1 + pathIndex * 0.18,
            repeat: Infinity,
            ease: "linear",
          }));
        }
      });

      document.querySelectorAll(".orbital-meta").forEach((label, index) => {
        controls.push(animate(label, {
          x: [0, index % 2 ? 9 : -8, 0],
          y: [0, index % 2 ? -7 : 8, 0],
        }, { duration: 6.5 + index, repeat: Infinity, ease: "easeInOut" }));
      });
    } else {
      controls.forEach((control) => control.play?.());
    }
    return () => controls.forEach((control) => control.pause?.());
  }, { margin: "80px" }));
}

function initSectionHeadings() {
  document.querySelectorAll(".section-heading").forEach((heading, index) => {
    let entered = false;
    addCleanup(inView(heading, () => {
      if (entered || reduceMotion) return;
      entered = true;
      const eyebrow = heading.querySelector(".eyebrow");
      const title = heading.querySelector("h2");
      const body = heading.querySelectorAll("p:not(.eyebrow)");
      if (eyebrow) animate(eyebrow, { x: [-24, 0], clipPath: ["inset(0 100% 0 0)", "inset(0 0 0 0)"] }, { duration: 0.55 });
      if (title) animate(title, {
        clipPath: [index % 2 ? "inset(0 0 0 100%)" : "inset(0 0 100% 0)", "inset(0 0 0 0)"],
        y: [index % 2 ? 0 : 34, 0],
        x: [index % 2 ? 34 : 0, 0],
        filter: ["blur(8px)", "blur(0px)"],
      }, { duration: 0.82, delay: 0.08, ease: [0.16, 1, 0.3, 1] });
      if (body.length) animate(body, { y: [18, 0], filter: ["blur(5px)", "blur(0px)"] }, { duration: 0.62, delay: 0.2 });
    }, { margin: "0px 0px -12% 0px" }));
  });
}

const storyStages = [
  { status: "RAW SIGNALS", core: "Signal intake" },
  { status: "PATTERNS CONNECTING", core: "Pattern map" },
  { status: "BEHAVIOR IDENTIFIED", core: "Behavior context" },
  { status: "AI REASONING", core: "Evidence reasoning" },
  { status: "ACTION READY", core: "Next action" },
];

function initIntelligenceStory() {
  const section = document.querySelector("[data-intelligence-story]");
  const stage = section?.querySelector(".intelligence-stage");
  if (!section || !stage) return;

  const cards = [...stage.querySelectorAll("[data-stage-card]")];
  const steps = [...section.querySelectorAll("[data-story-step]")];
  const paths = [...stage.querySelectorAll(".story-routes path")];
  const status = document.getElementById("storyStatus");
  const coreLabel = document.getElementById("storyCoreLabel");
  const core = stage.querySelector(".story-core");
  const output = stage.querySelector(".story-next-action");
  const eventFragments = [...stage.querySelectorAll(".story-event-stream span")];
  const orbitRings = [...stage.querySelectorAll(".story-orbits i")];
  let activeStage = -1;

  const configurations = [
    [
      { x: -28, y: -22, rotate: -3, scale: 0.94, opacity: 1 },
      { x: 38, y: -34, rotate: 3, scale: 0.9, opacity: 0.72 },
      { x: -34, y: 34, rotate: 2, scale: 0.88, opacity: 0.5 },
      { x: 30, y: 28, rotate: -2, scale: 0.86, opacity: 0.36 },
    ],
    [
      { x: 28, y: 24, rotate: 0, scale: 0.94, opacity: 0.78 },
      { x: -26, y: 24, rotate: 0, scale: 1.04, opacity: 1 },
      { x: 28, y: -24, rotate: 0, scale: 0.92, opacity: 0.68 },
      { x: -26, y: -24, rotate: 0, scale: 0.88, opacity: 0.42 },
    ],
    [
      { x: 12, y: 10, rotate: 0, scale: 0.88, opacity: 0.45 },
      { x: -12, y: 10, rotate: 0, scale: 0.92, opacity: 0.62 },
      { x: 12, y: -10, rotate: 0, scale: 1.08, opacity: 1 },
      { x: -12, y: -10, rotate: 0, scale: 0.9, opacity: 0.45 },
    ],
    [
      { x: 48, y: 18, rotate: 0, scale: 0.8, opacity: 0.24 },
      { x: -48, y: 18, rotate: 0, scale: 0.82, opacity: 0.3 },
      { x: 0, y: 0, rotate: 0, scale: 0.96, opacity: 0.82 },
      { x: 0, y: -12, rotate: 0, scale: 0.9, opacity: 0.46 },
    ],
    [
      { x: 36, y: 22, rotate: 0, scale: 0.78, opacity: 0.18 },
      { x: -36, y: 22, rotate: 0, scale: 0.8, opacity: 0.22 },
      { x: 24, y: -18, rotate: 0, scale: 0.88, opacity: 0.5 },
      { x: -24, y: -20, rotate: 0, scale: 1.1, opacity: 1 },
    ],
  ];

  const setStage = (index) => {
    const next = clamp(index, 0, storyStages.length - 1);
    if (next === activeStage) return;
    activeStage = next;
    stage.dataset.storyStage = String(next);
    steps.forEach((step, stepIndex) => step.classList.toggle("is-active", stepIndex === next));
    status.textContent = storyStages[next].status;
    coreLabel.textContent = storyStages[next].core;

    cards.forEach((card, cardIndex) => {
      const target = configurations[next][cardIndex];
      if (reduceMotion) {
        Object.assign(card.style, { opacity: String(target.opacity) });
      } else {
        animate(card, { ...target, filter: target.opacity < 0.4 ? "blur(1.5px)" : "blur(0px)" }, springOptions);
      }
    });

    if (!reduceMotion) {
      animate(core, {
        scale: next === 3 ? 1.12 : next === 4 ? 0.94 : 1,
        rotate: next === 3 ? [0, 2, 0] : 0,
        filter: next >= 3 ? "brightness(1.18)" : "brightness(1)",
      }, springOptions);
      animate(output, { opacity: next === 4 ? 1 : 0, y: next === 4 ? 0 : 18, scale: next === 4 ? 1 : 0.94 }, springOptions);
      eventFragments.forEach((fragment, fragmentIndex) => animate(fragment, {
        x: next >= 1 ? (50 - parseFloat(fragment.style.getPropertyValue("--sx"))) * 3.5 : 0,
        y: next >= 2 ? (50 - parseFloat(fragment.style.getPropertyValue("--sy"))) * 2.2 : 0,
        scale: next >= 3 ? 0.7 : 1,
        opacity: next === 4 ? 0.12 : next >= 1 ? 0.72 : 0.4,
      }, { ...springOptions, delay: fragmentIndex * 0.025 }));
      orbitRings.forEach((ring, ringIndex) => animate(ring, {
        scale: next === 0 ? 0.72 + ringIndex * 0.08 : next >= 3 ? 1.08 - ringIndex * 0.04 : 1,
        opacity: next === 4 ? 0.22 : 0.82 - ringIndex * 0.16,
      }, springOptions));
    } else {
      output.style.opacity = next === 4 ? "1" : "0";
    }
  };

  const renderProgress = (progress) => {
    const value = clamp(progress);
    stage.style.setProperty("--story-progress", value.toFixed(4));
    paths.forEach((path, index) => {
      const local = index === paths.length - 1 ? clamp((value - 0.68) / 0.28) : clamp(value * 1.18 - index * 0.035);
      path.style.strokeDashoffset = String(1 - local);
    });
    setStage(Math.min(4, Math.floor(value * 5)));
  };

  const scrollToStage = (index) => {
    if (!desktopMotion.matches || reduceMotion) {
      renderProgress(index / 4);
      return;
    }
    const top = section.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + distance * (index / 4), behavior: "smooth" });
  };
  steps.forEach((step, index) => step.querySelector("button")?.addEventListener("click", () => scrollToStage(index)));

  if (desktopMotion.matches && !reduceMotion) {
    const rawProgress = motionValue(0);
    const smoothProgress = springValue(rawProgress, { stiffness: 130, damping: 28, mass: 0.55 });
    const unsubscribe = smoothProgress.on("change", renderProgress);
    const cancelScroll = scroll((progress) => rawProgress.set(progress), {
      target: section,
      offset: ["start start", "end end"],
    });
    addCleanup(() => { unsubscribe(); cancelScroll?.(); });
    renderProgress(0);
  } else {
    renderProgress(1);
  }
}

function initPipeline() {
  const pipeline = document.querySelector("[data-flow-pipeline]");
  if (!pipeline) return;
  const nodes = [...pipeline.querySelectorAll("[data-flow-node]")];
  const packet = document.createElement("span");
  packet.className = "pipeline-packet";
  packet.setAttribute("aria-hidden", "true");
  pipeline.appendChild(packet);

  let activeIndex = 0;
  let timer = 0;
  const setActive = (index) => {
    activeIndex = index % nodes.length;
    nodes.forEach((node, nodeIndex) => node.classList.toggle("is-active", nodeIndex === activeIndex));
    if (!reduceMotion) animate(nodes[activeIndex], { scale: [0.98, 1.025, 1] }, springOptions);
  };

  addCleanup(inView(pipeline, () => {
    if (!reduceMotion) {
      nodes.forEach((node, index) => animate(node, {
        x: [index % 2 ? 32 : -32, 0],
        rotateY: [index % 2 ? -8 : 8, 0],
        filter: ["blur(6px)", "blur(0px)"],
      }, { delay: index * 0.08, ...springOptions }));
      const packetControl = animate(packet, { left: ["4%", "96%"], scale: [0.65, 1.2, 0.65] }, { duration: 5.4, repeat: Infinity, ease: "linear" });
      timer = window.setInterval(() => setActive(activeIndex + 1), 1080);
      setActive(0);
      return () => { packetControl.cancel(); window.clearInterval(timer); };
    }
    nodes.forEach((node) => node.classList.add("is-active"));
  }, { margin: "0px 0px -18% 0px" }));
}

function initAnalytics() {
  const wall = document.querySelector(".viz-wall");
  const heatmap = document.querySelector(".mini-heatmap");
  if (heatmap && !heatmap.children.length) {
    const pattern = [0,1,0,2,3,1,0,2,1,3,0,2,1,0,2,3,1,0,1,2,0,3,2,1,0,1,3,2,0,0,1,2,3,0,2,1,1,0,3,2,0,1,2,3,1,0,2,1,3,0,1,2,0,3,2,1];
    pattern.forEach((level) => {
      const cell = document.createElement("span");
      cell.dataset.lvl = String(level);
      heatmap.appendChild(cell);
    });
  }
  if (!wall) return;

  let entered = false;
  addCleanup(inView(wall, () => {
    if (entered || reduceMotion) return;
    entered = true;
    animate(".rating-line", { strokeDashoffset: [1, 0] }, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    animate(".rating-area", { opacity: [0, 1] }, { duration: 1.1, delay: 0.72 });
    animate(".rating-points circle", { scale: [0, 1] }, { delay: stagger(0.1, { startDelay: 0.74 }), ...springOptions });
    animate(".mini-heatmap span", { scale: [0, 1], rotate: [-12, 0] }, { delay: stagger(0.012), ...springOptions });
    animate(".bars span", { scaleY: [0.08, 1] }, { delay: stagger(0.1), duration: 0.82, ease: [0.16, 1, 0.3, 1] });
    animate(".rings span", { scale: [0.2, 1], rotate: [32, 0] }, { delay: stagger(0.11), ...springOptions });
  }, { margin: "0px 0px -16% 0px" }));

  document.querySelectorAll(".viz-panel").forEach((panel) => {
    const cancelHover = hover(panel, () => {
      if (!reduceMotion) animate(panel, { y: -5, rotateX: 1.2, scale: 1.006 }, springOptions);
      return () => { if (!reduceMotion) animate(panel, { y: 0, rotateX: 0, scale: 1 }, springOptions); };
    });
    addCleanup(cancelHover);
  });

  const chart = document.querySelector(".line-chart");
  const scrubber = chart?.querySelector(".chart-scrubber");
  const tooltip = chart?.querySelector(".chart-tooltip");
  if (chart && scrubber && tooltip) {
    chart.addEventListener("pointermove", (event) => {
      const rect = chart.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      scrubber.style.left = `${x}px`;
      tooltip.style.left = `${clamp(x + 12, 8, rect.width - 142)}px`;
      if (!reduceMotion) animate([scrubber, tooltip], { opacity: 1 }, { duration: 0.14 });
    });
    chart.addEventListener("pointerleave", () => {
      if (!reduceMotion) animate([scrubber, tooltip], { opacity: 0 }, { duration: 0.22 });
    });
  }
}

const contestEvents = {
  reading: ["READING", "Problem reading time enters the telemetry stream.", 0],
  switch: ["FOCUS SHIFT", "A problem switch becomes a behavioral signal.", 1],
  submission: ["VERDICT", "The submission and wrong-answer verdict join the event timeline.", 2],
  exploration: ["EXPLORATION COST", "Elapsed time and repeated exploration form review evidence.", 2],
  accepted: ["PROGRESS", "The accepted verdict completes the contest intelligence loop.", 3],
};

function initContestSimulation() {
  const simulation = document.querySelector("[data-contest-simulation]");
  if (!simulation) return;
  const events = [...simulation.querySelectorAll("[data-contest-event]")];
  const routerNodes = [...simulation.querySelectorAll("[data-router-node]")];
  const playhead = simulation.querySelector(".timeline-playhead");
  const rail = simulation.querySelector(".timeline-rail");
  const state = document.getElementById("contestState");
  const readout = document.getElementById("routerReadout");
  const routerPath = simulation.querySelector(".router-lines path");
  let activeIndex = 0;

  const setActive = (index) => {
    activeIndex = (index + events.length) % events.length;
    const event = events[activeIndex];
    const [label, description, routerIndex] = contestEvents[event.dataset.contestEvent];
    events.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === activeIndex));
    routerNodes.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex <= routerIndex));
    state.textContent = label;
    readout.textContent = description;
    if (!reduceMotion) {
      animate(event, { x: [-12, 0], scale: [0.985, 1.015, 1] }, springOptions);
      animate(routerNodes.slice(0, routerIndex + 1), { scale: [0.97, 1.015, 1] }, { delay: stagger(0.045), ...springOptions });
    }
  };

  events.forEach((event, index) => {
    event.addEventListener("pointerenter", () => setActive(index));
    event.addEventListener("focus", () => setActive(index));
  });

  addCleanup(inView(simulation, () => {
    events.forEach((event, index) => {
      if (!reduceMotion) animate(event, {
        x: [index % 2 ? 58 : -58, 0],
        rotateY: [index % 2 ? -8 : 8, 0],
        filter: ["blur(6px)", "blur(0px)"],
      }, { delay: index * 0.08, ...springOptions });
    });
    if (reduceMotion) { setActive(0); return; }

    const distance = Math.max(120, rail.getBoundingClientRect().height);
    const playheadControl = animate(playhead, { y: [0, distance] }, { duration: 7.2, repeat: Infinity, ease: "linear" });
    const routerControl = animate(routerPath, { strokeDashoffset: [0, -34] }, { duration: 2.8, repeat: Infinity, ease: "linear" });
    const timer = window.setInterval(() => setActive(activeIndex + 1), 1440);
    setActive(0);
    return () => { playheadControl.cancel(); routerControl.cancel(); window.clearInterval(timer); };
  }, { margin: "60px" }));
}

const reviewLabels = ["Contest event", "Evidence extracted", "Reasoning connected", "Behavior identified", "Improvement plan"];

function initReviewStory() {
  const section = document.querySelector("[data-review-story]");
  const consoleEl = section?.querySelector(".review-console");
  if (!section || !consoleEl) return;
  const steps = [...section.querySelectorAll("[data-review-step]")];
  const cards = [...section.querySelectorAll("[data-review-card]")];
  const eventCard = section.querySelector(".event-column");
  const eventLabel = eventCard.querySelector("span");
  const arrowPath = section.querySelector(".review-arrow path");
  const output = section.querySelector(".review-output");
  const relationshipPaths = [...section.querySelectorAll("[data-review-link]")];
  const packetLayer = section.querySelector(".review-packets");
  let packetControls = [];
  let activeStage = -1;

  const setStage = (index) => {
    const next = clamp(index, 0, 4);
    if (next === activeStage) return;
    activeStage = next;
    consoleEl.dataset.reviewStage = String(next);
    steps.forEach((step, stepIndex) => step.classList.toggle("is-active", stepIndex === next));
    eventLabel.textContent = reviewLabels[next];
    relationshipPaths.forEach((path, pathIndex) => path.classList.toggle("is-active", pathIndex + 1 === next || next === 4));

    cards.forEach((card, cardIndex) => {
      const cardStage = cardIndex + 1;
      const active = next === cardStage || (next === 4 && cardStage === 4);
      const passed = next > cardStage;
      card.classList.toggle("is-active", active);
      if (!reduceMotion) {
        animate(card, {
          x: active ? -8 : passed ? 10 : 28,
          scale: active ? 1.035 : passed ? 0.96 : 0.92,
          opacity: active ? 1 : passed ? 0.52 : 0.26,
          filter: active ? "blur(0px)" : "blur(0.7px)",
        }, springOptions);
      } else {
        card.style.opacity = active ? "1" : "0.62";
      }
    });

    if (!reduceMotion) {
      animate(eventCard, {
        x: next * 12,
        scale: 1 - next * 0.035,
        opacity: next === 4 ? 0.4 : 1 - next * 0.1,
        filter: next >= 3 ? "saturate(0.7)" : "saturate(1)",
      }, springOptions);
      animate(output, { opacity: next === 4 ? 1 : 0, y: next === 4 ? 0 : 18, scale: next === 4 ? 1 : 0.94 }, springOptions);
      packetControls.forEach((control) => control.cancel?.());
      packetControls = [];
      packetLayer.innerHTML = "";
      if (next > 0) {
        const activePath = relationshipPaths[Math.min(next - 1, relationshipPaths.length - 1)];
        const length = activePath.getTotalLength();
        const samples = Array.from({ length: 24 }, (_, sampleIndex) => activePath.getPointAtLength(length * sampleIndex / 23));
        for (let packetIndex = 0; packetIndex < 2; packetIndex += 1) {
          const packet = document.createElement("span");
          packet.className = "review-packet";
          packetLayer.appendChild(packet);
          packetControls.push(animate(packet, {
            left: samples.map((point) => `${point.x / 9}%`),
            top: samples.map((point) => `${point.y / 6.1}%`),
            opacity: [0, 1, 1, 0],
          }, { duration: 2.2, delay: packetIndex * 1.05, repeat: Infinity, ease: "linear" }));
        }
      }
    } else {
      output.style.opacity = next === 4 ? "1" : "0";
    }
  };

  const renderProgress = (progress) => {
    const value = clamp(progress);
    arrowPath.style.strokeDashoffset = String(1 - clamp(value * 1.35));
    setStage(Math.min(4, Math.floor(value * 5)));
    consoleEl.style.setProperty("--review-progress", value.toFixed(4));
  };

  const scrollToStage = (index) => {
    if (!desktopMotion.matches || reduceMotion) { renderProgress(index / 4); return; }
    const top = section.getBoundingClientRect().top + scrollY;
    const distance = Math.max(0, section.offsetHeight - innerHeight);
    window.scrollTo({ top: top + distance * (index / 4), behavior: "smooth" });
  };
  steps.forEach((step, index) => step.querySelector("button")?.addEventListener("click", () => scrollToStage(index)));

  if (desktopMotion.matches && !reduceMotion) {
    const rawProgress = motionValue(0);
    const smoothProgress = springValue(rawProgress, { stiffness: 130, damping: 28, mass: 0.55 });
    const unsubscribe = smoothProgress.on("change", renderProgress);
    const cancelScroll = scroll((progress) => rawProgress.set(progress), { target: section, offset: ["start start", "end end"] });
    addCleanup(() => { unsubscribe(); cancelScroll?.(); });
    renderProgress(0);
  } else {
    renderProgress(4 / 5);
  }
}

function initCoach() {
  const coach = document.getElementById("coachLogic");
  if (!coach) return;
  const selectors = [...coach.querySelectorAll("[data-coach-select]")];
  const cards = [...coach.querySelectorAll("[data-coach-card]")];
  const contextWell = coach.querySelector(".coach-context-well");
  const question = coach.querySelector(".coach-question");
  const reasoning = coach.querySelector(".coach-reasoning");
  const answer = coach.querySelector(".coach-answer");
  const packetLayer = coach.querySelector(".coach-packets");
  const routes = [...coach.querySelectorAll(".coach-routes path")];
  let packetControls = [];

  const clearPackets = () => {
    packetControls.forEach((control) => control.cancel?.());
    packetControls = [];
    packetLayer.innerHTML = "";
  };

  const createPackets = (mode) => {
    clearPackets();
    if (reduceMotion) return;
    const flowRect = coach.querySelector(".coach-pipeline").getBoundingClientRect();
    const start = mode === "personal" ? contextWell.getBoundingClientRect() : question.getBoundingClientRect();
    const end = reasoning.getBoundingClientRect();
    const startX = start.right - flowRect.left;
    const endX = end.left - flowRect.left;
    const startY = start.top - flowRect.top + start.height / 2;
    const count = mode === "personal" ? 4 : 1;

    for (let index = 0; index < count; index += 1) {
      const packet = document.createElement("span");
      packet.className = "coach-packet";
      packet.style.left = `${startX}px`;
      packet.style.top = `${startY + (index - (count - 1) / 2) * 14}px`;
      packetLayer.appendChild(packet);
      packetControls.push(animate(packet, {
        x: [0, (endX - startX) * 0.48, endX - startX],
        y: [0, index % 2 ? -10 : 10, 0],
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1.15, 0.7],
      }, { duration: 2.4, delay: index * 0.28, repeat: Infinity, ease: "linear" }));
    }
  };

  const setMode = (mode) => {
    coach.dataset.coachMode = mode;
    selectors.forEach((button) => button.setAttribute("aria-selected", String(button.dataset.coachSelect === mode)));
    cards.forEach((card) => card.classList.toggle("is-selected", card.dataset.coachCard === mode));
    const personal = mode === "personal";
    if (!reduceMotion) {
      animate(contextWell, {
        scale: personal ? 1 : 0.88,
        opacity: personal ? 1 : 0.28,
        y: personal ? 0 : 18,
        filter: personal ? "blur(0px)" : "blur(2px)",
      }, springOptions);
      animate(answer, { scale: [0.94, 1.035, 1], filter: ["brightness(0.8)", "brightness(1.18)", "brightness(1)"] }, springOptions);
      routes.forEach((path, index) => animate(path, {
        strokeDashoffset: [1, index === 1 && !personal ? 1 : 0],
        opacity: index === 1 && !personal ? 0.18 : 1,
      }, { duration: 0.62, delay: index * 0.08 }));
    }
    createPackets(mode);
  };

  selectors.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.coachSelect)));
  cards.forEach((card) => card.addEventListener("click", () => setMode(card.dataset.coachCard)));

  addCleanup(inView(coach, () => {
    setMode(coach.dataset.coachMode || "personal");
    if (!reduceMotion) {
      animate([question, reasoning, answer], { y: [24, 0], rotateX: [-8, 0], filter: ["blur(6px)", "blur(0px)"] }, { delay: stagger(0.09), ...springOptions });
    }
    return clearPackets;
  }, { margin: "60px" }));
}

function flipLayout(elements, mutate) {
  const first = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
  mutate();
  requestAnimationFrame(() => {
    elements.forEach((element) => {
      const before = first.get(element);
      const after = element.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (reduceMotion) return;
      animate(element, { x: [dx, 0], y: [dy, 0], scale: [0.96, 1] }, springOptions);
    });
  });
}

function initPlanner() {
  const flow = document.getElementById("plannerFlow");
  const advance = document.getElementById("plannerAdvance");
  const adapt = document.getElementById("plannerAdapt");
  const status = document.getElementById("plannerStatus");
  if (!flow || !advance || !adapt || !status) return;

  const getItems = () => [...flow.querySelectorAll("[data-planner-key]")];
  let completionIndex = 0;
  advance.addEventListener("click", () => {
    const items = getItems();
    const item = items.find((candidate) => !candidate.classList.contains("is-complete"));
    if (!item) {
      items.forEach((candidate) => candidate.classList.remove("is-complete", "is-priority"));
      completionIndex = 0;
      status.textContent = "A new planning cycle has started from the latest evidence.";
      return;
    }
    flipLayout(items, () => {
      item.classList.add("is-complete");
      item.classList.remove("is-priority");
      item.querySelector("small").textContent = "completed";
      flow.appendChild(item);
    });
    completionIndex += 1;
    status.textContent = `${item.querySelector("span").textContent} moved into progress. The remaining plan rebalanced.`;
  });

  adapt.addEventListener("click", () => {
    const items = getItems();
    const order = ["priorities", "problems", "daily", "weekly", "progress", "rating", "contest"];
    flipLayout(items, () => {
      order.forEach((key) => {
        const item = items.find((candidate) => candidate.dataset.plannerKey === key);
        if (item) flow.appendChild(item);
      });
      items.forEach((item) => item.classList.toggle("is-priority", ["priorities", "problems"].includes(item.dataset.plannerKey)));
    });
    status.textContent = "The latest contest signal raised topic priorities and recommended problems to the front of the plan.";
    if (!reduceMotion) animate(flow.querySelectorAll(".is-priority"), { scale: [0.96, 1.045, 1] }, { delay: stagger(0.06), ...springOptions });
  });

  addCleanup(inView(flow, () => {
    if (!reduceMotion) animate(getItems(), { x: [36, 0], rotateY: [-7, 0], filter: ["blur(5px)", "blur(0px)"] }, { delay: stagger(0.07), ...springOptions });
  }, { margin: "0px 0px -14% 0px" }));
}

const recommendations = {
  "Binary Search": "Recommended next because recent practice shows pattern hesitation around monotonic predicates.",
  DP: "Recommended when recurrence formulation and state transitions need more recent repetition.",
  Graphs: "Recommended when traversal patterns should be reinforced before contest-heavy weeks.",
  Greedy: "Recommended when proof confidence is the blocker more than implementation speed.",
  Trees: "Recommended when hierarchical structures are appearing in missed or skipped problems.",
  "Two Pointers": "Recommended when linear scanning patterns can unlock faster early-contest solves.",
};

function initSkillGraph() {
  const graph = document.getElementById("skillNetwork");
  const svg = document.getElementById("skillEdges");
  const detail = document.getElementById("recommendationDetail");
  if (!graph || !svg || !detail) return;
  const nodes = [...graph.querySelectorAll("[data-topic]")];
  const edgePairs = [
    ["Binary Search", "Greedy"], ["Binary Search", "Two Pointers"], ["Greedy", "Two Pointers"],
    ["DP", "Graphs"], ["DP", "Trees"], ["Graphs", "Trees"], ["DP", "Greedy"], ["Graphs", "Two Pointers"],
  ];
  const simulationNodes = nodes.map((node, index) => ({
    id: node.dataset.topic,
    node,
    x: graph.clientWidth * parseFloat(node.style.getPropertyValue("--nx")) / 100,
    y: graph.clientHeight * parseFloat(node.style.getPropertyValue("--ny")) / 100,
    anchorX: graph.clientWidth * parseFloat(node.style.getPropertyValue("--nx")) / 100,
    anchorY: graph.clientHeight * parseFloat(node.style.getPropertyValue("--ny")) / 100,
    index,
  }));
  const simulationLinks = edgePairs.map(([source, target]) => ({ source, target }));
  let selected = "Binary Search";
  let edgePaths = [];

  const drawEdges = () => {
    const graphRect = graph.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${graphRect.width} ${graphRect.height}`);
    if (edgePaths.length !== edgePairs.length) {
      svg.innerHTML = "";
      edgePaths = edgePairs.map(([a, b]) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("pathLength", "1");
        path.dataset.a = a;
        path.dataset.b = b;
        svg.appendChild(path);
        return path;
      });
    }
    edgePairs.forEach(([a, b], index) => {
      const nodeA = nodes.find((node) => node.dataset.topic === a).getBoundingClientRect();
      const nodeB = nodes.find((node) => node.dataset.topic === b).getBoundingClientRect();
      const ax = nodeA.left - graphRect.left + nodeA.width / 2;
      const ay = nodeA.top - graphRect.top + nodeA.height / 2;
      const bx = nodeB.left - graphRect.left + nodeB.width / 2;
      const by = nodeB.top - graphRect.top + nodeB.height / 2;
      const path = edgePaths[index];
      const bend = Math.abs(ax - bx) * 0.08 + 18;
      path.setAttribute("d", `M${ax} ${ay} Q${(ax + bx) / 2} ${(ay + by) / 2 - bend} ${bx} ${by}`);
    });
  };

  const renderSimulation = () => {
    simulationNodes.forEach((datum) => {
      const x = clamp(datum.x, 72, graph.clientWidth - 72);
      const y = clamp(datum.y, 62, graph.clientHeight - 62);
      datum.node.style.left = `${x}px`;
      datum.node.style.top = `${y}px`;
    });
    drawEdges();
  };

  const simulation = forceSimulation(simulationNodes)
    .force("link", forceLink(simulationLinks).id((datum) => datum.id).distance(180).strength(0.16))
    .force("charge", forceManyBody().strength(-150))
    .force("collide", forceCollide(70))
    .force("center", forceCenter(graph.clientWidth / 2, graph.clientHeight / 2).strength(0.04))
    .alphaDecay(0.045)
    .velocityDecay(0.48)
    .on("tick", renderSimulation);

  const releaseNode = (datum, node, pointerId) => {
    if (pointerId !== undefined && node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
    datum.fx = null;
    datum.fy = null;
    node.classList.remove("is-dragging");
    simulation.alphaTarget(0).alpha(0.2).restart();
  };

  const pullToAnchors = window.setInterval(() => {
    simulationNodes.forEach((datum) => {
      datum.vx += (datum.anchorX - datum.x) * 0.015;
      datum.vy += (datum.anchorY - datum.y) * 0.015;
    });
    if (!document.hidden) simulation.alpha(0.08).restart();
  }, 1800);

  const activate = async (topic, commit = false) => {
    if (commit) selected = topic;
    const source = nodes.find((node) => node.dataset.topic === topic);
    const related = (source.dataset.related || "").split(",").filter(Boolean);
    nodes.forEach((node) => {
      const active = node.dataset.topic === topic;
      const isRelated = related.includes(node.dataset.topic);
      node.classList.toggle("is-selected", active);
      node.classList.toggle("is-related", isRelated);
      if (!reduceMotion) animate(node, {
        scale: active ? 1.1 : isRelated ? 1.035 : 0.91,
        opacity: active || isRelated ? 1 : 0.44,
        filter: active ? "brightness(1.2)" : isRelated ? "brightness(1.05)" : "brightness(0.7)",
      }, springOptions);
    });
    edgePaths.forEach((path) => {
      const active = [path.dataset.a, path.dataset.b].includes(topic) ||
        (related.includes(path.dataset.a) && related.includes(path.dataset.b));
      path.classList.toggle("is-active", active);
      path.classList.toggle("is-muted", !active);
      if (active && !reduceMotion) animate(path, { strokeDashoffset: [1, 0] }, { duration: 0.55 });
    });

    const sourceDatum = simulationNodes.find((datum) => datum.id === topic);
    graph.style.setProperty("--focus-x", `${sourceDatum?.x ?? graph.clientWidth / 2}px`);
    graph.style.setProperty("--focus-y", `${sourceDatum?.y ?? graph.clientHeight / 2}px`);
    if (!commit) return;
    if (!reduceMotion) await animate(detail, { x: [0, 18], opacity: [1, 0.3], filter: ["blur(0px)", "blur(6px)"] }, { duration: 0.16 });
    detail.querySelector("h3").textContent = topic;
    detail.querySelector("p").textContent = recommendations[topic];
    if (!reduceMotion) animate(detail, { x: [18, 0], opacity: [0.3, 1], filter: ["blur(6px)", "blur(0px)"] }, { duration: 0.4, ease: [0.16, 1, 0.3, 1] });
  };

  nodes.forEach((node) => {
    const datum = simulationNodes.find((candidate) => candidate.id === node.dataset.topic);
    let origin = null;
    node.addEventListener("pointerenter", () => activate(node.dataset.topic));
    node.addEventListener("focus", () => activate(node.dataset.topic));
    node.addEventListener("click", () => activate(node.dataset.topic, true));
    node.addEventListener("pointerdown", (event) => {
      if (reduceMotion || event.button !== 0) return;
      origin = { x: event.clientX, y: event.clientY };
      node.setPointerCapture(event.pointerId);
      node.classList.add("is-dragging");
      datum.fx = datum.x;
      datum.fy = datum.y;
      simulation.alphaTarget(0.22).restart();
    });
    node.addEventListener("pointermove", (event) => {
      if (!node.hasPointerCapture(event.pointerId) || !origin) return;
      const rect = graph.getBoundingClientRect();
      datum.fx = clamp(event.clientX - rect.left, 72, rect.width - 72);
      datum.fy = clamp(event.clientY - rect.top, 62, rect.height - 62);
      activate(node.dataset.topic);
    });
    node.addEventListener("pointerup", (event) => {
      origin = null;
      releaseNode(datum, node, event.pointerId);
    });
    node.addEventListener("pointercancel", (event) => {
      origin = null;
      releaseNode(datum, node, event.pointerId);
    });
  });
  graph.addEventListener("pointerleave", () => activate(selected));

  const pointerX = motionValue(0);
  const pointerY = motionValue(0);
  const smoothX = springValue(pointerX, { stiffness: 110, damping: 24 });
  const smoothY = springValue(pointerY, { stiffness: 110, damping: 24 });
  const unsubX = smoothX.on("change", (value) => graph.style.setProperty("--graph-ry", `${value * 2.2}deg`));
  const unsubY = smoothY.on("change", (value) => graph.style.setProperty("--graph-rx", `${value * -1.8}deg`));
  graph.addEventListener("pointermove", (event) => {
    if (reduceMotion || matchMedia("(pointer: coarse)").matches) return;
    const rect = graph.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  });
  graph.addEventListener("pointerleave", () => { pointerX.set(0); pointerY.set(0); activate(selected); });

  drawEdges();
  const onResize = () => {
    simulationNodes.forEach((datum) => {
      datum.anchorX = graph.clientWidth * parseFloat(datum.node.style.getPropertyValue("--nx")) / 100;
      datum.anchorY = graph.clientHeight * parseFloat(datum.node.style.getPropertyValue("--ny")) / 100;
    });
    simulation.force("center", forceCenter(graph.clientWidth / 2, graph.clientHeight / 2).strength(0.04));
    simulation.alpha(0.24).restart();
    drawEdges();
  };
  window.addEventListener("resize", onResize, { passive: true });
  addCleanup(() => {
    window.removeEventListener("resize", onResize);
    unsubX();
    unsubY();
    simulation.stop();
    window.clearInterval(pullToAnchors);
  });
  addCleanup(inView(graph, () => {
    if (!reduceMotion) {
      animate(edgePaths, { strokeDashoffset: [1, 0] }, { delay: stagger(0.07), duration: 0.82 });
      animate(nodes, { scale: [0.25, 1], filter: ["blur(8px)", "blur(0px)"] }, { delay: stagger(0.08), ...springOptions });
    }
    activate(selected);
  }, { margin: "0px 0px -12% 0px" }));
}

function initSkillStack() {
  const detail = document.getElementById("skillDetail");
  const buttons = [...document.querySelectorAll(".skill-stack button")];
  if (!detail || !buttons.length) return;
  buttons.forEach((button) => button.addEventListener("click", async () => {
    buttons.forEach((item) => item.classList.toggle("is-active", item === button));
    if (!reduceMotion) await animate(detail, { y: [0, 14], opacity: [1, 0.3], filter: ["blur(0px)", "blur(5px)"] }, { duration: 0.16 });
    detail.querySelector("h3").textContent = button.dataset.skill;
    detail.querySelector("p").textContent = `Inspect recent activity, difficulty exposure, and the next recommended step for ${button.dataset.skill}.`;
    if (!reduceMotion) {
      animate(detail, { y: [14, 0], opacity: [0.3, 1], filter: ["blur(5px)", "blur(0px)"] }, { duration: 0.4 });
      animate(button, { scale: [0.96, 1.04, 1] }, springOptions);
    }
  }));
}

const tours = {
  analytics: {
    status: "PERFORMANCE MAP",
    className: "analytics",
    scene: `<div class="tour-mini-chart" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="tour-mini-heatmap" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>`,
    steps: [
    ["Input", "Platform history", "Rating, submissions, topics, difficulty, streaks, and contest history enter the analytics surface."],
    ["Understanding", "Performance map", "Trajectory, heatmap, topic strength, distribution, and growth analytics become visible."],
    ["Action", "Priority surfaced", "The product points attention toward topics and practice patterns that matter next."],
    ],
  },
  contest: {
    status: "REVIEW ASSEMBLY",
    className: "contest",
    scene: `<div class="tour-contest-line" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="tour-insight-stack" aria-hidden="true"><span>Evidence</span><span>Behavior</span><span>Recommendation</span></div>`,
    steps: [
    ["Event stream", "Replay timeline", "Opened problems, switches, submissions, verdicts, and progress create an evidence timeline."],
    ["Review", "Behavior + mistakes", "The review interface separates evidence, reasoning, mistakes, reflection, and recommendations."],
    ["Outcome", "Improvement plan", "Contest experience becomes focused practice instead of a vague feeling."],
    ],
  },
  coach: {
    status: "CONTEXT ROUTING",
    className: "coach",
    scene: `<div class="tour-context-source" aria-hidden="true"><span>History</span><span>Behavior</span><span>Contests</span></div><div class="tour-reasoning-core" aria-hidden="true">Reasoning</div><div class="tour-answer-node" aria-hidden="true">Answer</div>`,
    steps: [
    ["Question", "Intent detected", "General questions stay general; personal questions request relevant CPInsight context."],
    ["Context", "Evidence retrieved", "History, performance, behavior, contests, and progress are used when they matter."],
    ["Answer", "Coached response", "The result is advice grounded in the kind of data CPInsight already tracks."],
    ],
  },
  planner: {
    status: "PLAN ADAPTING",
    className: "planner",
    scene: `<div class="tour-plan-items" aria-hidden="true"><span>Topic priorities</span><span>Problems</span><span>Daily plan</span><span>Progress</span></div><div class="tour-plan-feedback" aria-hidden="true">NEW CONTEST SIGNAL</div>`,
    steps: [
    ["Profile", "Current state", "Rating, topic priorities, and recent activity define the starting point."],
    ["Plan", "Daily + weekly structure", "Recommended problems and study sessions become a practical roadmap."],
    ["Adapt", "Feedback loop", "New progress changes the next recommendation rather than freezing the plan."],
    ],
  },
  monitoring: {
    status: "TELEMETRY LIVE",
    className: "monitoring",
    scene: `<div class="tour-event-feed" aria-hidden="true"><span>00:04 Problem opened</span><span>00:19 Problem switched</span><span>00:38 Wrong answer</span><span>01:24 Accepted</span></div><div class="tour-monitor-pulse" aria-hidden="true"></div>`,
    steps: [
    ["Browser", "Activity captured", "Contest interactions and verdict flow are converted into telemetry events."],
    ["Stream", "Live signal", "Telemetry feeds the live monitoring view without turning the page into noise."],
    ["Review", "Contest intelligence", "The same evidence can support later replay and AI review."],
    ],
  },
};

function initTour() {
  const stage = document.getElementById("tourStage");
  const tabs = [...document.querySelectorAll(".tour-tabs button")];
  if (!stage || !tabs.length) return;
  const shell = stage.closest(".tour-shell");
  let switching = false;
  let currentName = "analytics";
  let paused = false;
  let userPauseUntil = 0;
  let rotationTimer = 0;

  const render = async (name, immediate = false) => {
    if (switching) return;
    switching = true;
    const oldCards = [...stage.children];
    if (oldCards.length && !immediate && !reduceMotion) {
      await animate(oldCards, { x: [0, -42], scale: [1, 0.96], opacity: [1, 0], filter: ["blur(0px)", "blur(6px)"] }, { delay: stagger(0.035), duration: 0.24 });
    }
    const tour = tours[name];
    currentName = name;
    tabs.forEach((item) => item.setAttribute("aria-selected", String(item.dataset.tour === name)));
    stage.className = `tour-stage tour-stage-${tour.className}`;
    stage.innerHTML = `
      <div class="tour-scene">
        <div class="tour-scene-hud"><span>${name.toUpperCase()} / ILLUSTRATIVE</span><strong>${tour.status}</strong></div>
        ${tour.scene}
      </div>
      <div class="tour-step-list">
        ${tour.steps.map(([label, title, body]) => `<article class="tour-card"><span>${label}</span><h3>${title}</h3><p>${body}</p></article>`).join("")}
      </div>`;
    if (!immediate && !reduceMotion) {
      animate(stage.querySelector(".tour-scene"), { x: [-52, 0], rotateY: [8, 0], scale: [0.94, 1], filter: ["blur(6px)", "blur(0px)"] }, springOptions);
      animate(stage.querySelectorAll(".tour-card"), { x: [52, 0], rotateY: [-8, 0], scale: [0.94, 1], filter: ["blur(6px)", "blur(0px)"] }, { delay: stagger(0.07), ...springOptions });
    }
    switching = false;
  };

  tabs.forEach((button, index) => {
    button.addEventListener("click", () => {
      userPauseUntil = Date.now() + 16000;
      render(button.dataset.tour);
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  });
  if (!reduceMotion) {
    const startRotation = () => {
      window.clearInterval(rotationTimer);
      rotationTimer = window.setInterval(() => {
        if (paused || switching || Date.now() < userPauseUntil || document.hidden) return;
        const index = tabs.findIndex((tab) => tab.dataset.tour === currentName);
        render(tabs[(index + 1) % tabs.length].dataset.tour);
      }, 7200);
    };
    const stopRotation = () => window.clearInterval(rotationTimer);
    shell?.addEventListener("pointerenter", () => { paused = true; });
    shell?.addEventListener("pointerleave", () => { paused = false; });
    shell?.addEventListener("focusin", () => { paused = true; });
    shell?.addEventListener("focusout", () => { paused = false; });
    addCleanup(inView(stage, () => {
      startRotation();
      return stopRotation;
    }, { margin: "0px 0px -10% 0px" }));
    addCleanup(stopRotation);
  }
  render("analytics", true);
}

function initArchitecture() {
  const items = [...document.querySelectorAll(".architecture-strip span")];
  items.forEach((item, index) => {
    item.tabIndex = 0;
    const cancelHover = hover(item, () => {
      items.forEach((candidate, candidateIndex) => candidate.classList.toggle("is-active", Math.abs(candidateIndex - index) <= 1));
      if (!reduceMotion) animate(item, { y: -6, scale: 1.035 }, springOptions);
      return () => {
        items.forEach((candidate) => candidate.classList.remove("is-active"));
        if (!reduceMotion) animate(item, { y: 0, scale: 1 }, springOptions);
      };
    });
    addCleanup(cancelHover);
  });

  const strip = document.querySelector(".architecture-strip");
  if (strip) addCleanup(inView(strip, () => {
    if (!reduceMotion) animate(items, { x: [-40, 0], rotateY: [10, 0], filter: ["blur(6px)", "blur(0px)"] }, { delay: stagger(0.055), ...springOptions });
  }, { margin: "0px 0px -12% 0px" }));
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  return { width: canvas.width, height: canvas.height, ratio };
}

function initAmbientCanvas() {
  const canvas = document.getElementById("ambientCanvas");
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext("2d");
  let size = resizeCanvas(canvas);
  let raf = 0;
  let lastFrame = 0;
  let running = true;
  const pointCount = innerWidth < 680 ? 24 : 38;
  const points = Array.from({ length: pointCount }, (_, index) => ({
    x: (index * 137) % Math.max(size.width, 1),
    y: (index * 79) % Math.max(size.height, 1),
    speed: 0.12 + (index % 5) * 0.035,
    phase: index * 0.73,
  }));

  const draw = (time) => {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    if (time - lastFrame < 32) return;
    lastFrame = time;
    ctx.clearRect(0, 0, size.width, size.height);
    points.forEach((point, index) => {
      point.y -= point.speed;
      point.x += Math.sin(time * 0.00025 + point.phase) * 0.08;
      if (point.y < -12) point.y = size.height + 12;
      ctx.fillStyle = index % 4 === 0 ? "rgba(52, 211, 153, 0.28)" : "rgba(103, 232, 249, 0.22)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, index % 5 === 0 ? 1.7 : 1.05, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > 180) continue;
      ctx.strokeStyle = `rgba(103, 232, 249, ${0.055 * (1 - distance / 180)})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  };

  const onResize = () => { size = resizeCanvas(canvas); };
  const onVisibility = () => {
    running = !document.hidden;
    if (running) raf = requestAnimationFrame(draw);
    else cancelAnimationFrame(raf);
  };
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  raf = requestAnimationFrame(draw);
  addCleanup(() => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
  });
}

function initCoreCanvas() {
  const canvas = document.getElementById("coreCanvas");
  const stage = document.getElementById("coreStage");
  if (!canvas || !stage || reduceMotion) return;
  const ctx = canvas.getContext("2d");
  let size = resizeCanvas(canvas);
  let raf = 0;
  let running = false;
  let time = 0;
  const fieldPoints = Array.from({ length: innerWidth < 680 ? 18 : 28 }, (_, index) => ({
    x: ((index * 83) % 970) / 1000,
    y: ((index * 127) % 720) / 760,
    phase: index * 0.6,
  }));

  const draw = () => {
    if (!running) return;
    time += 1;
    const pointer = stage.__pointer || { x: 0.5, y: 0.5 };
    ctx.clearRect(0, 0, size.width, size.height);
    fieldPoints.forEach((point, index) => {
      const x = size.width * point.x + (pointer.x - 0.5) * (index % 2 ? 18 : -14) + Math.sin(time / 90 + point.phase) * 4;
      const y = size.height * point.y + (pointer.y - 0.5) * (index % 2 ? -12 : 14) + Math.cos(time / 110 + point.phase) * 4;
      ctx.fillStyle = index % 4 === 0 ? "rgba(52, 211, 153, 0.34)" : "rgba(103, 232, 249, 0.25)";
      ctx.beginPath();
      ctx.arc(x, y, index % 6 === 0 ? 1.7 : 1.05, 0, Math.PI * 2);
      ctx.fill();
    });
    raf = requestAnimationFrame(draw);
  };

  const observer = new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting && !document.hidden;
    cancelAnimationFrame(raf);
    if (running) raf = requestAnimationFrame(draw);
  }, { rootMargin: "100px" });
  observer.observe(stage);
  const onResize = () => { size = resizeCanvas(canvas); };
  window.addEventListener("resize", onResize, { passive: true });
  addCleanup(() => { running = false; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", onResize); });
}

initRoutes();
initNavigation();
initCursorAura();
initMagneticButtons();
initHeroEntrance();
initHeroCore();
initCoreStreams();
initSectionHeadings();
initIntelligenceStory();
initPipeline();
initAnalytics();
initContestSimulation();
initReviewStory();
initCoach();
initPlanner();
initSkillGraph();
initSkillStack();
initTour();
initArchitecture();
initAmbientCanvas();
initCoreCanvas();

window.addEventListener("pagehide", () => {
  cleanups.splice(0).forEach((cleanup) => {
    try { cleanup(); } catch { /* Page teardown should continue. */ }
  });
}, { once: true });
