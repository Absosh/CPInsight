import { CHART_REGISTRY, resolveVisualizationTypes } from './registry.js';
import { colorAt, createEchartsTheme, visualizationPalette } from './themeAdapter.js';
import {
  clearVisualizationSelection,
  getSelection,
  selectVisualizationItem
} from './selectionManager.js';
import {
  exportChartImage,
  exportCsv,
  exportPdf,
  exportRawData
} from './exportManager.js';

const labs = new Map();
let echartsPromise = null;

function loadEcharts() {
  if (!echartsPromise) {
    echartsPromise = import('echarts');
  }
  return echartsPromise;
}

function slug(value) {
  return String(value || 'visualization')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'visualization';
}

function ensureContainer(target) {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element) throw new Error('Visualization container not found.');
  return element;
}

function rowsFromData(data = {}) {
  if (Array.isArray(data.rows)) return data.rows;
  const labels = data.labels || [];
  const values = data.values || data.datasets?.[0]?.values || data.datasets?.[0]?.data || [];
  return labels.map((label, index) => ({ label, value: values[index] ?? 0 }));
}

function groupLabel(topic = '') {
  const value = String(topic).toLowerCase();
  if (/graph|bfs|dfs|dsu|shortest|mst|flow|topolog/.test(value)) return 'Graph Theory';
  if (/dp|dynamic|bitmask|digit/.test(value)) return 'Dynamic Programming';
  if (/tree|trie|segment|fenwick|bst/.test(value)) return 'Tree Structures';
  if (/string|hash|suffix|trie/.test(value)) return 'Strings';
  if (/math|number|combin|probab|geometry/.test(value)) return 'Math';
  if (/binary|two pointers|sorting|search|array|implementation/.test(value)) return 'Foundations';
  return 'General';
}

function stateForTopic(row = {}) {
  const mastery = Number(row.mastery ?? row.score ?? row.value ?? 0);
  const roi = Number(row.roi ?? row.priority ?? Math.max(0, 100 - mastery));
  if (mastery >= 78) return 'Mastered';
  if (roi >= 78) return 'High ROI';
  if (mastery < 45) return 'Needs Practice';
  if (row.recentlyPracticed) return 'Recently Practiced';
  return 'Improving';
}

function skillColor(category) {
  const colors = {
    'Graph Theory': '#0ea5e9',
    'Dynamic Programming': '#10b981',
    'Strings': '#f59e0b',
    'Tree Structures': '#8b5cf6',
    Math: '#f43f5e',
    Foundations: '#14b8a6',
    General: '#94a3b8'
  };
  return colors[category] || colors.General;
}

function filteredData(data, query) {
  const q = query.trim().toLowerCase();
  if (!q) return data;
  const rows = rowsFromData(data).filter((row) =>
    Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q))
  );
  const labels = rows.map((row) => row.label || row.name || row.date);
  return {
    ...data,
    rows,
    labels,
    values: rows.map((row) => row.value ?? row.score ?? row.count ?? 0),
    datasets: (data.datasets || []).map((dataset) => ({
      ...dataset,
      values: labels.map((label) => {
        const index = (data.labels || []).indexOf(label);
        return dataset.values?.[index] ?? dataset.data?.[index] ?? null;
      })
    }))
  };
}

function baseAxes(data, horizontal = false) {
  const labels = data.labels || rowsFromData(data).map((row) => row.label || row.name || row.date || '');
  const categoryAxis = {
    type: 'category',
    data: labels,
    axisLabel: { hideOverlap: true }
  };
  const valueAxis = { type: 'value' };
  return horizontal
    ? { xAxis: valueAxis, yAxis: categoryAxis }
    : { xAxis: categoryAxis, yAxis: valueAxis };
}

