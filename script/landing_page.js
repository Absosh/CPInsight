import {
  animate,
  hover,
  inView,
  motionValue,
  press,
  springValue,
  stagger,
} from "motion";

const moduleEvaluationStarted = performance.now();
const motionParams = new URLSearchParams(location.search);
const reduceMotion = motionParams.has("reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktopMotion = window.matchMedia("(min-width: 1081px)");
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const compactViewport = window.matchMedia("(max-width: 680px)").matches;
const constrainedDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);
const performanceTier = reduceMotion ? "minimal" : compactViewport || constrainedDevice ? "balanced" : "full";
const cleanups = [];
const initializedSystems = new Set();
const scrollPosition = motionValue(window.scrollY);
let skillGraphModulePromise;
const preloadSkillGraph = () => {
  skillGraphModulePromise ||= import("./landing_skill_graph.bundle.js");
  return skillGraphModulePromise;
};
const motionDiagnosis = motionParams.has("motion-diagnosis");
const diagnosis = motionDiagnosis ? {
  navigationStart: performance.timeOrigin,
  moduleEvaluationStarted,
  initializers: [],
  inputFrames: { scroll: [], pointer: [] },
  responses: [],
  lastInput: { scroll: 0, pointer: 0 },
  longTasks: [],
  layoutShifts: [],
  paints: [],
} : null;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (start, end, amount) => start + (end - start) * amount;
const rangeProgress = (value, start, end) => clamp((value - start) / Math.max(0.0001, end - start));
const springOptions = { type: "spring", stiffness: 240, damping: 24, mass: 0.72 };

document.documentElement.classList.add("motion-ready");
document.documentElement.dataset.motionTier = performanceTier;

if (motionParams.has("qa")) {
  window.__landingQaErrors = [];
  window.addEventListener("error", (event) => window.__landingQaErrors.push(event.message));
  window.addEventListener("unhandledrejection", (event) => {
    window.__landingQaErrors.push(event.reason?.message || String(event.reason));
  });
}

function addCleanup(cleanup) {
  if (typeof cleanup === "function") cleanups.push(cleanup);
  return cleanup;
}

function runInitializer(name, initializer) {
  if (initializedSystems.has(name)) return undefined;
  initializedSystems.add(name);
  if (!diagnosis) {
    try {
      const result = initializer();
      result?.catch?.((error) => {
        initializedSystems.delete(name);
        console.error(`[landing:${name}]`, error);
      });
      return result;
    } catch (error) {
      initializedSystems.delete(name);
      console.error(`[landing:${name}]`, error);
      return undefined;
    }
  }
  const started = performance.now();
  let result;
  try {
    result = initializer();
  } catch (error) {
    initializedSystems.delete(name);
    console.error(`[landing:${name}]`, error);
    return undefined;
  }
  diagnosis.initializers.push({ name, duration: performance.now() - started });
  result?.then?.(() => {
    diagnosis.initializers.push({ name: `${name}:ready`, duration: performance.now() - started });
    updateMotionDiagnosisDataset();
  })
    .catch?.((error) => {
      initializedSystems.delete(name);
      console.error(`[landing:${name}]`, error);
    });
  updateMotionDiagnosisDataset();
  return result;
}

function scheduleIdle(callback, timeout = 700) {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout });
    addCleanup(() => window.cancelIdleCallback(handle));
    return;
  }
  const handle = window.setTimeout(callback, Math.min(timeout, 120));
  addCleanup(() => window.clearTimeout(handle));
}

function initMotionDiagnosis() {
  if (!diagnosis) return;
  const observers = [];
  if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    const observer = new PerformanceObserver((list) => {
      diagnosis.longTasks.push(...list.getEntries().map((entry) => ({ start: entry.startTime, duration: entry.duration })));
    });
    observer.observe({ type: "longtask", buffered: true });
    observers.push(observer);
  }
  if (PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) {
    const observer = new PerformanceObserver((list) => {
      diagnosis.layoutShifts.push(...list.getEntries().filter((entry) => !entry.hadRecentInput).map((entry) => ({
        start: entry.startTime,
        value: entry.value,
      })));
    });
    observer.observe({ type: "layout-shift", buffered: true });
    observers.push(observer);
  }
  if (PerformanceObserver.supportedEntryTypes?.includes("paint")) {
    const observer = new PerformanceObserver((list) => {
      diagnosis.paints.push(...list.getEntries().map((entry) => ({ name: entry.name, start: entry.startTime })));
    });
    observer.observe({ type: "paint", buffered: true });
    observers.push(observer);
  }

  const trackInputFrame = (type) => {
    let pending = false;
    return () => {
      if (pending) return;
      pending = true;
      const inputAt = performance.now();
      diagnosis.lastInput[type] = inputAt;
      requestAnimationFrame((frameAt) => {
        pending = false;
        const samples = diagnosis.inputFrames[type];
        if (samples.length < 240) samples.push(frameAt - inputAt);
      });
    };
  };
  const onScroll = trackInputFrame("scroll");
  const onPointer = trackInputFrame("pointer");
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("pointermove", onPointer, { passive: true, capture: true });
  addCleanup(() => {
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("pointermove", onPointer, { capture: true });
    observers.forEach((observer) => observer.disconnect());
  });
  window.__motionDiagnosis = diagnosis;
}

function recordMotionResponse(system, inputType, detail = {}) {
  if (!diagnosis || diagnosis.responses.length >= 300) return;
  const now = performance.now();
  const inputAt = diagnosis.lastInput[inputType] || now;
  diagnosis.responses.push({ system, inputType, latency: now - inputAt, at: now, ...detail });
}

function updateMotionDiagnosisDataset() {
  if (!diagnosis) return;
  document.documentElement.dataset.motionDiagnosis = JSON.stringify(diagnosis);
}

