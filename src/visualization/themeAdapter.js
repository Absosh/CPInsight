export const visualizationPalette = Object.freeze({
  emerald: '#10b981',
  teal: '#14b8a6',
  sky: '#0ea5e9',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#94a3b8',
  surface: '#0b1220',
  panel: 'rgba(15, 23, 42, 0.82)',
  border: 'rgba(148, 163, 184, 0.18)',
  text: '#e5e7eb',
  muted: '#9ca3af'
});

export function colorAt(index) {
  const colors = [
    visualizationPalette.emerald,
    visualizationPalette.indigo,
    visualizationPalette.sky,
    visualizationPalette.amber,
    visualizationPalette.violet,
    visualizationPalette.rose,
    visualizationPalette.teal
  ];
  return colors[Math.abs(index) % colors.length];
}

export function createEchartsTheme({ darkMode = true, animation = true } = {}) {
  return {
    darkMode,
    color: [0, 1, 2, 3, 4, 5, 6].map(colorAt),
    backgroundColor: 'transparent',
    textStyle: {
      color: visualizationPalette.text,
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    animation,
    animationDuration: 900,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      confine: true,
      appendToBody: true,
      className: 'viz-echarts-tooltip',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderColor: visualizationPalette.border,
      borderWidth: 1,
      textStyle: { color: visualizationPalette.text },
      extraCssText: 'border-radius: 8px; box-shadow: 0 18px 40px rgba(0,0,0,0.32); padding: 8px 10px; max-width: 220px;'
    },
    legend: {
      textStyle: { color: visualizationPalette.muted },
      icon: 'circle',
      itemGap: 14
    },
    grid: {
      left: 42,
      right: 22,
      top: 32,
      bottom: 42,
      containLabel: true
    },
    xAxis: {
      axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.22)' } },
      axisTick: { show: false },
      axisLabel: { color: visualizationPalette.muted },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.08)' } }
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: visualizationPalette.muted },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.08)' } }
    }
  };
}
