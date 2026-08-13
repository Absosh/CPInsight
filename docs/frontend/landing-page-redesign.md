# CPInsight Landing Page Redesign

## Design Concept

The redesigned landing page presents CPInsight as a personal competitive-programming intelligence platform. The page uses a calm dark product language aligned with the existing dashboard and AI design system: deep blue surfaces, cyan/emerald evidence accents, compact typography, restrained borders, and data-forward motion.

The signature visual is an interactive CPInsight Intelligence Core. Rating, topics, behavior, contests, AI, and progress nodes orbit the product idea while animated data packets flow into the core. Hovering or focusing nodes explains how each signal contributes to CPInsight.

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

- Ambient canvas data field
- Interactive hero canvas streams
- Progressive reveal on section entry
- Animated line chart, heatmap, bars, rings, flow lines, and product tour transitions
- Magnetic CTA pointer response
- Hover/focus node highlighting and contextual copy updates

All continuous canvas animation is disabled when `prefers-reduced-motion: reduce` is enabled.

## Interactive Components

- Mobile navigation menu
- Auth-aware landing CTAs
- Hero intelligence node hover/focus/click states
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

No new dependencies were added. The redesign uses vanilla HTML, CSS, and JavaScript with lightweight canvas drawing.

## Accessibility

- Semantic landmarks: header, nav, main, sections, footer
- Skip link
- Visible focus states
- Keyboard-operable menus, tabs, nodes, skill selectors, and recommendation selectors
- ARIA labels and live regions for dynamic product explanations
- Reduced-motion mode disables continuous canvas visuals and collapses animation timing

## Responsive Behavior

- Desktop uses a two-column hero and richer graph layouts
- Tablet stacks larger product sections and simplifies pipelines
- Mobile keeps the premium narrative while using single-column diagrams, a compact mobile menu, and simplified core-node sizing
- Horizontal overflow is explicitly avoided through constrained widths and responsive grids

## Verification Results

- Frontend build: passed with `npm run build:frontend`
- Desktop visual QA: checked at 1440px, 1280px, and 1024px
- Mobile visual QA: checked at 390px and 430px
- Console checks: no browser errors or warnings observed on the landing page
- Horizontal overflow: none observed at checked desktop, tablet, and mobile widths
- Navigation: desktop nav, mobile menu, section links, product tour tabs, recommendation selector, and skill selector checked
- CTA routes: verified against existing auth-aware `auth.html` / `dashboard.html` flow
- Reduced motion: implemented through `prefers-reduced-motion`; continuous canvases and large transitions are disabled by CSS/JS guards

## Files Created

- `docs/frontend/landing-page-redesign.md`

## Files Modified

- `pages/landing_page.html`
- `css/landing_page.css`
- `script/landing_page.js`
- `vite.config.js`
