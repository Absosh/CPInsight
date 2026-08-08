export const VISUALIZATION_GROUPS = Object.freeze({
  topicPerformance: {
    label: 'Topic Performance',
    types: ['table', 'bar', 'radar', 'treemap', 'sunburst', 'heatmap', 'bubble']
  },
  contestProgress: {
    label: 'Contest Progress',
    types: ['timeline', 'area', 'candlestick', 'line', 'replayTimeline']
  },
  behaviorIntelligence: {
    label: 'Behavior Intelligence',
    types: ['radar', 'forceGraph', 'sankey', 'chord', 'timeline', 'calendarHeatmap']
  },
  knowledgeGraph: {
    label: 'Knowledge Graph',
    types: ['forceGraph', 'hierarchicalGraph', 'radialGraph', 'clusterGraph', 'dependencyGraph']
  },
  distribution: {
    label: 'Distribution',
    types: ['bar', 'horizontalBar', 'histogram', 'density', 'boxPlot', 'violinPlot', 'table']
  },
  advancedAnalytics: {
    label: 'Advanced Analytics',
    types: ['marimekko', 'ridgeline', 'calendarHeatmap', 'table']
  },
  skillUniverse: {
    label: 'AI Skill Universe',
    types: ['skillUniverse', 'forceGraph', 'radialGraph', 'table']
  }
});

export const CHART_REGISTRY = Object.freeze({
  table: { label: 'Table', engine: 'html', interactive: ['search', 'filter', 'exportCsv'] },
  line: { label: 'Line Chart', engine: 'echarts', seriesType: 'line' },
  area: { label: 'Area Chart', engine: 'echarts', seriesType: 'line', area: true },
  stackedArea: { label: 'Stacked Area', engine: 'echarts', seriesType: 'line', area: true, stack: true },
  bar: { label: 'Bar Chart', engine: 'echarts', seriesType: 'bar' },
  horizontalBar: { label: 'Horizontal Bar', engine: 'echarts', seriesType: 'bar', horizontal: true },
  groupedBar: { label: 'Grouped Bar', engine: 'echarts', seriesType: 'bar', grouped: true },
  pie: { label: 'Pie', engine: 'echarts', seriesType: 'pie' },
  donut: { label: 'Donut', engine: 'echarts', seriesType: 'pie', donut: true },
  gauge: { label: 'Gauge', engine: 'echarts', seriesType: 'gauge' },
  radar: { label: 'Radar', engine: 'echarts', seriesType: 'radar' },
  scatter: { label: 'Scatter', engine: 'echarts', seriesType: 'scatter' },
  bubble: { label: 'Bubble Chart', engine: 'echarts', seriesType: 'scatter', bubble: true },
  treemap: { label: 'Treemap', engine: 'echarts', seriesType: 'treemap' },
  heatmap: { label: 'Heatmap', engine: 'echarts', seriesType: 'heatmap' },
  calendarHeatmap: { label: 'Calendar Heatmap', engine: 'echarts', seriesType: 'heatmap', calendar: true },
  sunburst: { label: 'Sunburst', engine: 'echarts', seriesType: 'sunburst' },
  parallel: { label: 'Parallel Coordinates', engine: 'echarts', seriesType: 'parallel' },
  sankey: { label: 'Sankey Diagram', engine: 'echarts', seriesType: 'sankey' },
  timeline: { label: 'Timeline', engine: 'echarts', seriesType: 'line', timeline: true },
  replayTimeline: { label: 'Replay Timeline', engine: 'echarts', seriesType: 'line', timeline: true, replay: true },
  candlestick: { label: 'Candlestick', engine: 'echarts', seriesType: 'candlestick' },
  boxPlot: { label: 'Box Plot', engine: 'echarts', seriesType: 'boxplot' },
  violinPlot: { label: 'Violin Plot', engine: 'echarts', seriesType: 'boxplot' },
  histogram: { label: 'Histogram', engine: 'echarts', seriesType: 'bar' },
  density: { label: 'Density Plot', engine: 'echarts', seriesType: 'line', area: true },
  waterfall: { label: 'Waterfall', engine: 'echarts', seriesType: 'bar', waterfall: true },
  networkGraph: { label: 'Network Graph', engine: 'echarts', seriesType: 'graph' },
  knowledgeGraph: { label: 'Knowledge Graph', engine: 'echarts', seriesType: 'graph' },
  forceGraph: { label: 'Force Graph', engine: 'echarts', seriesType: 'graph', layout: 'force' },
  chord: { label: 'Chord Diagram', engine: 'd3', seriesType: 'chord' },
  dependencyGraph: { label: 'Dependency Graph', engine: 'echarts', seriesType: 'graph', layout: 'none' },
  hierarchicalGraph: { label: 'Hierarchical Graph', engine: 'echarts', seriesType: 'tree' },
  radialGraph: { label: 'Radial Graph', engine: 'echarts', seriesType: 'tree', radial: true },
  clusterGraph: { label: 'Cluster Graph', engine: 'echarts', seriesType: 'graph', layout: 'force' },
  marimekko: { label: 'Marimekko', engine: 'echarts', seriesType: 'custom', custom: 'marimekko' },
  ridgeline: { label: 'Ridgeline', engine: 'echarts', seriesType: 'custom', custom: 'ridgeline' },
  skillUniverse: { label: 'Skill Universe', engine: 'echarts', seriesType: 'graph', layout: 'force', universe: true }
});

export function resolveVisualizationTypes(group, explicitTypes = []) {
  const groupTypes = VISUALIZATION_GROUPS[group]?.types || [];
  return Array.from(new Set([...explicitTypes, ...groupTypes]))
    .filter((type) => CHART_REGISTRY[type]);
}
