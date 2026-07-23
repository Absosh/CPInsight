const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const featureRoot = path.join(root, 'src', 'features', 'ai-coach');

const requiredFiles = [
  'api/aiCoachApi.js',
  'components/AiCoachWorkspace.jsx',
  'components/LeftSidebar.jsx',
  'components/CenterPanel.jsx',
  'components/RightSidebar.jsx',
  'components/MessageComposer.jsx',
  'components/CoachMessageRenderer.jsx',
  'components/SessionList.jsx',
  'components/ReflectionWorkspace.jsx',
  'components/RoadmapWorkspace.jsx',
  'hooks/useAiCoachKeyboardShortcuts.js',
  'hooks/useVirtualMessages.js',
  'state/AiCoachWorkspaceProvider.jsx',
  'state/aiCoachReducer.js',
  'state/selectors.js',
  'styles/ai-coach-workspace.css',
  'stories/AiCoachWorkspace.stories.jsx',
  'types/aiCoachTypes.js',
  'index.js'
];

for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(featureRoot, file)), true, `${file} exists`);
}

const source = requiredFiles
  .filter((file) => file.endsWith('.jsx') || file.endsWith('.js'))
  .map((file) => fs.readFileSync(path.join(featureRoot, file), 'utf8'))
  .join('\n');

for (const component of ['CoachMessage', 'EvidenceExplorer', 'RecommendationList', 'ReasoningPanel', 'ActionPlan', 'RoadmapViewer', 'ReflectionTimeline', 'QualityIndicator', 'BehaviorOverview']) {
  assert.equal(source.includes(component), true, `${component} is integrated`);
}

for (const lifecycle of ['sessions/created', 'sessions/renamed', 'sessions/archived', 'sessions/deleted', 'sessions/pinned', 'sessions/selected']) {
  assert.equal(source.includes(lifecycle), true, `${lifecycle} is handled`);
}

for (const endpoint of ['/ai/planner/classify', '/ai/planner/plan', '/ai/retrieval/execute', '/ai/reasoning/context', '/ai/reasoning/prompt', '/ai/tasks/plan', '/ai/runtime/execute', '/ai/validate', '/ai/feedback']) {
  assert.equal(source.includes(endpoint), true, `${endpoint} is consumed`);
}

for (const interaction of ['Copy', 'Export', 'Regenerate', 'accept', 'dismiss', 'save', 'complete', 'remind_later']) {
  assert.equal(source.includes(interaction), true, `${interaction} interaction exists`);
}

for (const accessibility of ['aria-label', 'aria-current', 'role=', 'focus', 'Escape', 'ctrlKey', 'metaKey']) {
  assert.equal(source.includes(accessibility), true, `${accessibility} accessibility pattern exists`);
}

for (const forbidden of ['../backend', 'backend/src', 'validateGrounding', 'validateRecommendations', 'validateConfidence', 'causalReasoner', 'findingExtractor']) {
  assert.equal(source.includes(forbidden), false, `${forbidden} is not duplicated in workspace`);
}

const css = fs.readFileSync(path.join(featureRoot, 'styles', 'ai-coach-workspace.css'), 'utf8');
for (const layout of ['grid-template-columns: 288px minmax(0, 1fr) 340px', '@media (max-width: 1180px)', '@media (max-width: 780px)', 'coach-left-sidebar', 'coach-center-panel', 'coach-right-sidebar']) {
  assert.equal(css.includes(layout), true, `${layout} layout rule exists`);
}

const page = fs.readFileSync(path.join(root, 'pages', 'ai-coach.html'), 'utf8');
assert.equal(page.includes('aiCoachRoot'), true, 'AI Coach page root exists');
assert.equal(page.includes('src/apps/ai-coach/main.jsx'), true, 'AI Coach app entry is mounted');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.scripts['verify:ai-coach-workspace'], 'node scripts/verify-ai-coach-workspace.js');
assert.equal(packageJson.scripts['build:frontend'], 'vite build');

const dockerfile = fs.readFileSync(path.join(root, 'frontend.Dockerfile'), 'utf8');
assert.equal(dockerfile.includes('npm run build:frontend'), true, 'frontend Docker build includes AI Coach bundle');
assert.equal(dockerfile.includes('COPY --from=ai_frontend_build /app/dist /usr/share/nginx/html'), true, 'frontend Docker image serves Vite output');

console.log(JSON.stringify({
  verdict: 'PASS',
  requiredFiles: requiredFiles.length,
  designSystemIntegrated: true,
  sessionLifecycle: true,
  apiEndpoints: 9,
  interactionPatterns: 8,
  responsiveLayout: true,
  presentationalAiLogicBoundary: true
}, null, 2));
