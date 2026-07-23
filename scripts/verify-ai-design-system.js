const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const aiRoot = path.join(root, 'src', 'components', 'ai');

const requiredFiles = [
  'tokens/designTokens.js',
  'theme/createTheme.js',
  'theme/AiThemeProvider.jsx',
  'theme/ai-theme.css',
  'base/CoachMessage.jsx',
  'base/ConfidenceBadge.jsx',
  'cards/EvidenceCard.jsx',
  'reasoning/ReasoningPanel.jsx',
  'cards/RecommendationCard.jsx',
  'reasoning/BehaviorChip.jsx',
  'timeline/ReflectionTimeline.jsx',
  'timeline/ProgressMilestone.jsx',
  'cards/SourceReference.jsx',
  'feedback/QualityIndicator.jsx',
  'cards/CoachResponse.jsx',
  'cards/EvidenceExplorer.jsx',
  'cards/RecommendationList.jsx',
  'reasoning/BehaviorOverview.jsx',
  'timeline/ReflectionFeed.jsx',
  'cards/RoadmapViewer.jsx',
  'cards/ContestReview.jsx',
  'cards/InsightSummary.jsx',
  'cards/ActionPlan.jsx',
  'layout/AiWorkspace.jsx',
  'layout/ConversationView.jsx',
  'animations/animationClasses.js',
  'charts/ConfidenceScale.jsx',
  'stories/AIComponents.stories.jsx',
  'index.js'
];

for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(aiRoot, file)), true, `${file} exists`);
}

const tokens = fs.readFileSync(path.join(aiRoot, 'tokens', 'designTokens.js'), 'utf8');
for (const tokenGroup of ['spacing', 'radius', 'elevation', 'blur', 'typography', 'motion', 'icon', 'breakpoints', 'semantic', 'confidence', 'state']) {
  assert.equal(tokens.includes(tokenGroup), true, `${tokenGroup} token exists`);
}

const css = fs.readFileSync(path.join(aiRoot, 'ai-components.css'), 'utf8') + fs.readFileSync(path.join(aiRoot, 'theme', 'ai-theme.css'), 'utf8');
for (const selector of ['prefers-reduced-motion', 'focus-visible', 'ai-skeleton', 'ai-streaming-cursor', 'ai-card-grid', 'ai-workspace']) {
  assert.equal(css.includes(selector), true, `${selector} style exists`);
}

const sourceText = requiredFiles
  .filter((file) => file.endsWith('.jsx') || file.endsWith('.js'))
  .map((file) => fs.readFileSync(path.join(aiRoot, file), 'utf8'))
  .join('\n');

for (const forbidden of ['fetch(', 'axios', 'XMLHttpRequest', '/api/', 'localStorage', 'sessionStorage']) {
  assert.equal(sourceText.includes(forbidden), false, `${forbidden} is not used by presentational components`);
}

for (const exportName of ['CoachMessage', 'EvidenceCard', 'ReasoningPanel', 'ConfidenceBadge', 'RecommendationCard', 'BehaviorChip', 'ReflectionTimeline', 'ProgressMilestone', 'SourceReference', 'QualityIndicator', 'CoachResponse', 'EvidenceExplorer', 'RecommendationList', 'BehaviorOverview', 'ReflectionFeed', 'RoadmapViewer', 'ContestReview', 'InsightSummary', 'ActionPlan']) {
  assert.equal(sourceText.includes(exportName), true, `${exportName} is covered`);
}

const stories = fs.readFileSync(path.join(aiRoot, 'stories', 'AIComponents.stories.jsx'), 'utf8');
for (const storyName of ['Default', 'Streaming', 'Composite', 'Layout']) {
  assert.equal(stories.includes(storyName), true, `${storyName} story coverage exists`);
}

console.log(JSON.stringify({
  verdict: 'PASS',
  requiredFiles: requiredFiles.length,
  tokenGroups: 11,
  presentationalBoundary: true,
  reducedMotion: true,
  focusVisible: true,
  storybookStories: (stories.match(/export const /g) || []).length
}, null, 2));
