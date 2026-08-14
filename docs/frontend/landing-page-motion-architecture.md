# CPInsight Landing Page Motion Architecture

## Outcome

The landing page keeps its cinematic hero, continuous data streams, two pinned narratives, contest telemetry, AI routing, planner reflow, interactive skill graph, and ambient depth. The execution model now prioritizes immediate input response and prepares later systems before they are needed.

This report records local Chromium observations. It does not claim a guaranteed frame rate or Lighthouse score.

## Performance Diagnosis

The pre-refactor diagnosis is in `docs/frontend/landing-page-motion-diagnosis.md`.

The dominant problems were transition orchestration rather than React rendering:

- The landing page is framework-independent, so no React render loop was involved.
- Hero content and useful motion were deliberately delayed by as much as 1.72 seconds.
- Pinned stories converted continuous scroll into five discrete spring-driven states.
- Review packets were destroyed and reconstructed at each state boundary.
- Tour, hero detail, recommendation detail, and skill detail interactions awaited exit animations before updating content.
- The tour discarded input while its previous transition was running.
- D3 force code lived in the critical landing bundle while graph activation still happened near the viewport.
- Ten later systems could initialize in one idle callback, creating a secondary work cluster.

## Architecture Changes

### Shared Input Pipeline

A single frame-coalesced scroll listener writes to one Motion value. Navigation and both pinned narratives subscribe to that value. Continuous scroll state no longer travels through semantic state, timers, or queued animation calls.

Pointer-reactive hero and graph effects continue to use Motion values and responsive springs. Their geometry is cached on pointer entry and invalidated on leave or resize, so pointer movement does not query layout.

### Scrubbed Pinned Narratives

The activity-to-intelligence and contest-review narratives now map normalized scroll progress directly to:

- card position, scale, and focus
- SVG path completion
- signal clustering
- core emphasis
- evidence packet position
- recommendation and plan reveal

Semantic labels still change at useful stage boundaries, but the visual state is continuous and reversible. Rapid scrolling converges to the latest position instead of playing intermediate transitions.

### Persistent Visual Systems

Review packet elements and sampled path geometry are built once. Scroll updates only their compositor transforms and opacity.

All five product-tour views are built once and kept mounted. A selection toggles visibility synchronously and adds only a short flourish. There is no outgoing-animation wait, switching lock, or discarded input.

Hero, recommendation, skill-detail, and AI Coach content updates are synchronous. Springs remain as non-blocking feedback rather than gates around useful state.

## Initialization and Preloading

Startup now has three levels:

1. Critical: routes, shared input, navigation, hero content, hero core, and visibility control.
2. First-frame enhancement: cursor aura, magnetic controls, hero streams/canvas, headings, first pinned story, pipeline, and analytics.
3. Warm queue: contest, review, coach, planner, graph, tour, architecture, ambient canvas, and diagnostics.

The warm queue yields between systems instead of waking every later surface in one callback. It deduplicates initialization and promotes internal-link or hash destinations immediately, so direct navigation does not wait for the normal queue order.

The skill graph force engine was moved to `script/landing_skill_graph.js` and a generated secondary bundle. A cached dynamic import prefetches it during idle time near the top of the page. The production build emits one graph chunk rather than carrying D3 force code in the critical landing chunk.

## Framer Motion Changes

Motion remains the page's interaction engine.

- Motion values drive continuous scroll and pointer state.
- Direct scrub transforms replace scroll-critical springs.
- Springs remain for magnetic buttons, hover response, pointer inertia, and planner FLIP reordering.
- Scroll state does not create Motion animation objects at stage boundaries.
- Large blur/filter entrances and long stagger queues were removed from critical paths.
- Major section systems use wider warm margins and far-offscreen continuous effects still pause.

## SVG and Canvas

- Hero and review SVG paths retain animated data flow.
- Review path samples are cached instead of recalculated during transitions.
- Skill-edge geometry uses simulation coordinates rather than per-tick DOM measurements.
- Hero and ambient canvas systems retain bounded point counts and one loop per canvas.
- Canvas pixel ratio remains capped; mobile uses the balanced profile.
- Decorative canvas work pauses when hidden or outside its activation range.

## Mobile and Reduced Motion

At 430 x 932 and 390 x 844, the page uses the balanced motion tier. The narrative becomes vertical, decorative density is reduced, pointer-only effects do not run, and there is no horizontal overflow.

The reduced-motion query and `prefers-reduced-motion` path use the minimal tier. Continuous decorative motion and parallax are disabled while the hero core, complete intelligence narrative, review content, graph, controls, and routes remain available.

## Measured Verification

### Baseline

The recorded pre-refactor cold development trace included about 175.7 ms of module evaluation and one 203 ms startup long task. A warm trace evaluated the module in about 25.2 ms. The visual startup still waited on intentional delays even in the warm case.

### Refactored Development Trace

One warm static-server trace recorded:

- critical module evaluation: about 22.3 ms
- no startup long tasks
- no layout shifts
- first paint and first contentful paint: about 248 ms

### Refactored Production Trace

The production landing output is approximately:

- critical landing JavaScript: 115.94 kB, 40.37 kB gzip
- skill-graph chunk: 15.30 kB, 5.87 kB gzip

A cold local production trace recorded 64.5 ms of module evaluation with startup long tasks of 74 ms and 55 ms. A warm production reload recorded 53.7 ms with one 66 ms startup task. These traces include browser parsing/style work and are not directly comparable to the static development trace.

The important interaction trace was a 4.2-second full-page production scrub after initialization:

- 261 sampled frame intervals
- average interval: 15.84 ms
- p95 interval: 23.8 ms
- p99 interval: 29.7 ms
- intervals over 50 ms: 0
- interaction-phase long tasks: 0

The two pinned stories were also sampled through abrupt down/up reversals. Their rendered progress matched requested progress to roughly 0.0001 after the next observed frame, with no stale stage queue.

## Browser Verification

Verified in local Chromium at:

- 1440 x 900
- 1280 x 800
- 1024 x 768
- 430 x 932
- 390 x 844

Checks covered initial load, hero motion, cursor tilt, slow and rapid scroll, reverse scroll, direct section jumps, both pinned narratives, product-tour rapid switching, AI Coach modes, planner FLIP updates, skill-graph selection, mobile menu, keyboard tour navigation, reduced motion, and CTA destinations.

Observed results:

- no console or unhandled-promise errors
- no horizontal overflow at tested widths
- no recorded layout shifts
- latest tour/coach input wins
- hash destinations initialize before settling
- production build passes

## Remaining Limitations

- The external Google Fonts stylesheet can still affect uncached first paint; `display=swap` prevents it from blocking useful content indefinitely.
- The wider application build continues to report pre-existing non-module script and large-chunk warnings outside the isolated landing-page runtime.
- Startup parsing/style work can still cross the 50 ms long-task threshold on a cold local production load, but it no longer appears during the measured ordinary-scroll trace.
- The force graph remains the most computationally involved landing visualization. It is split, prefetched, paused offscreen, and uses only six interactive nodes, but very low-power devices will still use the balanced/minimal profiles.

## Files

Created:

- `docs/frontend/landing-page-motion-diagnosis.md`
- `docs/frontend/landing-page-motion-architecture.md`
- `script/landing_skill_graph.js`
- `script/landing_skill_graph.bundle.js`

Modified:

- `script/landing_page.js`
- `script/landing_page.bundle.js`
- `css/landing_page.css`
- `package.json`