function seriesFromDataset(data, typeConfig, selectedKey) {
  const rows = rowsFromData(data);
  const datasets = data.datasets?.length
    ? data.datasets
    : [{ name: data.seriesName || 'Value', values: rows.map((row) => row.value ?? row.score ?? row.count ?? 0) }];

  return datasets.map((dataset, datasetIndex) => {
    const values = dataset.values || dataset.data || [];
    return {
      name: dataset.name || dataset.label || 'Value',
      type: typeConfig.seriesType,
      stack: typeConfig.stack ? 'total' : undefined,
      areaStyle: typeConfig.area ? { opacity: 0.18 } : undefined,
      smooth: ['line'].includes(typeConfig.seriesType),
      symbolSize: typeConfig.bubble
        ? (value) => Math.max(10, Math.min(46, Number(Array.isArray(value) ? value[2] : value) || 10))
        : 8,
      itemStyle: {
        color: (params) => {
          const key = params.name || rows[params.dataIndex]?.label;
          const row = rows[params.dataIndex] || {};
          return selectedKey && key === selectedKey
            ? visualizationPalette.amber
            : (row.color || dataset.color || dataset.itemStyle?.color || colorAt(datasetIndex));
        },
        borderColor: selectedKey ? visualizationPalette.text : undefined,
        borderWidth: selectedKey ? 1 : 0
      },
      emphasis: { focus: 'series' },
      data: values.map((value, index) => {
        const row = rows[index] || {};
        const itemKey = row.key || row.label || row.name || data.labels?.[index];
        if (typeConfig.bubble) {
          return {
            name: itemKey,
            value: [index, Number(value) || 0, row.size || row.count || Number(value) || 8],
            raw: row
          };
        }
        return { name: itemKey, value, raw: row };
      })
    };
  });
}

