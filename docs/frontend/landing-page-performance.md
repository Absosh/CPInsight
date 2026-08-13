# CPInsight Landing Page Performance Refinement

## 1. Original Performance Bottlenecks

The landing page was profiled before changes with a query-gated browser probe and a code-level audit. The dominant costs were continuous work rather than the one-time cinematic entrance:

- The D3 recommendation graph wrote node `left` and `top`, then measured the graph and every node with `getBoundingClientRect()` on each simulation tick. This mixed layout writes and reads in the same frame.
- Pointer handlers for the hero, chart, skill graph, magnetic controls, and cursor aura repeatedly measured element geometry.
- The D3 simulation was restarted on an interval even while the graph was offscreen.
- Review packets animated `left` and `top`, creating layout work during a continuous loop.
- Two canvases rendered continuously, including when their content was not visible. The ambient canvas also recalculated connection distances while drawing.
- Full-page background grids animated `background-position`, and repeated hero/review/skill state transitions animated live CSS filters.
- Decorative CSS animations continued running outside the viewport.
- The landing runtime imported the full D3 package even though it only needed the force modules.

The page is framework-independent, so React render storms were not a factor. High-frequency interaction was already outside React; the important work was removing DOM layout churn and consolidating browser animation work.

## 2. Root Causes

- Layout reads followed layout writes during force-simulation ticks.
- Geometry was treated as pointer-event data instead of cached interaction-session data.
- Independent timers and animation controls did not consistently follow viewport visibility.
- Decorative effects received the same runtime priority as primary product interactions.
- Some moving effects used paint-heavy properties such as blur, filter, and background position.
- The runtime dependency boundary was wider than the actual graph feature required.

## 3. Optimizations Performed

- Added a shared animation-frame scheduler that coalesces pointer and scroll work to one update per frame.
- Cached geometry on pointer entry, resize, or interaction start instead of measuring on every pointer event.
- Reworked skill-graph rendering to use D3 data coordinates directly for node transforms and SVG edges. The graph no longer measures every node during ticks.
- Replaced review packet `left`/`top` animation with transform-based `x`/`y` motion.
- Removed the graph restart interval. The simulation starts only near the viewport, settles faster, and stops when it leaves.
- Replaced the two Motion scroll subscriptions with one coalesced, visibility-aware scroll pipeline per pinned narrative.
- Batched canvas line drawing, reduced decorative point counts, clamped canvas pixel ratio, and capped update cadence by performance tier.
- Paused canvas, SVG packet, graph, tour, timeline, and decorative CSS motion outside their relevant viewport.
- Replaced moving grid `background-position` with compositor-friendly `translate3d()` layers.
- Removed recurring blur/filter animation from hero focus, contest review, and skill selection while preserving spring position, scale, opacity, path, and relationship changes.
- Removed permanent `will-change` from static card collections and retained it only on actively animated layers.
- Added full, balanced, and minimal motion tiers based on reduced-motion preference, viewport size, pointer type, and conservative device capability signals.
- Preserved the page boundary with `overflow-x: clip` so entrance transforms cannot widen the mobile document.

## 4. Animation Systems Changed

- Cursor, magnetic controls, and hero tilt use Motion values and springs without application-state updates.
- Pinned stories use cached section geometry plus frame-coalesced scroll transforms.
- The recommendation graph uses transform-only D3 ticks and a single SVG edge update.
- Hero and review data packets continue to animate along sampled SVG paths, but are paused offscreen and reduced on balanced devices.
- The planner keeps its FLIP-style layout transitions for meaningful physical reordering.
- Major product motion remains: intelligence-core flow, scroll state transformation, live contest sequencing, AI context routing, skill relationships, chart drawing, and tour scene changes.

## 5. Libraries Used

- `motion` for Motion values, springs, gestures, orchestration, in-view lifecycle control, and transform animation.
- `d3-force` subpath imports for the recommendation graph. The previous full `d3` barrel import was removed from the landing runtime.
- Canvas 2D for the two lightweight data fields.

No new dependency was added for this pass.

## 6. Components Optimized

- Global navigation and cursor aura
- Magnetic CTA controls
- Hero Intelligence Core and SVG data streams
- Activity-to-intelligence pinned story
- Analytics chart scrubber
- Live contest timeline
- AI Contest Review pinned story and packets
- AI Coach context routing
- Adaptive Study Planner layout transitions
- Recommendation skill graph
- Product tour lifecycle
- Ambient and hero canvas systems
- Global grid and decorative CSS motion

## 7. Desktop Behavior

The full tier retains cursor depth, magnetic controls, both pinned narratives, canvas data fields, SVG packet flow, draggable skill nodes, and spring-based focus changes. Required widths 1440x900, 1280x800, and 1024x768 were exercised in Chromium with no horizontal overflow or captured runtime errors.

The generated runtime decreased from 352,472 bytes to 273,961 bytes (22.3%). The Vite production landing chunk decreased from about 162.52 kB to 125.83 kB (22.6%). A controlled full-page scroll trace reduced the end-of-run active animation count from 46 to 16 and the observed peak long task from 156 ms to 83 ms. These are local browser-harness observations, not Lighthouse scores or a claimed FPS guarantee.

## 8. Mobile Behavior

The balanced tier is used at compact widths. It keeps the hero core, important path motion, section transformations, contest state, AI routing, planner reordering, and skill selection while removing the cursor aura, ambient canvas, alternate decorative packets, 3D tilt, and expensive backdrop/filter effects.

The 390x844 and 430x932 layouts were checked with exact inner viewport dimensions. Both reported no horizontal overflow and no captured runtime errors. The mobile menu opens and closes correctly, application CTAs retain their existing auth-aware routes, and the skill graph remains visible and usable.

## 9. Reduced-Motion Behavior

The minimal tier is selected when `prefers-reduced-motion: reduce` is active. It disables continuous canvas, particles, parallax, magnetic movement, sticky narrative behavior, and cinematic timing while leaving all content, controls, graph relationships, review output, and chart paths visible.

A query-gated `reduced-motion` switch is also available for deterministic local QA. The 390x844 minimal-tier run completed without horizontal overflow or captured runtime errors.

## 10. Build Result

- `npm run build:frontend`: passed.
- Landing runtime generation: passed.
- Vite production build: passed.
- `git diff --check`: passed; only the repository's Windows line-ending notices were reported.
- Browser interaction checks passed for hero node focus, skill selection, contest telemetry, AI Coach mode switching, planner completion/adaptation, tour transformation, and both scroll-driven narrative state changes.
- No landing-page runtime errors were captured during the final viewport, interaction, or reduced-motion runs.

The build still reports pre-existing warnings for classic scripts on dashboard/analytics pages and an unrelated large shared application chunk. Those files were outside this landing-page performance pass.

## 11. Remaining Limitations

- Performance numbers vary with browser tooling, machine load, font cache, and the static development server. No Lighthouse score or guaranteed numerical FPS is claimed.
- The DOM remains intentionally substantial because the landing page contains many complete product narratives. The optimization focuses on keeping offscreen work dormant rather than deleting those experiences.
- The ambient canvas is reserved for the full tier; conservative device signals intentionally choose the balanced tier when capability is uncertain.
- Google-hosted Inter remains a network dependency already used by the page. Font self-hosting was not introduced in this pass.

## Files Created

- `docs/frontend/landing-page-performance.md`

## Files Modified

- `css/landing_page.css`
- `script/landing_page.js`
- `script/landing_page.bundle.js`