function publishMotionDiagnosis() {
  if (!diagnosis) return;
  diagnosis.moduleEvaluationFinished = performance.now();
  diagnosis.moduleEvaluationDuration = diagnosis.moduleEvaluationFinished - moduleEvaluationStarted;
  requestAnimationFrame((firstFrame) => requestAnimationFrame((secondFrame) => {
    diagnosis.firstFrameAfterModule = firstFrame - moduleEvaluationStarted;
    diagnosis.secondFrameAfterModule = secondFrame - moduleEvaluationStarted;
    updateMotionDiagnosisDataset();
  }));
  window.addEventListener("load", () => window.setTimeout(() => {
    diagnosis.resources = performance.getEntriesByType("resource")
      .filter((entry) => /landing_page|fonts\.|Inter/.test(entry.name))
      .map((entry) => ({ name: entry.name.split("/").pop(), start: entry.startTime, duration: entry.duration, decoded: entry.decodedBodySize }));
    diagnosis.navigation = (() => {
      const entry = performance.getEntriesByType("navigation")[0];
      return entry ? { dcl: entry.domContentLoadedEventEnd, load: entry.loadEventEnd } : null;
    })();
    updateMotionDiagnosisDataset();
  }, 500), { once: true });
}

function createFrameScheduler(callback) {
  let frame = 0;
  let latest;
  const schedule = (value) => {
    latest = value;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      callback(latest);
    });
  };
  schedule.cancel = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  return schedule;
}

function initInputPipeline() {
  const publishScroll = createFrameScheduler(() => scrollPosition.set(window.scrollY));
  const onScroll = () => publishScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  addCleanup(() => {
    window.removeEventListener("scroll", onScroll);
    publishScroll.cancel();
  });
}

