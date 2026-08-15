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
  'components/StudyPlannerWorkspace.jsx',
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

for (const component of ['CoachMessage', 'RoadmapViewer', 'ReflectionTimeline']) {
  assert.equal(source.includes(component), true, `${component} is integrated`);
}

for (const lifecycle of ['sessions/created', 'sessions/renamed', 'sessions/archived', 'sessions/deleted', 'sessions/pinned', 'sessions/selected']) {
  assert.equal(source.includes(lifecycle), true, `${lifecycle} is handled`);
}

for (const endpoint of ['/ai/planner/classify', '/ai/planner/plan', '/ai/retrieval/execute', '/ai/reasoning/context', '/ai/reasoning/prompt', '/ai/plan', '/ai/runtime/execute', '/ai/validate', '/ai/feedback']) {
  assert.equal(source.includes(endpoint), true, `${endpoint} is consumed`);
}

for (const interaction of ['Copy', 'Export', 'Regenerate', 'recommendations/actionRecorded', 'messages/completed']) {
  assert.equal(source.includes(interaction), true, `${interaction} interaction exists`);
}

for (const accessibility of ['aria-label', 'aria-current', 'role=', 'focus', 'Escape', 'ctrlKey', 'metaKey']) {
  assert.equal(source.includes(accessibility), true, `${accessibility} accessibility pattern exists`);
}

for (const forbidden of ['../backend', 'backend/src', 'validateGrounding', 'validateRecommendations', 'validateConfidence', 'causalReasoner', 'findingExtractor']) {
  assert.equal(source.includes(forbidden), false, `${forbidden} is not duplicated in workspace`);
}

const css = fs.readFileSync(path.join(featureRoot, 'styles', 'ai-coach-workspace.css'), 'utf8');
for (const layout of ['grid-template-columns: 280px minmax(0, 1fr) 320px', '@media (max-width: 1180px)', '@media (max-width: 780px)', 'coach-left-sidebar', 'coach-center-panel', 'coach-right-sidebar']) {
  assert.equal(css.includes(layout), true, `${layout} layout rule exists`);
}

const page = fs.readFileSync(path.join(root, 'pages', 'ai-coach.html'), 'utf8');
assert.equal(page.includes('aiCoachRoot'), true, 'AI Coach page root exists');
assert.equal(page.includes('script/ai_coach.bundle.js'), true, 'AI Coach runtime bundle is mounted');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.scripts['verify:ai-coach-workspace'], 'node scripts/verify-ai-coach-workspace.js');
assert.equal(packageJson.scripts['build:frontend'].includes('build:ai-coach-runtime'), true, 'frontend build creates the AI Coach runtime');

const providerSource = fs.readFileSync(path.join(featureRoot, 'state', 'AiCoachWorkspaceProvider.jsx'), 'utf8');
assert.equal(providerSource.includes('if (initialState) return'), false, 'initial state does not disable server hydration');
assert.equal(providerSource.includes("authoritative: true"), true, 'server conversations replace recovery state');
const persistUser = providerSource.indexOf("messageId: userMessageId");
const persistCoach = providerSource.indexOf("messageId: coachMessageId", persistUser);
assert.equal(persistUser >= 0 && persistCoach > persistUser, true, 'user and coach messages persist in sequence');

const repositorySource = fs.readFileSync(path.join(root, 'backend', 'src', 'repositories', 'conversationRepository.js'), 'utf8');
assert.equal(repositorySource.includes('FOR UPDATE'), true, 'conversation message ordering is serialized');
assert.equal(fs.existsSync(path.join(root, 'backend', 'src', 'database', 'migrations', '020_ai_conversation_message_order.sql')), true, 'message order uniqueness migration exists');

const dockerfile = fs.readFileSync(path.join(root, 'frontend.Dockerfile'), 'utf8');
assert.equal(dockerfile.includes('npm run build:frontend'), true, 'frontend Docker build includes AI Coach bundle');
assert.equal(dockerfile.includes('COPY --from=ai_frontend_build /app/dist /usr/share/nginx/html'), true, 'frontend Docker image serves Vite output');

console.log(JSON.stringify({
  verdict: 'PASS',
  requiredFiles: requiredFiles.length,
  designSystemIntegrated: true,
  sessionLifecycle: true,
  apiEndpoints: 9,
  interactionPatterns: 5,
  serverAuthoritativeHistory: true,
  deterministicMessageOrdering: true,
  responsiveLayout: true,
  presentationalAiLogicBoundary: true
}, null, 2));
