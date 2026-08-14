# CPInsight Landing Page Motion Diagnosis

## Scope and Method

This diagnosis was recorded before the ultra-responsive architecture refactor. It combines source inspection with a query-gated Chromium timing probe on the statically served landing page at `http://127.0.0.1:5500/pages/landing_page.html`.

The probe records module and initializer duration, first paint, long tasks, layout shifts, critical resource timing, and input-to-next-frame timing. Measurements are local development observations, not Lighthouse scores or production guarantees.

## Measured Baseline

Two reload conditions exposed the difference between cold startup work and a warm browser cache/JIT path:

- Cold observed module evaluation: about 175.7 ms in one task.
- Cold observed startup long task: 203 ms.
- The first DOM/style mutation in navigation setup absorbed about 151.6 ms of the cold trace. This is where the browser performed deferred style/layout work; it is not 151 ms of navigation business logic.
- Warm observed module evaluation: about 25.2 ms.
- Warm first paint and first contentful paint: about 176 ms.
- Warm navigation timing: DOMContentLoaded about 70.5 ms; load about 89.5 ms.
- No layout shifts were recorded in the sampled startup.

The local landing CSS and JavaScript each arrived in roughly 9 ms in the warm trace. The Inter font response was cached in that trace. Network was therefore not the dominant observed startup bottleneck, although the external font stylesheet remains a render dependency on an uncached visit.

## Startup Delay

The most visible startup delay is intentional orchestration:

- Hero words begin after a 220 ms start delay and then stagger.
- Supporting copy waits 720 ms.
- CTAs wait 920 ms.
- Platform signals wait 1,080 ms.
- Core nodes wait 1,180 ms and then stagger.
- The hero insight waits 1,720 ms.
- Core data packets begin after 1,300 ms plus path/packet offsets.

This makes the hero look as though it is initializing even after the browser is ready. The entire page also initializes every system from one module task, including the far-below-the-fold D3 graph, tour, observers, and canvases, before the browser gets a clean scheduling boundary for progressive enhancement.

## Transition Latency

### Pinned Intelligence Story

Scroll progress updates the SVG path and one CSS variable directly, but the main card composition changes only when `Math.floor(progress * 5)` crosses a stage boundary. Each boundary creates new Motion spring animations for four cards, the core, output, five event fragments, and three orbit rings.

Consequences:

- The continuous path responds to scroll, but the primary composition responds in five discrete jumps.
- Springs intentionally settle behind the latest scroll position.
- Per-fragment delays add a small queue within each stage.
- Reversing scroll interrupts properties inconsistently because fresh animations are created at every threshold.

### AI Contest Review

The review story has the same discrete stage architecture. In addition, every stage change cancels packet animations, removes packet DOM, samples an SVG path, creates new packet elements, and starts new infinite animations.

This is a just-in-time transition cost at precisely the moment the user expects visual response.

### Product Tour

Tour selection waits for a 240 ms outgoing animation, including stagger, before replacing content. A `switching` lock discards newer input while that exit is running. This is a direct source of input latency and stale-selection behavior.

### Hero and Skill Details

Hero insight, recommendation detail, and skill detail wait for a 160 ms exit animation before changing text. The control reacts, but the useful content deliberately arrives later.

## Scroll Architecture

The page does not use React and does not call `setState` on scroll. Two pinned stories and the navigation each attach their own coalesced scroll listener. Continuous input reaches a callback within a frame, but the callback then starts discrete spring animations rather than mapping the current scroll value directly to visual properties.

The issue is therefore output latency, not React render latency.

## Component Lifecycle and Warming

Most components remain mounted, which is good. However, several expensive behaviors initialize only through `inView` callbacks configured at or inside the visible viewport:

- Analytics chart orchestration
- Contest playhead and event sequence
- AI Coach packet routing
- Planner entrance
- Skill graph simulation and edge animation
- Product tour rotation

The D3 graph is constructed during module startup but its simulation and entrance begin only as the graph becomes visible. This combines upfront parse/setup cost with just-in-time visible activation.

There are no current dynamic imports, preload stages, or next-section warm states. The landing bundle loads Motion and D3 force code together at startup.

## Layout and Rendering Work

The previous performance pass removed per-tick graph measurement and high-frequency pointer layout reads. Remaining layout work is mostly bounded:

- Pinned sections measure `offsetTop` and `offsetHeight` at startup and resize.
- AI Coach measures route geometry when the mode changes.
- Planner uses intentional before/after geometry reads for FLIP reordering.
- D3 reads initial graph dimensions and resize dimensions.

The largest remaining scroll-time problem is not forced reflow. It is repeated animation-object creation, stage packet reconstruction, springs on critical scroll progress, and late activation.

## React and Framer Motion Findings

- The landing page is framework-independent; React does not render or remount these sections.
- No `AnimatePresence`, `LayoutGroup`, `layout`, or `layoutId` path exists on the landing page.
- Motion is used through the framework-independent `motion` package.
- Continuous pointer values already use Motion values and springs appropriately.
- Scroll-critical visual state does not yet use a shared Motion value; it uses DOM scroll listeners plus discrete Motion animations.

## Root Causes Ranked

1. Deliberate hero delays postpone useful motion by up to 1.72 seconds.
2. Scroll narratives convert continuous input into discrete stage springs instead of scrubbed visual progress.
3. Review packets are reconstructed at stage boundaries.
4. Awaited exit animations delay hero/skill/tour content changes.
5. The tour locks and discards input while switching.
6. In-view callbacks wake some systems only when the user has already reached them.
7. All library parsing and component setup share the initial module task.
8. External font CSS can affect uncached first paint, but was not the dominant measured warm-load cost.

## Refactor Direction

- Establish one shared scroll Motion value and one frame-coalesced scroll input path.
- Map pinned-story progress directly to transforms, opacity, scale, and paths without springs or stage queues.
- Keep semantic labels discrete while making visual state continuous.
- Prebuild review packet systems and pause/resume them instead of reconstructing them.
- Remove awaited exits from immediate user interactions; latest input must always win.
- Start primary hero motion immediately, then add data streams and decorative layers after the first paint.
- Split critical startup from user-visible prewarm and idle initialization.
- Preload and initialize the D3 graph before it approaches the viewport.
- Expand viewport warming margins while continuing to pause far-offscreen continuous motion.
- Retain springs for cursor, hover, magnetic controls, and planner FLIP transitions only.