function observeActivity(element, onChange, rootMargin = "120px") {
  const observer = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting, entry), { rootMargin });
  observer.observe(element);
  addCleanup(() => observer.disconnect());
  return observer;
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
  let lastState = null;
  const updateNav = (position = scrollPosition.get()) => {
    const nextState = position > 18;
    if (nextState === lastState) return;
    lastState = nextState;
    nav?.classList.toggle("is-scrolled", nextState);
  };
  updateNav();
  addCleanup(scrollPosition.on("change", updateNav));

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
  if (!aura || reduceMotion || coarsePointer || performanceTier !== "full") return;

  const pointerX = motionValue(window.innerWidth / 2);
  const pointerY = motionValue(window.innerHeight / 2);
  const smoothX = springValue(pointerX, { stiffness: 95, damping: 22, mass: 0.8 });
  const smoothY = springValue(pointerY, { stiffness: 95, damping: 22, mass: 0.8 });
  let currentX = pointerX.get();
  let currentY = pointerY.get();
  let visible = false;

  const render = createFrameScheduler(() => {
    aura.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  });
  const unsubscribeX = smoothX.on("change", (value) => { currentX = value; render(); });
  const unsubscribeY = smoothY.on("change", (value) => { currentY = value; render(); });
  const applyPointer = createFrameScheduler(({ x, y }) => {
    pointerX.set(x);
    pointerY.set(y);
  });
  const onMove = (event) => {
    applyPointer({ x: event.clientX, y: event.clientY });
    if (!visible) {
      visible = true;
      animate(aura, { opacity: [0, 0.78] }, { duration: 0.6 });
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  addCleanup(() => {
    window.removeEventListener("pointermove", onMove);
    applyPointer.cancel();
    render.cancel();
    unsubscribeX();
    unsubscribeY();
  });
}

function initMagneticButtons() {
  document.querySelectorAll(".magnetic").forEach((button) => {
    if (performanceTier !== "full" || coarsePointer) return;
    const targetX = motionValue(0);
    const targetY = motionValue(0);
    const x = springValue(targetX, { stiffness: 250, damping: 20, mass: 0.45 });
    const y = springValue(targetY, { stiffness: 250, damping: 20, mass: 0.45 });
    const unsubscribeX = x.on("change", (value) => button.style.setProperty("--magnetic-x", `${value}px`));
    const unsubscribeY = y.on("change", (value) => button.style.setProperty("--magnetic-y", `${value}px`));

    let rect = null;
    const applyPointer = createFrameScheduler(({ x: clientX, y: clientY }) => {
      if (!rect) return;
      targetX.set((clientX - rect.left - rect.width / 2) * 0.16);
      targetY.set((clientY - rect.top - rect.height / 2) * 0.16);
    });
    const onEnter = () => { rect = button.getBoundingClientRect(); };
    const onMove = (event) => {
      if (!rect) rect = button.getBoundingClientRect();
      applyPointer({ x: event.clientX, y: event.clientY });
    };
    const onLeave = () => { rect = null; targetX.set(0); targetY.set(0); };
    button.addEventListener("pointerenter", onEnter, { passive: true });
    button.addEventListener("pointermove", onMove, { passive: true });
    button.addEventListener("pointerleave", onLeave);

    const cancelPress = reduceMotion ? null : press(button, () => {
      animate(button, { scale: 0.975 }, { duration: 0.12 });
      return () => animate(button, { scale: 1 }, springOptions);
    });

    addCleanup(() => {
      unsubscribeX();
      unsubscribeY();
      cancelPress?.();
      applyPointer.cancel();
      button.removeEventListener("pointerenter", onEnter);
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
  }, { duration: 0.5, ease: [0.16, 1, 0.3, 1] });
  animate(words, {
    y: ["115%", "0%"],
    rotateX: [38, 0],
  }, { duration: 0.64, delay: stagger(0.028, { startDelay: 0.025 }), ease: [0.16, 1, 0.3, 1] });
  animate(".hero-lede", {
    clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"],
    y: [24, 0],
  }, { duration: 0.58, delay: 0.1, ease: [0.16, 1, 0.3, 1] });
  animate(".hero-actions .button", { y: [22, 0], scale: [0.94, 1] }, {
    duration: 0.48,
    delay: stagger(0.045, { startDelay: 0.16 }),
    ...springOptions,
  });
  animate(".platform-strip > *", { x: [-18, 0], opacity: [0.55, 1] }, {
    duration: 0.46,
    delay: stagger(0.025, { startDelay: 0.24 }),
  });
  animate(".hero-visual", {
    opacity: [0.72, 1],
    scale: [0.965, 1],
    rotateY: [-3, 0],
  }, { duration: 0.68, ease: [0.16, 1, 0.3, 1] });
  animate(".core-center", { scale: [0.2, 1.06, 1], rotate: [-8, 0] }, {
    duration: 0.72,
    delay: 0.08,
    ...springOptions,
  });
  animate(".core-node", { scale: [0.6, 1], opacity: [0.3, 1] }, {
    duration: 0.58,
    delay: stagger(0.045, { startDelay: 0.12 }),
    ...springOptions,
  });
  animate(".core-insight", { x: [42, 0], clipPath: ["inset(0 0 0 100%)", "inset(0 0 0 0%)"] }, {
    duration: 0.56,
    delay: 0.28,
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
  let stageRect = null;
  const renderTilt = createFrameScheduler(() => {
    stage.style.setProperty("--tilt-x", `${y * -3.2}deg`);
    stage.style.setProperty("--tilt-y", `${x * 4.2}deg`);
    stage.__pointerX = x * 0.5 + 0.5;
    stage.__pointerY = y * 0.5 + 0.5;
    recordMotionResponse("hero-tilt", "pointer");
  });
  const unsubX = smoothX.on("change", (value) => { x = value; renderTilt(); });
  const unsubY = smoothY.on("change", (value) => { y = value; renderTilt(); });

  const onPointerMove = (event) => {
    if (reduceMotion || coarsePointer) return;
    if (!stageRect) stageRect = stage.getBoundingClientRect();
    pointerX.set(clamp((event.clientX - stageRect.left) / stageRect.width, 0, 1) * 2 - 1);
    pointerY.set(clamp((event.clientY - stageRect.top) / stageRect.height, 0, 1) * 2 - 1);
  };
  const onPointerEnter = () => { stageRect = stage.getBoundingClientRect(); };
  const onPointerLeave = () => { stageRect = null; pointerX.set(0); pointerY.set(0); };
  stage.addEventListener("pointerenter", onPointerEnter, { passive: true });
  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  stage.addEventListener("pointerleave", onPointerLeave);

  let selected = "rating";
  let userHoldUntil = 0;
  const activate = (key, isUser = false) => {
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

    insight.querySelector("strong").textContent = config.title;
    insight.querySelector("p").textContent = config.body;
    insight.querySelector(".core-insight-signals").innerHTML = config.signals.map((signal) => `<i>${signal}</i>`).join("");
    if (!reduceMotion) {
      animate(insight, { x: [8, 0], scale: [0.99, 1], opacity: [0.72, 1] }, { duration: 0.22, ease: [0.16, 1, 0.3, 1] });
      animate(insight.querySelectorAll("i"), { y: [5, 0], scale: [0.94, 1] }, { delay: stagger(0.018), duration: 0.2 });
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
    renderTilt.cancel();
    stage.removeEventListener("pointerenter", onPointerEnter);
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
          delay: 0.12 + pathIndex * 0.035,
          ease: [0.16, 1, 0.3, 1],
        }));

        const length = path.getTotalLength();
        const samples = Array.from({ length: 28 }, (_, index) => path.getPointAtLength(length * index / 27));
        const packetCount = performanceTier === "full" ? 2 : 1;
        for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
          const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          const color = packetIndex === 0 ? "#67e8f9" : pathIndex % 2 ? "#34d399" : "#60a5fa";
          circle.setAttribute("r", packetIndex === 0 ? "3.2" : "2.3");
          circle.setAttribute("fill", color);
          particleGroup.appendChild(circle);
          controls.push(animate(circle, {
            cx: samples.map((point) => point.x),
            cy: samples.map((point) => point.y),
            opacity: [0, 0.95, 0.95, 0],
          }, {
            duration: 3.2 + pathIndex * 0.22,
            delay: 0.3 + packetIndex * 0.85 + pathIndex * 0.08,
            repeat: Infinity,
            ease: "linear",
          }));
        }
      });

      if (performanceTier === "full") document.querySelectorAll(".orbital-meta").forEach((label, index) => {
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
  addCleanup(() => controls.forEach((control) => control.cancel?.()));
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
      if (eyebrow) animate(eyebrow, { x: [-18, 0], clipPath: ["inset(0 100% 0 0)", "inset(0 0 0 0)"] }, { duration: 0.36 });
      if (title) animate(title, {
        clipPath: [index % 2 ? "inset(0 0 0 100%)" : "inset(0 0 100% 0)", "inset(0 0 0 0)"],
        y: [index % 2 ? 0 : 22, 0],
        x: [index % 2 ? 22 : 0, 0],
      }, { duration: 0.52, ease: [0.16, 1, 0.3, 1] });
      if (body.length) animate(body, { y: [12, 0], opacity: [0.72, 1] }, { duration: 0.4, delay: 0.04 });
    }, { margin: "35% 0px" }));
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
  let sectionTop = 0;
  let scrollDistance = 0;
  const measureSection = () => {
    sectionTop = section.offsetTop;
    scrollDistance = Math.max(1, section.offsetHeight - innerHeight);
  };
  measureSection();

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

  };

  const renderProgress = (progress) => {
    const value = clamp(progress);
    const scaled = value * 4;
    const fromIndex = Math.min(4, Math.floor(scaled));
    const toIndex = Math.min(4, fromIndex + 1);
    const mix = scaled - fromIndex;
    stage.style.setProperty("--story-progress", value.toFixed(4));
    paths.forEach((path, index) => {
      const local = index === paths.length - 1 ? clamp((value - 0.68) / 0.28) : clamp(value * 1.18 - index * 0.035);
      path.style.strokeDashoffset = String(1 - local);
    });
    cards.forEach((card, cardIndex) => {
      const from = configurations[fromIndex][cardIndex];
      const to = configurations[toIndex][cardIndex];
      const x = lerp(from.x, to.x, mix);
      const y = lerp(from.y, to.y, mix);
      const rotate = lerp(from.rotate, to.rotate, mix);
      const scale = lerp(from.scale, to.scale, mix);
      card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`;
      card.style.opacity = String(lerp(from.opacity, to.opacity, mix));
    });
    const reasoningFocus = 1 - Math.min(1, Math.abs(value - 0.75) / 0.2);
    const outputProgress = rangeProgress(value, 0.82, 0.96);
    core.style.transform = `scale(${lerp(1, 1.1, reasoningFocus) * lerp(1, 0.94, outputProgress)})`;
    output.style.transform = `translate3d(0, ${lerp(18, 0, outputProgress)}px, 0) scale(${lerp(0.94, 1, outputProgress)})`;
    output.style.opacity = String(outputProgress);
    eventFragments.forEach((fragment) => {
      const sourceX = parseFloat(fragment.style.getPropertyValue("--sx"));
      const sourceY = parseFloat(fragment.style.getPropertyValue("--sy"));
      const clusterX = rangeProgress(value, 0.12, 0.58);
      const clusterY = rangeProgress(value, 0.3, 0.68);
      const reasoning = rangeProgress(value, 0.58, 0.78);
      fragment.style.translate = `${(50 - sourceX) * 3.5 * clusterX}px ${(50 - sourceY) * 2.2 * clusterY}px`;
      fragment.style.scale = String(lerp(1, 0.7, reasoning));
      fragment.style.opacity = String(lerp(0.4, 0.72, clusterX) * lerp(1, 0.17, outputProgress));
    });
    orbitRings.forEach((ring, ringIndex) => {
      const assemble = rangeProgress(value, 0.02, 0.28);
      ring.style.scale = String(lerp(0.72 + ringIndex * 0.08, 1, assemble) * lerp(1, 1.08 - ringIndex * 0.04, reasoningFocus));
      ring.style.opacity = String(lerp(0.82 - ringIndex * 0.16, 0.22, outputProgress));
    });
    setStage(Math.min(4, Math.round(value * 4)));
    recordMotionResponse("intelligence-story", "scroll", { progress: value, stage: activeStage });
  };

  const scrollToStage = (index) => {
    if (!desktopMotion.matches || reduceMotion) {
      renderProgress(index / 4);
      return;
    }
    window.scrollTo({ top: sectionTop + scrollDistance * (index / 4), behavior: "smooth" });
  };
  steps.forEach((step, index) => step.querySelector("button")?.addEventListener("click", () => scrollToStage(index)));

  if (desktopMotion.matches && !reduceMotion) {
    let visible = false;
    const onScroll = (position = scrollPosition.get()) => {
      if (!visible) return;
      renderProgress(clamp((position - sectionTop) / scrollDistance));
    };
    const onResize = () => { measureSection(); onScroll(); };
    observeActivity(section, (isVisible) => { visible = isVisible; if (visible) onScroll(); }, "50% 0px");
    const unsubscribeScroll = scrollPosition.on("change", onScroll);
    window.addEventListener("resize", onResize, { passive: true });
    addCleanup(() => {
      unsubscribeScroll();
      window.removeEventListener("resize", onResize);
    });
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
      }, { delay: index * 0.035, ...springOptions }));
      const packetControl = animate(packet, { x: [0, pipeline.clientWidth * 0.92], scale: [0.65, 1.2, 0.65] }, { duration: 5.4, repeat: Infinity, ease: "linear" });
      timer = window.setInterval(() => setActive(activeIndex + 1), 1080);
      setActive(0);
      return () => { packetControl.cancel(); window.clearInterval(timer); };
    }
    nodes.forEach((node) => node.classList.add("is-active"));
  }, { margin: "55% 0px" }));
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
  }, { margin: "45% 0px" }));

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
    let chartRect = null;
    const updateScrubber = createFrameScheduler((clientX) => {
      if (!chartRect) return;
      const x = clamp(clientX - chartRect.left, 0, chartRect.width);
      scrubber.style.transform = `translate3d(${x}px, 0, 0)`;
      tooltip.style.transform = `translate3d(${clamp(x + 12, 8, chartRect.width - 142)}px, 0, 0)`;
    });
    chart.addEventListener("pointerenter", () => { chartRect = chart.getBoundingClientRect(); }, { passive: true });
    chart.addEventListener("pointermove", (event) => {
      updateScrubber(event.clientX);
      scrubber.style.opacity = "1";
      tooltip.style.opacity = "1";
    }, { passive: true });
    chart.addEventListener("pointerleave", () => {
      chartRect = null;
      if (!reduceMotion) animate([scrubber, tooltip], { opacity: 0 }, { duration: 0.22 });
    });
    addCleanup(() => updateScrubber.cancel());
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
      }, { delay: index * 0.035, ...springOptions });
    });
    if (reduceMotion) { setActive(0); return; }

    const distance = Math.max(120, rail.getBoundingClientRect().height);
    const playheadControl = animate(playhead, { y: [0, distance] }, { duration: 7.2, repeat: Infinity, ease: "linear" });
    const routerControl = animate(routerPath, { strokeDashoffset: [0, -34] }, { duration: 2.8, repeat: Infinity, ease: "linear" });
    const timer = window.setInterval(() => setActive(activeIndex + 1), 1440);
    setActive(0);
    return () => { playheadControl.cancel(); routerControl.cancel(); window.clearInterval(timer); };
  }, { margin: "55% 0px" }));
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
  const packets = relationshipPaths.map((path) => {
    const length = path.getTotalLength();
    const samples = Array.from({ length: 32 }, (_, sampleIndex) => {
      const point = path.getPointAtLength(length * sampleIndex / 31);
      return { x: point.x / 900, y: point.y / 610 };
    });
    const packet = document.createElement("span");
    packet.className = "review-packet";
    packet.style.opacity = "0";
    packetLayer.appendChild(packet);
    return { packet, samples };
  });
  let activeStage = -1;
  let sectionTop = 0;
  let scrollDistance = 0;
  let consoleWidth = consoleEl.clientWidth;
  let consoleHeight = consoleEl.clientHeight;
  const measureSection = () => {
    sectionTop = section.offsetTop;
    scrollDistance = Math.max(1, section.offsetHeight - innerHeight);
    consoleWidth = consoleEl.clientWidth;
    consoleHeight = consoleEl.clientHeight;
  };
  measureSection();

  const setStage = (index) => {
    const next = clamp(index, 0, 4);
    if (next === activeStage) return;
    activeStage = next;
    consoleEl.dataset.reviewStage = String(next);
    steps.forEach((step, stepIndex) => step.classList.toggle("is-active", stepIndex === next));
    eventLabel.textContent = reviewLabels[next];
    relationshipPaths.forEach((path, pathIndex) => path.classList.toggle("is-active", pathIndex + 1 === next || next === 4));

    cards.forEach((card, cardIndex) => card.classList.toggle("is-active", cardIndex + 1 === next));
  };

  const renderProgress = (progress) => {
    const value = clamp(progress);
    arrowPath.style.strokeDashoffset = String(1 - clamp(value * 1.35));
    cards.forEach((card, cardIndex) => {
      const center = (cardIndex + 1) / 4;
      const focus = 1 - clamp(Math.abs(value - center) / 0.25);
      const passed = value > center;
      const x = lerp(passed ? 10 : 28, -8, focus);
      const scale = lerp(passed ? 0.96 : 0.92, 1.035, focus);
      const opacity = lerp(passed ? 0.52 : 0.26, 1, focus);
      card.style.transform = `translate3d(${x}px, 0, 0) scale(${scale})`;
      card.style.opacity = String(opacity);
    });
    eventCard.style.transform = `translate3d(${value * 48}px, 0, 0) scale(${1 - value * 0.14})`;
    eventCard.style.opacity = String(1 - value * 0.6);
    const outputProgress = rangeProgress(value, 0.84, 0.97);
    output.style.transform = `translate3d(0, ${lerp(18, 0, outputProgress)}px, 0) scale(${lerp(0.94, 1, outputProgress)})`;
    output.style.opacity = String(outputProgress);
    relationshipPaths.forEach((path, pathIndex) => {
      const local = rangeProgress(value, pathIndex * 0.2 + 0.04, pathIndex * 0.2 + 0.28);
      path.style.opacity = String(lerp(0.18, 0.9, local));
      const { packet, samples } = packets[pathIndex];
      const point = samples[Math.min(samples.length - 1, Math.round(local * (samples.length - 1)))];
      packet.style.transform = `translate3d(${point.x * consoleWidth}px, ${point.y * consoleHeight}px, 0)`;
      packet.style.opacity = String(Math.sin(local * Math.PI));
    });
    setStage(Math.min(4, Math.round(value * 4)));
    consoleEl.style.setProperty("--review-progress", value.toFixed(4));
    recordMotionResponse("review-story", "scroll", { progress: value, stage: activeStage });
  };

  const scrollToStage = (index) => {
    if (!desktopMotion.matches || reduceMotion) { renderProgress(index / 4); return; }
    window.scrollTo({ top: sectionTop + scrollDistance * (index / 4), behavior: "smooth" });
  };
  steps.forEach((step, index) => step.querySelector("button")?.addEventListener("click", () => scrollToStage(index)));

  if (desktopMotion.matches && !reduceMotion) {
    let visible = false;
    const onScroll = (position = scrollPosition.get()) => {
      if (!visible) return;
      renderProgress(clamp((position - sectionTop) / scrollDistance));
    };
    const onResize = () => { measureSection(); onScroll(); };
    observeActivity(section, (isVisible) => { visible = isVisible; if (visible) onScroll(); }, "50% 0px");
    const unsubscribeScroll = scrollPosition.on("change", onScroll);
    window.addEventListener("resize", onResize, { passive: true });
    addCleanup(() => {
      unsubscribeScroll();
      window.removeEventListener("resize", onResize);
    });
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
  let packetFrame = 0;

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
    const count = mode === "personal" ? (performanceTier === "full" ? 3 : 2) : 1;

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
      }, springOptions);
      animate(answer, { scale: [0.97, 1.025, 1] }, springOptions);
      routes.forEach((path, index) => animate(path, {
        strokeDashoffset: [1, index === 1 && !personal ? 1 : 0],
        opacity: index === 1 && !personal ? 0.18 : 1,
      }, { duration: 0.32 }));
    }
    cancelAnimationFrame(packetFrame);
    packetFrame = requestAnimationFrame(() => createPackets(mode));
  };

  selectors.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.coachSelect)));
  cards.forEach((card) => card.addEventListener("click", () => setMode(card.dataset.coachCard)));

  addCleanup(inView(coach, () => {
    setMode(coach.dataset.coachMode || "personal");
    if (!reduceMotion) {
      animate([question, reasoning, answer], { y: [18, 0], rotateX: [-5, 0] }, { delay: stagger(0.04), ...springOptions });
    }
    return () => { cancelAnimationFrame(packetFrame); clearPackets(); };
  }, { margin: "55% 0px" }));
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

async function initSkillGraph() {
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
  const nodeById = new Map(simulationNodes.map((datum) => [datum.id, datum]));
  let selected = "Binary Search";
  let edgePaths = [];
  let graphWidth = graph.clientWidth;
  let graphHeight = graph.clientHeight;
  let graphRect = null;
  let graphVisible = false;
  let dragActive = false;

  const drawEdges = () => {
    svg.setAttribute("viewBox", `0 0 ${graphWidth} ${graphHeight}`);
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
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      const ax = clamp(nodeA.x, 72, graphWidth - 72);
      const ay = clamp(nodeA.y, 62, graphHeight - 62);
      const bx = clamp(nodeB.x, 72, graphWidth - 72);
      const by = clamp(nodeB.y, 62, graphHeight - 62);
      const path = edgePaths[index];
      const bend = Math.abs(ax - bx) * 0.08 + 18;
      path.setAttribute("d", `M${ax} ${ay} Q${(ax + bx) / 2} ${(ay + by) / 2 - bend} ${bx} ${by}`);
    });
  };

  const renderSimulation = () => {
    simulationNodes.forEach((datum) => {
      const x = clamp(datum.x, 72, graphWidth - 72);
      const y = clamp(datum.y, 62, graphHeight - 62);
      datum.node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(var(--node-scale, 1))`;
    });
    drawEdges();
  };

  const { createSkillSimulation } = await preloadSkillGraph();
  const simulation = createSkillSimulation({
    nodes: simulationNodes,
    links: simulationLinks,
    width: graphWidth,
    height: graphHeight,
    onTick: renderSimulation,
  });
  graph.classList.add("is-simulated");
  renderSimulation();

  const releaseNode = (datum, node, pointerId) => {
    if (pointerId !== undefined && node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
    datum.fx = null;
    datum.fy = null;
    dragActive = false;
    node.classList.remove("is-dragging");
    simulation.alphaTarget(0).alpha(0.2).restart();
  };

  const activate = (topic, commit = false) => {
    if (commit) selected = topic;
    const source = nodes.find((node) => node.dataset.topic === topic);
    const related = (source.dataset.related || "").split(",").filter(Boolean);
    nodes.forEach((node) => {
      const active = node.dataset.topic === topic;
      const isRelated = related.includes(node.dataset.topic);
      node.classList.toggle("is-selected", active);
      node.classList.toggle("is-related", isRelated);
      node.style.setProperty("--node-scale", String(active ? 1.1 : isRelated ? 1.035 : 0.91));
      node.style.opacity = String(active || isRelated ? 1 : 0.44);
    });
    edgePaths.forEach((path) => {
      const active = [path.dataset.a, path.dataset.b].includes(topic) ||
        (related.includes(path.dataset.a) && related.includes(path.dataset.b));
      path.classList.toggle("is-active", active);
      path.classList.toggle("is-muted", !active);
      if (active && !reduceMotion) animate(path, { strokeDashoffset: [1, 0] }, { duration: 0.55 });
    });

    const sourceDatum = simulationNodes.find((datum) => datum.id === topic);
    graph.style.setProperty("--focus-x", `${sourceDatum?.x ?? graphWidth / 2}px`);
    graph.style.setProperty("--focus-y", `${sourceDatum?.y ?? graphHeight / 2}px`);
    if (!commit) return;
    detail.querySelector("h3").textContent = topic;
    detail.querySelector("p").textContent = recommendations[topic];
    if (!reduceMotion) animate(detail, { x: [8, 0], scale: [0.99, 1], opacity: [0.7, 1] }, { duration: 0.2, ease: [0.16, 1, 0.3, 1] });
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
      dragActive = true;
      graphRect = graph.getBoundingClientRect();
      datum.fx = datum.x;
      datum.fy = datum.y;
      simulation.alphaTarget(0.22).restart();
    });
    node.addEventListener("pointermove", (event) => {
      if (!node.hasPointerCapture(event.pointerId) || !origin) return;
      datum.fx = clamp(event.clientX - graphRect.left, 72, graphWidth - 72);
      datum.fy = clamp(event.clientY - graphRect.top, 62, graphHeight - 62);
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
  const pointerX = motionValue(0);
  const pointerY = motionValue(0);
  const smoothX = springValue(pointerX, { stiffness: 110, damping: 24 });
  const smoothY = springValue(pointerY, { stiffness: 110, damping: 24 });
  const unsubX = smoothX.on("change", (value) => graph.style.setProperty("--graph-ry", `${value * 2.2}deg`));
  const unsubY = smoothY.on("change", (value) => graph.style.setProperty("--graph-rx", `${value * -1.8}deg`));
  const updateGraphRect = () => { graphRect = graph.getBoundingClientRect(); };
  graph.addEventListener("pointerenter", updateGraphRect, { passive: true });
  graph.addEventListener("pointermove", (event) => {
    if (reduceMotion || coarsePointer || dragActive || !graphRect) return;
    pointerX.set(((event.clientX - graphRect.left) / graphRect.width - 0.5) * 2);
    pointerY.set(((event.clientY - graphRect.top) / graphRect.height - 0.5) * 2);
  }, { passive: true });
  graph.addEventListener("pointerleave", () => { pointerX.set(0); pointerY.set(0); activate(selected); });

  drawEdges();
  const onResize = () => {
    graphWidth = graph.clientWidth;
    graphHeight = graph.clientHeight;
    graphRect = null;
    simulationNodes.forEach((datum) => {
      datum.anchorX = graphWidth * parseFloat(datum.node.style.getPropertyValue("--nx")) / 100;
      datum.anchorY = graphHeight * parseFloat(datum.node.style.getPropertyValue("--ny")) / 100;
    });
    simulation.updateCenter(graphWidth, graphHeight);
    if (graphVisible) simulation.alpha(0.24).restart();
    drawEdges();
  };
  window.addEventListener("resize", onResize, { passive: true });
  addCleanup(() => {
    window.removeEventListener("resize", onResize);
    unsubX();
    unsubY();
    simulation.stop();
  });
  addCleanup(inView(graph, () => {
    graphVisible = true;
    simulation.alpha(0.65).restart();
    if (!reduceMotion) {
      animate(edgePaths, { strokeDashoffset: [1, 0] }, { delay: stagger(0.07), duration: 0.82 });
      animate(nodes, { opacity: [0.2, 1] }, { delay: stagger(0.06), duration: 0.55 });
    }
    activate(selected);
    return () => {
      graphVisible = false;
      simulation.alphaTarget(0).stop();
    };
  }, { margin: "120% 0px" }));
}

function initSkillStack() {
  const detail = document.getElementById("skillDetail");
  const buttons = [...document.querySelectorAll(".skill-stack button")];
  if (!detail || !buttons.length) return;
  buttons.forEach((button) => button.addEventListener("click", () => {
    buttons.forEach((item) => item.classList.toggle("is-active", item === button));
    detail.querySelector("h3").textContent = button.dataset.skill;
    detail.querySelector("p").textContent = `Inspect recent activity, difficulty exposure, and the next recommended step for ${button.dataset.skill}.`;
    if (!reduceMotion) {
      animate(detail, { y: [8, 0], opacity: [0.7, 1] }, { duration: 0.2 });
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
  let currentName = "analytics";
  let paused = false;
  let userPauseUntil = 0;
  let rotationTimer = 0;
  const scenes = new Map();

  Object.entries(tours).forEach(([name, tour]) => {
    const scene = document.createElement("div");
    scene.className = `tour-view tour-view-${tour.className}`;
    scene.hidden = name !== currentName;
    scene.innerHTML = `
      <div class="tour-scene">
        <div class="tour-scene-hud"><span>${name.toUpperCase()} / ILLUSTRATIVE</span><strong>${tour.status}</strong></div>
        ${tour.scene}
      </div>
      <div class="tour-step-list">
        ${tour.steps.map(([label, title, body]) => `<article class="tour-card"><span>${label}</span><h3>${title}</h3><p>${body}</p></article>`).join("")}
      </div>`;
    stage.appendChild(scene);
    scenes.set(name, scene);
  });

  const render = (name, immediate = false) => {
    if (name === currentName && !immediate) return;
    const tour = tours[name];
    currentName = name;
    tabs.forEach((item) => item.setAttribute("aria-selected", String(item.dataset.tour === name)));
    stage.className = `tour-stage tour-stage-${tour.className}`;
    scenes.forEach((scene, sceneName) => { scene.hidden = sceneName !== name; });
    const activeScene = scenes.get(name);
    if (!immediate && !reduceMotion) {
      animate(activeScene, { x: [14, 0], opacity: [0.78, 1], scale: [0.992, 1] }, { duration: 0.22, ease: [0.16, 1, 0.3, 1] });
      animate(activeScene.querySelectorAll(".tour-card"), { x: [12, 0], opacity: [0.78, 1] }, { delay: stagger(0.025), duration: 0.2 });
    }
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
        if (paused || Date.now() < userPauseUntil || document.hidden) return;
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
    }, { margin: "55% 0px" }));
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
  const ratioCap = performanceTier === "full" ? 1.5 : 1;
  const ratio = Math.min(window.devicePixelRatio || 1, ratioCap);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  return { width: canvas.width, height: canvas.height, ratio };
}

function initAmbientCanvas() {
  const canvas = document.getElementById("ambientCanvas");
  if (!canvas || reduceMotion || performanceTier !== "full") return;
  const ctx = canvas.getContext("2d");
  let size = resizeCanvas(canvas);
  let raf = 0;
  let lastFrame = 0;
  let running = true;
  const pointCount = 26;
  const connections = [];
  const points = Array.from({ length: pointCount }, (_, index) => ({
    x: (index * 137) % Math.max(size.width, 1),
    y: (index * 79) % Math.max(size.height, 1),
    speed: 0.12 + (index % 5) * 0.035,
    phase: index * 0.73,
  }));
  for (let index = 0; index < points.length - 1; index += 1) {
    const next = (index + 1) % points.length;
    if (Math.hypot(points[index].x - points[next].x, points[index].y - points[next].y) <= 180) connections.push([index, next]);
  }

  const draw = (time) => {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    if (time - lastFrame < 48) return;
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

    if (connections.length) {
      ctx.strokeStyle = "rgba(103, 232, 249, 0.028)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      connections.forEach(([aIndex, bIndex]) => {
        const a = points[aIndex];
        const b = points[bIndex];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      });
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
  let lastFrame = 0;
  const targetFrame = performanceTier === "full" ? 32 : 48;
  const fieldPoints = Array.from({ length: performanceTier === "full" ? 22 : 14 }, (_, index) => ({
    x: ((index * 83) % 970) / 1000,
    y: ((index * 127) % 720) / 760,
    phase: index * 0.6,
  }));

  const draw = (timestamp) => {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    if (timestamp - lastFrame < targetFrame) return;
    lastFrame = timestamp;
    time += 1;
    const pointerX = stage.__pointerX ?? 0.5;
    const pointerY = stage.__pointerY ?? 0.5;
    ctx.clearRect(0, 0, size.width, size.height);
    fieldPoints.forEach((point, index) => {
      const x = size.width * point.x + (pointerX - 0.5) * (index % 2 ? 18 : -14) + Math.sin(time / 90 + point.phase) * 4;
      const y = size.height * point.y + (pointerY - 0.5) * (index % 2 ? -12 : 14) + Math.cos(time / 110 + point.phase) * 4;
      ctx.fillStyle = index % 4 === 0 ? "rgba(52, 211, 153, 0.34)" : "rgba(103, 232, 249, 0.25)";
      ctx.beginPath();
      ctx.arc(x, y, index % 6 === 0 ? 1.7 : 1.05, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const observer = new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting && !document.hidden;
    cancelAnimationFrame(raf);
    if (running) raf = requestAnimationFrame(draw);
  }, { rootMargin: "100px" });
  observer.observe(stage);
  const onResize = () => { size = resizeCanvas(canvas); };
  const onVisibility = () => {
    const shouldRun = !document.hidden && stage.getBoundingClientRect().bottom > -100 && stage.getBoundingClientRect().top < innerHeight + 100;
    running = shouldRun;
    cancelAnimationFrame(raf);
    if (running) raf = requestAnimationFrame(draw);
  };
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  addCleanup(() => { running = false; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", onVisibility); });
}

function initMotionVisibility() {
  const zones = [
    "#coreStage",
    ".intelligence-stage",
    "[data-flow-pipeline]",
    ".viz-wall",
    "[data-contest-simulation]",
    ".review-console",
    "#coachLogic",
    "#plannerFlow",
    "#skillNetwork",
    "#tourStage",
    ".architecture-strip",
  ];
  document.querySelectorAll(zones.join(",")).forEach((zone) => {
    zone.classList.add("motion-zone");
    observeActivity(zone, (active) => zone.classList.toggle("is-motion-active", active), "160px");
  });
}

function initPerformanceProbe() {
  if (!motionParams.has("perf")) return;
  const startProbe = () => window.setTimeout(() => {
    const longTasks = [];
    const observer = typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")
      ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
      : null;
    observer?.observe({ type: "longtask", buffered: true });
    const frames = [];
    let previous = performance.now();
    const started = previous;
    const maximum = document.documentElement.scrollHeight - innerHeight;
    const sample = (now) => {
      frames.push(now - previous);
      previous = now;
      const elapsed = now - started;
      scrollTo({ top: maximum * Math.min(1, elapsed / 4200), behavior: "instant" });
      if (elapsed < 4200) {
        requestAnimationFrame(sample);
        return;
      }
      window.setTimeout(() => {
        observer?.disconnect();
        const sorted = frames.slice(5).sort((a, b) => a - b);
        const percentile = (value) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const bundle = resources.find((entry) => entry.name.includes("landing_page.bundle"));
        const css = resources.find((entry) => entry.name.includes("landing_page.css"));
        const allAnimations = document.getAnimations?.() || [];
        const runningAnimations = allAnimations.filter((animation) => animation.playState === "running");
        document.documentElement.dataset.performanceProbe = JSON.stringify({
          domNodes: document.querySelectorAll("*").length,
          animations: {
            running: runningAnimations.length,
            total: allAnimations.length,
          },
          navigation: { dcl: navigation?.domContentLoadedEventEnd, load: navigation?.loadEventEnd },
          bundle: { transfer: bundle?.transferSize, decoded: bundle?.decodedBodySize, duration: bundle?.duration },
          css: { transfer: css?.transferSize, decoded: css?.decodedBodySize },
          frames: {
            count: sorted.length,
            average: sorted.reduce((sum, value) => sum + value, 0) / Math.max(sorted.length, 1),
            p95: percentile(0.95),
            p99: percentile(0.99),
            over25: sorted.filter((value) => value > 25).length,
            over50: sorted.filter((value) => value > 50).length,
          },
          longTasks: {
            count: longTasks.length,
            total: longTasks.reduce((sum, value) => sum + value, 0),
            max: Math.max(0, ...longTasks),
          },
          heap: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
          } : null,
          scrollHeight: document.documentElement.scrollHeight,
        });
      }, 350);
    };
    requestAnimationFrame(sample);
  }, 300);
  if (document.readyState === "complete") startProbe();
  else window.addEventListener("load", startProbe, { once: true });
}

initMotionDiagnosis();
runInitializer("routes", initRoutes);
runInitializer("inputPipeline", initInputPipeline);
runInitializer("navigation", initNavigation);
runInitializer("heroEntrance", initHeroEntrance);
runInitializer("heroCore", initHeroCore);
runInitializer("motionVisibility", initMotionVisibility);

requestAnimationFrame(() => {
  runInitializer("cursorAura", initCursorAura);
  runInitializer("magneticButtons", initMagneticButtons);
  runInitializer("coreStreams", initCoreStreams);
  runInitializer("coreCanvas", initCoreCanvas);
  requestAnimationFrame(() => {
    runInitializer("sectionHeadings", initSectionHeadings);
    runInitializer("intelligenceStory", initIntelligenceStory);
    runInitializer("pipeline", initPipeline);
    runInitializer("analytics", initAnalytics);
    scheduleIdle(() => runInitializer("skillGraphPreload", preloadSkillGraph), 240);
  });
});

const warmInitializers = [
  ["contestSimulation", initContestSimulation, "#intelligence"],
  ["reviewStory", initReviewStory, "#review"],
  ["coach", initCoach, "#review"],
  ["planner", initPlanner, "#review"],
  ["skillGraph", initSkillGraph, "#intelligence"],
  ["skillStack", initSkillStack, "#intelligence"],
  ["tour", initTour, "#system-tour"],
  ["architecture", initArchitecture, "#technology"],
  ["ambientCanvas", initAmbientCanvas, "#hero"],
  ["performanceProbe", initPerformanceProbe, "#hero"],
];
const initialHash = location.hash;
const warmQueue = [...warmInitializers];
if (initialHash) warmQueue.sort((a, b) => Number(b[2] === initialHash) - Number(a[2] === initialHash));

const promoteWarmers = (hash) => {
  warmInitializers
    .filter(([, , sectionHash]) => sectionHash === hash)
    .forEach(([name, initializer]) => runInitializer(name, initializer));
};
const onInternalDestination = (event) => {
  const anchor = event.target.closest?.('a[href^="#"]');
  if (anchor) promoteWarmers(anchor.getAttribute("href"));
};
document.addEventListener("pointerdown", onInternalDestination, { capture: true, passive: true });
document.addEventListener("click", onInternalDestination, { capture: true });
addCleanup(() => {
  document.removeEventListener("pointerdown", onInternalDestination, { capture: true });
  document.removeEventListener("click", onInternalDestination, { capture: true });
});

if (initialHash && initialHash !== "#hero" && initialHash !== "#main") {
  promoteWarmers(initialHash);
  requestAnimationFrame(() => document.querySelector(initialHash)?.scrollIntoView({ behavior: "instant", block: "start" }));
}

const warmNextSystem = () => {
  const next = warmQueue.shift();
  if (!next) {
    updateMotionDiagnosisDataset();
    return;
  }
  runInitializer(next[0], next[1]);
  requestAnimationFrame(() => scheduleIdle(warmNextSystem, 420));
};

scheduleIdle(warmNextSystem, 420);
publishMotionDiagnosis();

window.addEventListener("pagehide", () => {
  cleanups.splice(0).forEach((cleanup) => {
    try { cleanup(); } catch { /* Page teardown should continue. */ }
  });
}, { once: true });