function optionFor(type, data, state = {}) {
  const typeConfig = CHART_REGISTRY[type] || CHART_REGISTRY.line;
  const theme = createEchartsTheme({ darkMode: state.darkMode, animation: state.animation });
  const rows = rowsFromData(data);
  const selectedKey = getSelection(data.scope || state.scope)?.key;

  if (typeConfig.seriesType === 'radar') {
    const labels = data.labels || rows.map((row) => row.label || row.name);
    const values = data.values || data.datasets?.[0]?.values || rows.map((row) => row.value ?? row.score ?? 0);
    return {
      ...theme,
      legend: { show: false },
      radar: {
        center: ['50%', '54%'],
        radius: '64%',
        indicator: labels.map((label) => ({ name: String(label).toUpperCase(), max: 100 })),
        axisName: { color: visualizationPalette.muted },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.14)' } },
        splitArea: { areaStyle: { color: ['rgba(16,185,129,0.03)', 'rgba(99,102,241,0.04)'] } }
      },
      series: [{
        type: 'radar',
        data: [{ value: values, name: data.seriesName || 'Score' }],
        areaStyle: { opacity: 0.2 },
        lineStyle: { width: 3 }
      }]
    };
  }

  if (typeConfig.custom === 'marimekko') {
    const rows = rowsFromData(data);
    const total = rows.reduce((sum, row) => sum + Number(row.total || row.value || 0), 0) || 1;
    let xCursor = 0;
    const monthWidth = new Map();
    rows.forEach((row) => {
      if (!monthWidth.has(row.month)) {
        const monthTotal = rows
          .filter((item) => item.month === row.month)
          .reduce((sum, item) => sum + Number(item.value || 0), 0);
        monthWidth.set(row.month, (monthTotal / total) * 100);
      }
    });
    const monthStart = new Map();
    Array.from(monthWidth.entries()).forEach(([month, width]) => {
      monthStart.set(month, xCursor);
      xCursor += width;
    });
    const stackCursor = {};
    const encodedRows = rows.map((row, index) => {
      const month = row.month;
      const monthTotal = rows
        .filter((item) => item.month === month)
        .reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
      const y0 = stackCursor[month] || 0;
      const height = (Number(row.value || 0) / monthTotal) * 100;
      stackCursor[month] = y0 + height;
      return {
        name: `${row.month} ${row.platform}`,
        value: [
          monthStart.get(month),
          y0,
          monthWidth.get(month),
          height,
          Number(row.value || 0),
          row.platform,
          row.month
        ],
        itemStyle: { color: row.color || colorAt(index) },
        raw: row
      };
    });
    return {
      ...theme,
      grid: { left: 44, right: 16, top: 16, bottom: 36, containLabel: true },
      xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      tooltip: {
        ...theme.tooltip,
        formatter(params) {
          const raw = params.data.raw || {};
          return `<strong>${raw.platform || 'Platform'}</strong><br>${raw.month || ''}<br>${raw.value || 0} submissions<br>${raw.percent || 0}% of month`;
        }
      },
      series: [{
        type: 'custom',
        name: 'Platform contribution',
        renderItem(params, api) {
          const x = api.value(0);
          const y = api.value(1);
          const width = api.value(2);
          const height = api.value(3);
          const start = api.coord([x, y + height]);
          const end = api.coord([x + width, y]);
          return {
            type: 'rect',
            shape: {
              x: start[0],
              y: end[1],
              width: Math.max(1, end[0] - start[0]),
              height: Math.max(1, start[1] - end[1])
            },
            style: api.style({ stroke: 'rgba(7,11,23,0.85)', lineWidth: 1.2 }),
            emphasis: { style: { stroke: '#e5e7eb', lineWidth: 2 } }
          };
        },
        encode: { x: [0, 2], y: [1, 3], tooltip: [4, 5, 6] },
        data: encodedRows
      }]
    };
  }

  if (typeConfig.custom === 'ridgeline') {
    const rows = rowsFromData(data);
    if (rows.some((row) => row.weekday)) {
      const weekdays = rows.map((row) => row.weekday || row.label);
      const maxValue = Math.max(1, ...rows.map((row) => Number(row.value || 0)));
      return {
        ...theme,
        legend: { show: false },
        grid: { left: 62, right: 34, top: 30, bottom: 36, containLabel: true },
        xAxis: {
          type: 'value',
          min: 0,
          max: 100,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.24)' } },
          splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.09)' } },
          axisLabel: { color: visualizationPalette.muted, formatter: '{value}%' }
        },
        yAxis: {
          type: 'value',
          min: -0.2,
          max: Math.max(1, weekdays.length - 0.1),
          interval: 1,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.24)' } },
          splitLine: { show: false },
          axisLabel: {
            color: visualizationPalette.muted,
            fontSize: 12,
            fontWeight: 700,
            margin: 8,
            formatter(value) {
              return weekdays[Math.round(value)] || '';
            }
          }
        },
        tooltip: {
          ...theme.tooltip,
          formatter(params) {
            const raw = params.data.raw || {};
            return `<strong>${raw.weekday || raw.label}</strong><br>${raw.value || 0} accepted submissions`;
          }
        },
        series: rows.map((row, rowIndex) => {
          const activity = Number(row.value || 0);
          const amplitude = activity / maxValue;
          return {
            name: row.weekday || row.label,
            type: 'line',
            smooth: true,
            symbol: 'none',
            areaStyle: { opacity: 0.16 },
            lineStyle: { width: 2 },
            data: Array.from({ length: 41 }, (_, index) => {
              const x = index * 2.5;
              const center = 52;
              const spread = 18;
              const density = Math.exp(-Math.pow((x - center) / spread, 2)) * amplitude * 0.58;
              return {
                name: row.weekday || row.label,
                value: [x, rowIndex + density],
                raw: row
              };
            })
          };
        })
      };
    }

    const dates = Array.from(new Set(rows.map((row) => row.date))).slice(-28);
    const maxDensity = Math.max(1, ...rows.map((row) => Number(row.value || 0)));
    return {
      ...theme,
      grid: { left: 84, right: 18, top: 18, bottom: 32, containLabel: true },
      xAxis: { type: 'value', min: 0, max: 23, interval: 3, axisLabel: { formatter: '{value}:00' } },
      yAxis: {
        type: 'value',
        min: -0.2,
        max: Math.max(1, dates.length),
        interval: 1,
        axisLabel: {
          color: visualizationPalette.muted,
          formatter(value) {
            return dates[Math.round(value)] || '';
          }
        }
      },
      tooltip: {
        ...theme.tooltip,
        formatter(params) {
          const raw = params.data.raw || {};
          return `<strong>${raw.date}</strong><br>${raw.hour}:00<br>${raw.value || 0} submissions${raw.platform ? `<br>${raw.platform}` : ''}`;
        }
      },
      series: dates.map((date, dateIndex) => {
        const byHour = new Map(rows.filter((row) => row.date === date).map((row) => [Number(row.hour), row]));
        return {
          name: date,
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: { opacity: 0.18 },
          lineStyle: { width: 1.8 },
          data: Array.from({ length: 24 }, (_, hour) => {
            const row = byHour.get(hour) || { date, hour, value: 0 };
            return {
              name: `${date} ${hour}:00`,
              value: [hour, dateIndex + (Number(row.value || 0) / maxDensity) * 0.82],
              raw: row
            };
          })
        };
      })
    };
  }

  if (typeConfig.universe) {
    const rows = rowsFromData(data);
    const categories = Array.from(new Set(rows.map((row) => row.category || groupLabel(row.label || row.topic || row.name))));
    const nodes = rows.map((row, index) => {
      const category = row.category || groupLabel(row.label || row.topic || row.name);
      const mastery = Number(row.mastery ?? row.score ?? row.value ?? 0);
      const roi = Number(row.roi ?? Math.max(0, 100 - mastery));
      return {
        name: row.label || row.topic || row.name,
        value: mastery,
        category: categories.indexOf(category),
        symbolSize: Math.max(26, Math.min(76, 28 + roi * 0.38)),
        itemStyle: {
          color: stateForTopic(row) === 'High ROI' ? visualizationPalette.amber : skillColor(category),
          borderColor: mastery >= 78 ? '#ecfeff' : 'rgba(255,255,255,0.22)',
          borderWidth: mastery >= 78 ? 3 : 1
        },
        label: { show: true, formatter: '{b}', color: '#e5e7eb', fontSize: 11 },
        raw: { ...row, category, state: stateForTopic(row), mastery, roi }
      };
    });
    const links = data.links || nodes.flatMap((node, index) =>
      nodes.slice(index + 1).filter((target) => target.raw.category === node.raw.category).slice(0, 2).map((target) => ({
        source: node.name,
        target: target.name,
        value: Math.max(1, Math.round((node.raw.roi + target.raw.roi) / 35))
      }))
    );
    return {
      ...theme,
      legend: {
        ...theme.legend,
        data: categories
      },
      tooltip: {
        ...theme.tooltip,
        formatter(params) {
          const raw = params.data.raw || {};
          return `<strong>${params.name}</strong><br>${raw.category || 'Topic'}<br>${raw.state || 'Improving'}<br>Mastery: ${Math.round(raw.mastery || 0)}%<br>ROI: ${Math.round(raw.roi || 0)}`;
        }
      },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories: categories.map((name) => ({ name })),
        force: { repulsion: 190, edgeLength: [60, 130], friction: 0.24 },
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'source', opacity: 0.34, width: 1.2, curveness: 0.12 },
        data: nodes,
        links
      }]
    };
  }

  if (['treemap', 'sunburst'].includes(typeConfig.seriesType)) {
    return {
      ...theme,
      series: [{
        type: typeConfig.seriesType,
        radius: typeConfig.seriesType === 'sunburst' ? [0, '88%'] : undefined,
        roam: true,
        nodeClick: 'zoomToNode',
        label: { color: visualizationPalette.text, overflow: 'truncate' },
        data: rows.map((row, index) => ({
          name: row.label || row.name,
          value: row.value ?? row.score ?? row.count ?? 1,
          itemStyle: { color: selectedKey === (row.label || row.name) ? visualizationPalette.amber : colorAt(index) },
          raw: row
        }))
      }]
    };
  }

  if (typeConfig.seriesType === 'heatmap') {
    const values = rows.map((row, index) => [index, 0, row.value ?? row.score ?? row.count ?? 0]);
    return {
      ...theme,
      ...baseAxes({ labels: rows.map((row) => row.label || row.name || row.date) }),
      yAxis: { type: 'category', data: [data.seriesName || 'Value'] },
      visualMap: {
        min: 0,
        max: Math.max(1, ...values.map((item) => item[2])),
        show: false,
        inRange: { color: ['#10231f', visualizationPalette.emerald, visualizationPalette.amber] }
      },
      series: [{ type: 'heatmap', data: values }]
    };
  }

  if (typeConfig.seriesType === 'candlestick') {
    const values = rows.map((row) => {
      const close = Number(row.value ?? row.rating ?? row.close ?? 0);
      const delta = Number(row.delta ?? 0);
      return [close - delta, close, Math.min(close - delta, close) - 15, Math.max(close - delta, close) + 15];
    });
    return {
      ...theme,
      ...baseAxes({ labels: rows.map((row) => row.label || row.date || row.name) }),
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 12, bottom: 0 }],
      series: [{ type: 'candlestick', data: values }]
    };
  }

  if (['graph', 'tree', 'sankey'].includes(typeConfig.seriesType)) {
    const nodes = data.nodes || rows.map((row, index) => ({
      name: row.label || row.name,
      value: row.value ?? row.score ?? 1,
      category: row.category || 'default',
      itemStyle: { color: colorAt(index) }
    }));
    const links = data.links || nodes.slice(1).map((node, index) => ({ source: nodes[index].name, target: node.name, value: 1 }));
    return {
      ...theme,
      series: [{
        type: typeConfig.seriesType === 'sankey' ? 'sankey' : typeConfig.seriesType,
        layout: typeConfig.layout || (typeConfig.seriesType === 'graph' ? 'force' : undefined),
        orient: typeConfig.radial ? 'radial' : undefined,
        roam: true,
        draggable: true,
        force: { repulsion: 160, edgeLength: 80 },
        data: nodes,
        links,
        label: { show: true, color: visualizationPalette.text },
        lineStyle: { color: 'source', opacity: 0.42 }
      }]
    };
  }

  const axes = baseAxes(data, typeConfig.horizontal);
  const needsZoom = rows.length > 10 || (data.labels || []).length > 10;
  return {
    ...theme,
    ...axes,
    legend: state.hideLegend ? { show: false } : theme.legend,
    dataZoom: needsZoom ? [{ type: 'inside' }, { type: 'slider', height: 12, bottom: 0 }] : undefined,
    series: seriesFromDataset(data, typeConfig, selectedKey)
  };
}

