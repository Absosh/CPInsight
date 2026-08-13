# CPInsight Landing Page Redesign

## Design Concept

The redesigned landing page presents CPInsight as a personal competitive-programming intelligence platform. The page uses a calm dark product language aligned with the existing dashboard and AI design system: deep blue surfaces, cyan/emerald evidence accents, compact typography, restrained borders, and data-forward motion.

The signature visual is an interactive CPInsight Intelligence Core. Rating, topics, behavior, contests, AI, and progress nodes orbit the product idea while animated data packets flow into the core. Hovering or focusing nodes explains how each signal contributes to CPInsight. Product-native data visuals were favored over stock imagery so every animated surface explains a real CPInsight concept.

## Sections Created

- Hero with interactive intelligence core and real app CTAs
- Compact product signal and supported integrations: Codeforces, CodeChef, LeetCode
- Problem framing: raw platform activity to why/next-action intelligence
- Activity-to-understanding pipeline
- Analytics showcase using illustrative example visualizations
- Live contest monitoring narrative
- AI contest review narrative with illustrative review evidence
- AI Coach context-routing explanation
- Adaptive study planner flow
- Recommendation engine conceptual skill graph
- Skill intelligence interaction
- Why CPInsight comparison
- Interactive product tour
- Technical engine strip
- Product ecosystem navigation
- Final CTA and footer

## Animations

- Motion-powered staged hero assembly with word choreography, SVG path drawing, packet routing, and spring-settled intelligence nodes
- Cursor-reactive hero perspective, node proximity focus, relationship highlighting, and continuously changing contextual evidence
- Two desktop pinned narratives: activity-to-action intelligence and contest-event-to-improvement-plan review
- Scroll-linked state, relationship, position, scale, pathLength, and focus changes driven through Motion values and springs
- Live contest telemetry simulation with a moving playhead, event states, signal propagation, and hover/focus control
- AI Coach context routing with general and personal modes plus visible context packets entering reasoning
- Adaptive study planner with FLIP-style physical reordering when progress or a new contest signal changes the plan
- Interactive D3 force-directed recommendation graph with live SVG edges, draggable nodes, anchor springs, related-node focus, depth, and contextual recommendations
- SVG rating trajectory drawing, interactive chart scrubber, sequenced heatmap population, bar growth, and ring assembly
- Shared motion language for auto-evolving product-tour scenes, presence transitions, architecture propagation, magnetic CTAs, and section-specific heading masks
- Ambient network canvas, grid drift, scan lines, orbiting telemetry labels, and restrained continuous breathing
- Browser-ready bundled runtime plus populated HTML fallback states so analytics, skill, review, and tour surfaces never collapse into empty shells on a plain static server

All continuous animation is paused outside relevant viewports and disabled when `prefers-reduced-motion: reduce` is enabled. The reduced-motion layout keeps every stage and control visible without pinned scrolling, parallax, particles, or cinematic transitions.

## Interactive Components

- Mobile navigation menu
- Auth-aware landing CTAs
- Hero intelligence node hover/focus/click states
- Clickable pinned-story stage indexes
- Live contest telemetry hover/focus states
- AI Coach general/personal context modes
- Study planner completion and contest-adaptation controls
- Recommendation topic selector
- Skill intelligence selector
- Product tour tabs that transform the demo content
- Magnetic primary buttons

## Routes

- Entry/Login: `auth.html` for signed-out users, `dashboard.html` for signed-in users
- Dashboard: `dashboard.html`
- Analytics: `analytics.html`
- Calendar: `calendar.html`
- Contests and AI Review surface: `contests.html`
- AI Coach: `ai-coach.html`
- Study Planner: `ai-coach.html?view=studyPlans`
- Platforms: `platforms.html`
- Documentation footer link: `../docs/README.md`

## Existing Components Reused

- Existing Inter typography
- Existing favicon asset
- Existing dark dashboard and AI system palette
- Existing app page routes and authentication token convention
- Existing terminology from analytics, contests, AI Coach, live monitoring, planner, telemetry, and skill-tree surfaces

## New Dependencies

- `motion` `^13.1.0` for framework-agnostic Motion values, springs, scroll timelines, in-view lifecycle control, gesture handling, and orchestration
- `d3` `^7.9.0` (already present) for the recommendation graph force simulation
- `esbuild` `^0.25.12` for producing a browser-ready landing runtime during `npm run build:frontend`

The project already used Framer Motion and D3 elsewhere. The landing page remains framework-independent, and the checked-in landing runtime works through both Vite and a plain static server.

## Accessibility

- Semantic landmarks: header, nav, main, sections, footer
- Skip link
- Visible focus states
- Keyboard-operable menus, tabs, nodes, skill selectors, and recommendation selectors
- ARIA labels and live regions for dynamic product explanations
- Reduced-motion mode disables continuous canvas visuals and collapses animation timing
- Desktop pinned stories become normal-flow content below 1080px so tablet and mobile visitors keep the complete narrative without excessive scroll trapping

## Responsive Behavior

- Desktop uses a two-column hero and richer graph layouts
- Tablet stacks larger product sections and simplifies pipelines
- Mobile keeps the premium narrative through a simplified vertical intelligence system, non-pinned transformation controls, single-column coach routing, and touch-safe graph/planner controls
- Horizontal overflow is explicitly avoided through constrained widths and responsive grids

## Verification Results

- Frontend build: passed with `npm run build:frontend`
- Desktop visual QA: checked in browser at 1280x720, including direct-scroll positions through both pinned stories, the full analytics wall, recommendation graph, and product tour
- Mobile visual QA: checked through a 390x844 narrow viewport; the desktop pinned scenes collapse into normal-flow responsive variants
- Static-server QA: verified at `http://127.0.0.1:5500/pages/landing_page.html`; Motion initialized, 56 heatmap cells rendered, eight skill relationships rendered, and the tour populated with three contextual stages
- Console checks: no landing-page runtime errors observed on the directly served landing page
- Horizontal overflow: zero at checked desktop and narrow mobile widths after constraining pinned-story grid children
- Interactions checked: hero cursor tilt, activity stages, contest playhead and event focus, review stages, AI Coach modes, planner reordering, D3 skill selection, product-tour click and arrow-key transitions, and app route targets
- CTA routes: verified against existing auth-aware `auth.html` / `dashboard.html` flow
- Reduced motion: implemented through CSS and JavaScript guards; pinned sections collapse, paths remain visible, and continuous canvases, particles, parallax, magnetic motion, and large transitions are disabled
- Performance: ambient canvas is capped at roughly 30fps, hero canvas pauses outside view, Motion loops pause when their section leaves view, page visibility suspends canvas work, and teardown cancels listeners, timers, observers, and animation handles

## Files Created

- `docs/frontend/landing-page-redesign.md`
- `script/landing_page.bundle.js`

## Files Modified

- `pages/landing_page.html`
- `css/landing_page.css`
- `script/landing_page.js`
- `package.json`
- `package-lock.json`