function renderTable(stage, data) {
  const rows = rowsFromData(data);
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set(['label', 'value'])));

  stage.innerHTML = `
    <div class="viz-table-wrap">
      <table class="viz-table">
        <thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr data-viz-key="${row.key || row.label || row.name || ''}">
              ${columns.map((column) => `<td>${row[column] ?? ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderInsightPanel(panel, raw = {}) {
  if (!panel) return;
  const problems = Array.isArray(raw.problems) ? raw.problems : [];
  panel.innerHTML = `
    <div class="viz-insight-header">
      <div>
        <span>${raw.category || raw.state || 'Topic'}</span>
        <strong>${raw.label || raw.topic || raw.name || 'Selected topic'}</strong>
      </div>
      <button type="button" class="viz-insight-close" aria-label="Close topic panel">x</button>
    </div>
    <div class="viz-insight-grid">
      <div><span>Mastery</span><strong>${Math.round(raw.mastery ?? raw.score ?? raw.value ?? 0)}%</strong></div>
      <div><span>ROI</span><strong>${Math.round(raw.roi ?? raw.priority ?? 0)}</strong></div>
      <div><span>Confidence</span><strong>${Math.round(raw.confidence ?? 0)}%</strong></div>
      <div><span>Solved</span><strong>${raw.solved ?? raw.accepted ?? 0}</strong></div>
    </div>
    <p>${raw.insight || raw.reason || 'This topic is linked to your current analytics evidence.'}</p>
    <div class="viz-problem-bank">
      <h4>Problem Bank</h4>
      ${problems.length
        ? problems.slice(0, 10).map((problem) => `
          <a href="${problem.url || '#'}" ${problem.url ? 'target="_blank" rel="noopener noreferrer"' : ''}>
            <span>${problem.platform || 'Platform'} · ${problem.difficulty || 'Mixed'}</span>
            <strong>${problem.name || problem.title || 'Recommended problem'}</strong>
          </a>
        `).join('')
        : '<p>No synced problem-bank entries are attached to this topic yet.</p>'}
    </div>
  `;
  panel.classList.remove('hidden');
  panel.querySelector('.viz-insight-close')?.addEventListener('click', () => panel.classList.add('hidden'));
}

function renderSkillUniverseStage(stage, data, insightPanel, config, state) {
  const rows = rowsFromData(data);
  const categories = Array.from(new Set(rows.map((row) => row.category || groupLabel(row.label || row.topic || row.name))));
  const width = Math.max(760, stage.clientWidth || 900);
  const height = Math.max(390, stage.clientHeight || 460);
  const centerX = width / 2;
  const centerY = height / 2 + 12;
  const ringRadius = Math.min(width, height) * 0.33;
  const clusterRadius = Math.max(72, Math.min(116, ringRadius * 0.45));

  const nodes = rows.map((row, index) => {
    const category = row.category || groupLabel(row.label || row.topic || row.name);
    const categoryIndex = Math.max(0, categories.indexOf(category));
    const categoryAngle = (Math.PI * 2 * categoryIndex) / Math.max(1, categories.length) - Math.PI / 2;
    const siblings = rows.filter((item) => (item.category || groupLabel(item.label || item.topic || item.name)) === category);
    const siblingIndex = siblings.findIndex((item) => (item.label || item.topic || item.name) === (row.label || row.topic || row.name));
    const localAngle = (Math.PI * 2 * Math.max(0, siblingIndex)) / Math.max(1, siblings.length);
    const mastery = Number(row.mastery ?? row.score ?? row.value ?? 0);
    const roi = Number(row.roi ?? Math.max(0, 100 - mastery));
    const baseX = centerX + Math.cos(categoryAngle) * ringRadius;
    const baseY = centerY + Math.sin(categoryAngle) * ringRadius * 0.68;
    const radius = Math.max(18, Math.min(38, 18 + roi * 0.2));
    return {
      row,
      category,
      label: row.label || row.topic || row.name,
      x: baseX + Math.cos(localAngle) * clusterRadius,
      y: baseY + Math.sin(localAngle) * clusterRadius * 0.66,
      radius,
      mastery,
      roi,
      color: stateForTopic(row) === 'High ROI' ? visualizationPalette.amber : skillColor(category)
    };
  });

  const links = nodes.flatMap((node, index) =>
    nodes.slice(index + 1)
      .filter((target) => target.category === node.category)
      .slice(0, 2)
      .map((target) => ({ source: node, target }))
  );

  stage.innerHTML = `
    <div class="viz-skill-universe" style="--universe-width:${width}px">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="AI Skill Universe topic graph">
        <defs>
          <filter id="skillGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        ${categories.map((category, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, categories.length) - Math.PI / 2;
          const x = centerX + Math.cos(angle) * ringRadius;
          const y = centerY + Math.sin(angle) * ringRadius * 0.68;
          return `
            <g class="viz-skill-cluster">
              <ellipse cx="${x}" cy="${y}" rx="${clusterRadius + 44}" ry="${clusterRadius * 0.72 + 34}" fill="${skillColor(category)}" />
              <text x="${x}" y="${y - clusterRadius * 0.72 - 22}">${category}</text>
            </g>
          `;
        }).join('')}
        ${links.map((link) => `
          <line class="viz-skill-link" x1="${link.source.x}" y1="${link.source.y}" x2="${link.target.x}" y2="${link.target.y}" />
        `).join('')}
        ${nodes.map((node, index) => `
          <g class="viz-skill-node" data-index="${index}" tabindex="0" role="button" aria-label="${node.label}">
            <circle cx="${node.x}" cy="${node.y}" r="${node.radius}" fill="${node.color}" filter="url(#skillGlow)" />
            <circle cx="${node.x}" cy="${node.y}" r="${Math.max(6, node.radius * (node.mastery / 100))}" fill="rgba(255,255,255,0.18)" />
            <text x="${node.x}" y="${node.y + node.radius + 16}">${node.label}</text>
          </g>
        `).join('')}
      </svg>
    </div>
  `;

  stage.querySelectorAll('.viz-skill-node').forEach((nodeElement) => {
    const node = nodes[Number(nodeElement.dataset.index)];
    const activate = () => {
      const selection = selectVisualizationItem({
        scope: state.scope,
        sourceId: config.id,
        entityType: config.entityType || 'topic',
        key: node.row.key || node.label,
        label: node.label,
        payload: node.row
      });
      renderInsightPanel(insightPanel, node.row);
      config.onSelect?.(selection);
    };
    nodeElement.addEventListener('click', activate);
    nodeElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
  });
}

function controlIcon(label) {
  const icons = {
    fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" /></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 16V4" /><path d="M8 8l4-4 4 4" /></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></svg>'
  };
  return icons[label] || label;
}

export function createVisualizationLab(target, config = {}) {
  const container = ensureContainer(target);
  const id = config.id || container.id || `viz-${Math.random().toString(36).slice(2)}`;
  const types = resolveVisualizationTypes(config.group, config.types || []);
  const defaultType = types.includes(config.defaultType) ? config.defaultType : (types[0] || 'line');
  const state = {
    type: defaultType,
    darkMode: config.darkMode ?? true,
    animation: config.animation ?? !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hideLegend: Boolean(config.hideLegend),
    query: '',
    scope: config.scope || config.group || id
  };

  labs.get(id)?.destroy();
  container.innerHTML = '';
  container.classList.remove('hidden');
  container.classList.add('viz-lab-host');

  const shell = document.createElement('section');
  shell.className = 'viz-lab';
  shell.dataset.vizId = id;
  shell.innerHTML = `
    <div class="viz-toolbar">
      <div class="viz-toolbar-main">
        ${types.length > 1
          ? `<select class="viz-control viz-type" aria-label="Switch visualization type">
              ${types.map((type) => `<option value="${type}">${CHART_REGISTRY[type].label}</option>`).join('')}
            </select>`
          : ''}
        <label class="viz-search-wrap">
          <span>Search</span>
          <input class="viz-control viz-search" type="search" placeholder="Filter data" aria-label="Search visualization data">
        </label>
      </div>
      <div class="viz-actions">
        <button type="button" class="viz-action viz-icon-action" data-action="fullscreen" title="Fullscreen" aria-label="Fullscreen">${controlIcon('fullscreen')}</button>
        <div class="viz-share-menu">
          <button type="button" class="viz-action viz-icon-action" data-action="share" title="Export and download" aria-label="Export and download">${controlIcon('share')}</button>
          <div class="viz-export-popover" role="menu" aria-label="Export options">
            ${['png', 'svg', 'pdf', 'csv', 'data'].map((action) =>
              `<button type="button" class="viz-export-option" data-action="${action}" role="menuitem">${action === 'data' ? 'Raw data' : action.toUpperCase()}</button>`
            ).join('')}
          </div>
        </div>
        <button type="button" class="viz-action viz-icon-action" data-action="reset" title="Reset view" aria-label="Reset view">${controlIcon('reset')}</button>
      </div>
    </div>
    <div class="viz-stage" role="img" aria-label="${config.title || 'Interactive visualization'}"></div>
    <aside class="viz-insight-panel hidden" aria-live="polite"></aside>
    <div class="viz-empty hidden">
      <strong>No matching data</strong>
      <span>Try a different search or filter.</span>
    </div>
  `;
  container.appendChild(shell);

  const typeSelect = shell.querySelector('.viz-type');
  const search = shell.querySelector('.viz-search');
  const stage = shell.querySelector('.viz-stage');
  const insightPanel = shell.querySelector('.viz-insight-panel');
  const empty = shell.querySelector('.viz-empty');
  if (typeSelect) typeSelect.value = state.type;

  let chart = null;
  const resizeObserver = new ResizeObserver(() => chart?.resize?.());
  resizeObserver.observe(stage);

  function disposeChart() {
    if (chart) {
      chart.dispose();
      chart = null;
    }
    stage.innerHTML = '';
  }

  function currentData() {
    return filteredData(config.data || {}, state.query);
  }

  async function render() {
    const data = currentData();
    const hasRows = rowsFromData(data).length || data.nodes?.length;
    empty.classList.toggle('hidden', Boolean(hasRows));
    stage.classList.toggle('hidden', !hasRows);
    disposeChart();
    if (!hasRows) return;

    if (state.type === 'table') {
      renderTable(stage, data);
      return;
    }

    if (state.type === 'skillUniverse') {
      renderSkillUniverseStage(stage, data, insightPanel, config, state);
      return;
    }

    const echarts = await loadEcharts();
    chart = echarts.init(stage, state.darkMode ? 'dark' : null, { renderer: 'svg' });
    chart.setOption(optionFor(state.type, { ...data, scope: state.scope }, state), true);
    chart.on('click', (params) => {
      const raw = params.data?.raw || {};
      const selection = selectVisualizationItem({
        scope: state.scope,
        sourceId: id,
        entityType: config.entityType || 'analytics-item',
        key: raw.key || params.name,
        label: raw.label || raw.name || params.name,
        payload: raw
      });
      if (state.type === 'skillUniverse') {
        renderInsightPanel(insightPanel, raw);
      }
      config.onSelect?.(selection);
    });
    chart.on('dblclick', (params) => {
      const raw = params.data?.raw || {};
      config.onOpenTopic?.(raw);
    });
  }

  function resetView() {
    if (chart) {
      chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
      chart.dispatchAction({ type: 'restore' });
    }
    clearVisualizationSelection(state.scope);
    render();
  }

  typeSelect?.addEventListener('change', () => {
    state.type = typeSelect.value;
    render();
  });

  search.addEventListener('input', () => {
    state.query = search.value;
    render();
  });

  shell.querySelector('.viz-actions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'share') return;
    const filename = `${slug(config.title || id)}-${state.type}`;
    const data = currentData();
    switch (button.dataset.action) {
      case 'fullscreen':
        shell.requestFullscreen?.();
        break;
      case 'png':
        exportChartImage(chart, `${filename}.png`, 'png');
        break;
      case 'svg':
        exportChartImage(chart, `${filename}.svg`, 'svg');
        break;
      case 'pdf':
        exportPdf(shell, `${filename}.pdf`);
        break;
      case 'csv':
        exportCsv(data, `${filename}.csv`);
        break;
      case 'data':
        exportRawData(data, `${filename}.json`);
        break;
      case 'reset':
        resetView();
        break;
      default:
        break;
    }
  });

  function handleLinkedSelection(event) {
    if (event.detail.scope !== state.scope || event.detail.sourceId === id) return;
    render();
  }

  window.addEventListener('cpinsight:visualization-select', handleLinkedSelection);
  window.addEventListener('cpinsight:visualization-clear', handleLinkedSelection);

  const api = {
    id,
    render,
    resize: () => chart?.resize?.(),
    resetView,
    getChart: () => chart,
    destroy() {
      window.removeEventListener('cpinsight:visualization-select', handleLinkedSelection);
      window.removeEventListener('cpinsight:visualization-clear', handleLinkedSelection);
      resizeObserver.disconnect();
      disposeChart();
      labs.delete(id);
    }
  };

  labs.set(id, api);
  render();
  return api;
}

export function destroyVisualizationLab(id) {
  labs.get(id)?.destroy();
}

export function getVisualizationLab(id) {
  return labs.get(id) || null;
}
