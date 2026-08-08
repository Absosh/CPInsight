(() => {
  const BRANCHES = [
    {
      id: 'foundations',
      label: 'Foundations',
      color: '#38bdf8',
      x: 0.14,
      nodes: ['Core Programming', 'Arrays', 'Searching', 'Sorting', 'Binary Search', 'Two Pointers', 'Sliding Window']
    },
    {
      id: 'trees',
      label: 'Trees',
      color: '#60a5fa',
      x: 0.34,
      nodes: ['Trees', 'Binary Tree', 'BST', 'LCA', 'Trie', 'Segment Tree', 'Fenwick Tree']
    },
    {
      id: 'dp',
      label: 'Dynamic Programming',
      color: '#818cf8',
      x: 0.54,
      nodes: ['DP', 'Knapsack', 'LIS', 'Bitmask DP', 'Tree DP', 'Digit DP', 'Optimization']
    },
    {
      id: 'graphs',
      label: 'Graphs',
      color: '#22d3ee',
      x: 0.74,
      nodes: ['Graph Theory', 'DFS', 'BFS', 'Shortest Path', 'MST', 'DSU', 'Topological Sort', 'Flows']
    },
    {
      id: 'strings',
      label: 'Strings',
      color: '#a78bfa',
      x: 0.89,
      nodes: ['String Algorithms', 'Hashing', 'Prefix Function', 'KMP', 'Suffix Array']
    }
  ];

  const CROSS_PREREQS = [
    ['Binary Search', 'Optimization'],
    ['DFS', 'Trees'],
    ['BFS', 'Shortest Path'],
    ['Trees', 'Tree DP'],
    ['Trie', 'String Algorithms'],
    ['Segment Tree', 'Optimization'],
    ['DSU', 'MST'],
    ['Topological Sort', 'DP']
  ];

  const SYNONYMS = {
    'Core Programming': ['implementation', 'constructive algorithms', 'brute force'],
    Arrays: ['arrays', 'array'],
    Searching: ['searching', 'search'],
    Sorting: ['sorting', 'sortings'],
    'Binary Search': ['binary search', 'parametric search'],
    'Two Pointers': ['two pointers', 'two pointer'],
    'Sliding Window': ['sliding window'],
    Trees: ['trees', 'tree'],
    'Binary Tree': ['binary tree'],
    BST: ['bst', 'binary search tree'],
    LCA: ['lca', 'lowest common ancestor'],
    Trie: ['trie'],
    'Segment Tree': ['segment tree', 'segtree'],
    'Fenwick Tree': ['fenwick', 'bit'],
    DP: ['dp', 'dynamic programming'],
    Knapsack: ['knapsack'],
    LIS: ['lis', 'longest increasing subsequence'],
    'Bitmask DP': ['bitmask dp', 'bitmask'],
    'Tree DP': ['tree dp'],
    'Digit DP': ['digit dp'],
    Optimization: ['optimization', 'divide and conquer', 'convex hull trick'],
    'Graph Theory': ['graph theory', 'graphs', 'graph'],
    DFS: ['dfs'],
    BFS: ['bfs'],
    'Shortest Path': ['shortest path', 'dijkstra', 'floyd'],
    MST: ['mst', 'minimum spanning tree'],
    DSU: ['dsu', 'disjoint set'],
    'Topological Sort': ['topological sort', 'toposort'],
    Flows: ['flows', 'max flow', 'flow'],
    'String Algorithms': ['strings', 'string algorithms', 'string'],
    Hashing: ['hashing', 'hash'],
    'Prefix Function': ['prefix function', 'z function'],
    KMP: ['kmp'],
    'Suffix Array': ['suffix array', 'suffix']
  };

  const stateLabels = {
    locked: 'Locked',
    unlocked: 'Unlocked',
    learning: 'Learning',
    mastered: 'Mastered',
    weak: 'Weak',
    recommended: 'Recommended',
    'contest-critical': 'Contest Critical',
    recent: 'Recently Practiced',
    'ai-priority': 'AI Priority',
    regressed: 'Recently Regressed'
  };

  const stateColors = {
    locked: '#64748b',
    unlocked: '#38bdf8',
    learning: '#818cf8',
    mastered: '#38bdf8',
    weak: '#67e8f9',
    recommended: '#67e8f9',
    'contest-critical': '#fb7185',
    recent: '#34d399',
    'ai-priority': '#22d3ee',
    regressed: '#fb7185'
  };

  let treeState = {
    analytics: null,
    nodes: [],
    edges: [],
    selected: null,
    transform: { x: 0, y: 0, scale: 1 },
    timeline: 1
  };

  function safeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function topicName(topic) {
    return topic.name || topic.topic || topic.label || topic.key || '';
  }

  function topicScore(topic) {
    return Number(topic.score ?? topic.strength ?? topic.mastery ?? topic.value ?? 0);
  }

  function matchesSkill(topic, skill) {
    const haystack = normalize(topicName(topic));
    return (SYNONYMS[skill] || [skill]).some((alias) => haystack.includes(normalize(alias)));
  }

  function evidenceForSkill(skill, analytics) {
    const topics = safeList(analytics?.topicStrength);
    return topics.filter((topic) => matchesSkill(topic, skill));
  }

  function recentEvidence(skill, analytics) {
    const terms = (SYNONYMS[skill] || [skill]).map(normalize);
    return safeList(analytics?.recentSubmissions).filter((submission) => {
      const values = [
        submission.problemName,
        submission.name,
        submission.title,
        ...(safeList(submission.tags || submission.problem?.tags))
      ].map(normalize).join(' ');
      return terms.some((term) => values.includes(term));
    });
  }

  function masteryFor(skill, analytics) {
    const evidence = evidenceForSkill(skill, analytics);
    if (!evidence.length) return null;
    const totalSolved = evidence.reduce((sum, topic) => sum + Number(topic.solved ?? topic.accepted ?? 1), 0);
    const weighted = evidence.reduce((sum, topic) => {
      const solved = Math.max(1, Number(topic.solved ?? topic.accepted ?? 1));
      return sum + topicScore(topic) * solved;
    }, 0);
    return Math.max(0, Math.min(100, Math.round(weighted / Math.max(1, totalSolved))));
  }

  function nodeState({ mastery, recent, prereqMastery, analytics }) {
    if (mastery === null && prereqMastery >= 100) return 'unlocked';
    if (mastery === null && prereqMastery < 45) return 'locked';
    if (mastery === null) return 'unlocked';
    if (recent) return 'recent';
    if (mastery >= 78) return 'mastered';
    if (mastery < 35 && Number(analytics?.contestCount || 0) > 0) return 'contest-critical';
    if (mastery < 45) return 'ai-priority';
    if (mastery < 62) return 'weak';
    return 'learning';
  }

  function buildTree(analytics) {
    const nodes = [];
    const edges = [];
    BRANCHES.forEach((branch, branchIndex) => {
      branch.nodes.forEach((name, index) => {
        const isBoss = index === 0 || ['Segment Tree', 'DP', 'Graph Theory', 'String Algorithms'].includes(name);
        const isMilestone = index === branch.nodes.length - 1 || isBoss;
        const xJitter = Math.sin(index * 1.7 + branchIndex) * 0.035;
        const y = 0.1 + index * (0.78 / Math.max(1, branch.nodes.length - 1));
        const x = branch.x + xJitter;
        const previous = index ? nodes.find((node) => node.name === branch.nodes[index - 1]) : null;
        const mastery = masteryFor(name, analytics);
        const recents = recentEvidence(name, analytics);
        const prereqMastery = index === 0 ? 100 : (previous?.mastery ?? 0);
        const state = nodeState({ mastery, recent: Boolean(recents.length), prereqMastery, analytics });
        const effectiveMastery = mastery === null
          ? 0
          : Math.max(0, Math.min(100, Math.round(mastery + (treeState.timeline - 1) * 12)));
        const node = {
          id: normalize(name).replace(/\s+/g, '-'),
          name,
          branch: branch.id,
          branchLabel: branch.label,
          color: branch.color,
          x,
          y,
          size: isBoss ? 'boss' : isMilestone ? 'milestone' : index % 2 ? 'topic' : 'concept',
          radius: isBoss ? 42 : isMilestone ? 34 : index % 2 ? 27 : 21,
          mastery,
          effectiveMastery,
          confidence: mastery === null ? 0 : Math.min(97, Math.round(52 + effectiveMastery * 0.44)),
          roi: mastery === null ? 0 : Math.max(12, Math.min(99, Math.round(100 - mastery + (isBoss ? 10 : 0)))),
          recentSubmissions: recents,
          evidence: evidenceForSkill(name, analytics),
          state
        };
        nodes.push(node);
        if (previous) edges.push({ from: previous.id, to: node.id, type: 'prereq' });
      });
    });

    CROSS_PREREQS.forEach(([fromName, toName]) => {
      const from = nodes.find((node) => node.name === fromName);
      const to = nodes.find((node) => node.name === toName);
      if (from && to) edges.push({ from: from.id, to: to.id, type: 'cross' });
    });

    return { nodes, edges };
  }

  function branchLabelPosition(branch) {
    return {
      x: 80 + branch.x * 1240,
      y: 708
    };
  }

  function svgPoint(node) {
    return {
      x: 80 + node.x * 1240,
      y: 48 + node.y * 626
    };
  }

  function edgePath(from, to, type) {
    const a = svgPoint(from);
    const b = svgPoint(to);
    const midY = (a.y + b.y) / 2;
    const offset = type === 'cross' ? (a.x < b.x ? 90 : -90) : 0;
    return `M ${a.x} ${a.y + from.radius} C ${a.x + offset} ${midY}, ${b.x - offset} ${midY}, ${b.x} ${b.y - to.radius}`;
  }

  function renderPageShell(main) {
    main.innerHTML = `
      <section class="skill-tree-page">
        <div class="skill-tree-hero reveal visible">
          <div class="skill-tree-title">
            <div class="skill-tree-eyebrow">AI Adaptive Skill Tree</div>
            <h1>Your CP Progression Map</h1>
            <p>Structured branches turn synced performance evidence into a living RPG-style learning path. Nodes unlock from prerequisites and analytics rather than static checklists.</p>
            <div class="tree-legend">
              <span style="color:#38bdf8"><i></i>Mastered</span>
              <span style="color:#818cf8"><i></i>Learning</span>
              <span style="color:#67e8f9"><i></i>AI priority</span>
              <span style="color:#fb7185"><i></i>Contest critical</span>
              <span style="color:#64748b"><i></i>Locked</span>
            </div>
          </div>
          <div class="skill-tree-stats">
            <div class="tree-stat"><span>Unlocked</span><strong id="treeUnlocked">--</strong></div>
            <div class="tree-stat"><span>Mastered</span><strong id="treeMastered">--</strong></div>
            <div class="tree-stat"><span>AI Priority</span><strong id="treePriority">--</strong></div>
            <div class="tree-stat"><span>Expected Gain</span><strong id="treeGain">--</strong></div>
          </div>
        </div>

        <section class="skill-tree-shell reveal">
          <div class="skill-tree-toolbar">
            <input id="skillTreeSearch" class="tree-search" type="search" placeholder="Search skill nodes" aria-label="Search skill nodes">
            <div class="tree-controls">
              <label class="tree-time">
                <span id="treeTimeLabel">Current</span>
                <input id="skillTreeTimeline" type="range" min="0" max="2" step="1" value="1" aria-label="Timeline">
              </label>
              <button id="treeReset" type="button">Reset View</button>
            </div>
          </div>
          <div id="skillTreeViewport" class="skill-tree-viewport">
            <svg id="skillTreeSvg" class="skill-tree-svg" viewBox="0 0 1400 760" role="img" aria-label="AI adaptive competitive programming skill tree"></svg>
          </div>
          <div id="treePreview" class="tree-preview hidden"></div>
          <aside id="treePanel" class="tree-panel hidden" aria-live="polite"></aside>
        </section>
      </section>
    `;

    Array.from({ length: 22 }).forEach((_, index) => {
      const particle = document.createElement('i');
      particle.className = 'tree-particle';
      particle.style.left = `${8 + (index * 37) % 88}%`;
      particle.style.top = `${18 + (index * 19) % 72}%`;
      particle.style.animationDelay = `${index * -0.42}s`;
      main.querySelector('.skill-tree-shell').appendChild(particle);
    });
  }

  function renderStats() {
    const unlocked = treeState.nodes.filter((node) => node.state !== 'locked').length;
    const mastered = treeState.nodes.filter((node) => node.state === 'mastered').length;
    const priority = treeState.nodes.filter((node) => ['weak', 'ai-priority', 'contest-critical'].includes(node.state)).length;
    const avgRoi = treeState.nodes.length
      ? Math.round(treeState.nodes.reduce((sum, node) => sum + node.roi, 0) / treeState.nodes.length)
      : 0;
    document.getElementById('treeUnlocked').textContent = `${unlocked}/${treeState.nodes.length}`;
    document.getElementById('treeMastered').textContent = mastered;
    document.getElementById('treePriority').textContent = priority;
    document.getElementById('treeGain').textContent = avgRoi ? `+${Math.round(avgRoi / 6)}` : '--';
  }

  function renderTree() {
    const svg = document.getElementById('skillTreeSvg');
    const { x, y, scale } = treeState.transform;
    const nodeMap = new Map(treeState.nodes.map((node) => [node.id, node]));
    const edges = treeState.edges.map((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      const unlocked = from && to && from.state !== 'locked' && to.state !== 'locked';
      return from && to
        ? `<path class="tree-edge ${unlocked ? 'unlocked' : 'locked'}" d="${edgePath(from, to, edge.type)}" style="color:${edge.type === 'cross' ? '#60a5fa' : from.color};stroke:${edge.type === 'cross' ? 'rgba(96,165,250,0.48)' : from.color}"></path>`
        : '';
    }).join('');

    const labels = BRANCHES.map((branch) => {
      const point = branchLabelPosition(branch);
      return `<text class="tree-branch-label" x="${point.x}" y="${point.y}" text-anchor="middle" style="fill:${branch.color}">${escapeHtml(branch.label)}</text>`;
    }).join('');

    const nodes = treeState.nodes.map((node) => {
      const point = svgPoint(node);
      const circumference = 2 * Math.PI * (node.radius + 6);
      const offset = circumference * (1 - node.effectiveMastery / 100);
      const state = stateLabels[node.state] || 'Unlocked';
      const isSelected = treeState.selected?.id === node.id;
      return `
        <g class="tree-node ${node.state}${isSelected ? ' is-selected' : ''}" data-id="${node.id}" tabindex="0" role="button" aria-label="${escapeHtml(`${node.name}, ${state}`)}">
          <circle class="tree-node-ring" cx="${point.x}" cy="${point.y}" r="${node.radius}" style="color:${stateColors[node.state] || node.color};stroke:${stateColors[node.state] || node.color}"></circle>
          <circle class="tree-progress" cx="${point.x}" cy="${point.y}" r="${node.radius + 6}" stroke="${stateColors[node.state] || node.color}" stroke-width="3" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
          <text x="${point.x}" y="${point.y + 5}" text-anchor="middle" fill="#e0f2fe" font-size="${node.radius > 34 ? 17 : 13}" font-weight="950">${escapeHtml(node.name.slice(0, 2).toUpperCase())}</text>
          <text class="tree-node-label" x="${point.x}" y="${point.y + node.radius + 25}" text-anchor="middle">${escapeHtml(node.name)}</text>
          <text class="tree-node-meta" x="${point.x}" y="${point.y + node.radius + 42}" text-anchor="middle">${node.mastery === null ? state : `${node.effectiveMastery}%`}</text>
        </g>
      `;
    }).join('');

    svg.innerHTML = `<g transform="translate(${x} ${y}) scale(${scale})">${edges}${labels}${nodes}</g>`;
    svg.querySelectorAll('.tree-node').forEach((element) => {
      element.addEventListener('pointerenter', showPreview);
      element.addEventListener('pointermove', movePreview);
      element.addEventListener('pointerleave', hidePreview);
      element.addEventListener('click', () => selectNode(element.dataset.id));
      element.addEventListener('dblclick', () => focusNode(element.dataset.id));
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode(element.dataset.id);
        }
      });
    });
    renderStats();
  }

  function showPreview(event) {
    const node = treeState.nodes.find((item) => item.id === event.currentTarget.dataset.id);
    if (!node) return;
    const preview = document.getElementById('treePreview');
    preview.innerHTML = `
      <strong>${escapeHtml(node.name)}</strong>
      <span>${escapeHtml(stateLabels[node.state] || 'Unlocked')} / ${escapeHtml(node.branchLabel)}</span>
      <p>${node.mastery === null
        ? 'No synced evidence yet. This node unlocks when prerequisite analytics are strong enough.'
        : `${node.effectiveMastery}% mastery, ${node.roi} ROI, ${node.confidence}% confidence from synced analytics.`}</p>
    `;
    preview.classList.remove('hidden');
    movePreview(event);
  }

  function movePreview(event) {
    const shell = document.querySelector('.skill-tree-shell').getBoundingClientRect();
    const preview = document.getElementById('treePreview');
    preview.style.left = `${event.clientX - shell.left}px`;
    preview.style.top = `${event.clientY - shell.top}px`;
  }

  function hidePreview() {
    document.getElementById('treePreview')?.classList.add('hidden');
  }

  function selectNode(id) {
    const node = treeState.nodes.find((item) => item.id === id);
    if (!node) return;
    treeState.selected = node;
    renderPanel(node);
    renderTree();
  }

  function linkedNames(node, direction) {
    const nodeMap = new Map(treeState.nodes.map((item) => [item.id, item]));
    return treeState.edges
      .filter((edge) => direction === 'in' ? edge.to === node.id : edge.from === node.id)
      .map((edge) => nodeMap.get(direction === 'in' ? edge.from : edge.to)?.name)
      .filter(Boolean);
  }

  function renderProblemBank(node) {
    const rows = node.recentSubmissions.slice(0, 10);
    if (!rows.length) {
      return '<p>No synced problem-bank entries are attached to this topic yet.</p>';
    }
    return rows.map((problem) => {
      const name = problem.problemName || problem.name || problem.title || problem.problem?.name || 'Synced problem';
      const platform = problem.platform || 'Codeforces';
      const difficulty = problem.rating || problem.difficulty || problem.problem?.rating || 'Mixed';
      const verdict = problem.verdict || problem.status || 'Synced';
      return `
        <div class="problem-row">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(platform)} / ${escapeHtml(difficulty)} / ${escapeHtml(verdict)}</span>
          </div>
          ${problem.url ? `<a class="text-sky-300 text-xs font-bold" href="${escapeHtml(problem.url)}" target="_blank" rel="noopener noreferrer">Open</a>` : '<span></span>'}
        </div>
      `;
    }).join('');
  }

  function renderPanel(node) {
    const panel = document.getElementById('treePanel');
    const prereqs = linkedNames(node, 'in');
    const unlocks = linkedNames(node, 'out');
    const hours = node.mastery === null ? '--' : Math.max(2, Math.round(node.roi / 12));
    panel.innerHTML = `
      <div class="tree-panel-header">
        <div>
          <div class="panel-state">${escapeHtml(stateLabels[node.state] || 'Unlocked')}</div>
          <h2>${escapeHtml(node.name)}</h2>
        </div>
        <button type="button" id="treePanelClose" aria-label="Close topic panel">Close</button>
      </div>
      <div class="tree-panel-grid">
        <div class="tree-panel-metric"><span>Mastery</span><strong>${node.mastery === null ? '--' : `${node.effectiveMastery}%`}</strong></div>
        <div class="tree-panel-metric"><span>Confidence</span><strong>${node.confidence || '--'}${node.confidence ? '%' : ''}</strong></div>
        <div class="tree-panel-metric"><span>Importance</span><strong>${node.size}</strong></div>
        <div class="tree-panel-metric"><span>Study Hours</span><strong>${hours}</strong></div>
        <div class="tree-panel-metric"><span>ROI</span><strong>${node.roi || '--'}</strong></div>
        <div class="tree-panel-metric"><span>Contest Usage</span><strong>${node.evidence.length}</strong></div>
      </div>
      <div class="tree-panel-section">
        <h3>AI Insight</h3>
        <p>${node.mastery === null
          ? 'This skill has not appeared in synced topic analytics yet. Its unlock status depends on adjacent prerequisites.'
          : node.mastery < 45
            ? 'This is currently a high-leverage weakness. Practicing it should improve contest stability before moving deeper.'
            : node.mastery >= 78
              ? 'This skill is strong enough to support downstream concepts and tougher contest applications.'
              : 'This skill is active but not stable yet. Short focused drills should convert it into a prerequisite anchor.'}</p>
      </div>
      <div class="tree-panel-section">
        <h3>Prerequisites</h3>
        <p>${prereqs.length ? prereqs.map(escapeHtml).join(', ') : 'Root skill'}</p>
      </div>
      <div class="tree-panel-section">
        <h3>Unlocked Topics</h3>
        <p>${unlocks.length ? unlocks.map(escapeHtml).join(', ') : 'No downstream node yet'}</p>
      </div>
      <div class="tree-panel-section">
        <h3>Problem Bank</h3>
        ${renderProblemBank(node)}
      </div>
    `;
    panel.classList.remove('hidden');
    document.getElementById('treePanelClose')?.addEventListener('click', () => panel.classList.add('hidden'));
  }

  function focusNode(id) {
    const node = treeState.nodes.find((item) => item.id === id);
    if (!node) return;
    const point = svgPoint(node);
    treeState.transform = {
      scale: 1.45,
      x: 800 - point.x * 1.45,
      y: 410 - point.y * 1.45
    };
    selectNode(id);
  }

  function resetView() {
    treeState.transform = { x: 0, y: 0, scale: 1 };
    document.getElementById('skillTreeSearch').value = '';
    treeState.selected = null;
    document.getElementById('treePanel')?.classList.add('hidden');
    renderTree();
  }

  function setupInteractions() {
    const viewport = document.getElementById('skillTreeViewport');
    const search = document.getElementById('skillTreeSearch');
    const timeline = document.getElementById('skillTreeTimeline');
    let dragging = false;
    let start = null;

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      const nextScale = Math.max(0.68, Math.min(1.85, treeState.transform.scale + (event.deltaY > 0 ? -0.08 : 0.08)));
      treeState.transform.scale = nextScale;
      renderTree();
    }, { passive: false });

    viewport.addEventListener('pointerdown', (event) => {
      dragging = true;
      start = { x: event.clientX, y: event.clientY, tx: treeState.transform.x, ty: treeState.transform.y };
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!dragging || !start) return;
      treeState.transform.x = start.tx + event.clientX - start.x;
      treeState.transform.y = start.ty + event.clientY - start.y;
      renderTree();
    });
    viewport.addEventListener('pointerup', () => {
      dragging = false;
      viewport.classList.remove('is-dragging');
    });

    search.addEventListener('input', () => {
      const query = normalize(search.value);
      if (!query) {
        treeState.selected = null;
        renderTree();
        return;
      }
      const match = treeState.nodes.find((node) => normalize(node.name).includes(query));
      if (match) focusNode(match.id);
    });

    timeline.addEventListener('input', () => {
      treeState.timeline = Number(timeline.value);
      document.getElementById('treeTimeLabel').textContent = ['Last Month', 'Current', 'Projected'][treeState.timeline] || 'Current';
      const next = buildTree(treeState.analytics);
      treeState.nodes = next.nodes;
      treeState.edges = next.edges;
      renderTree();
    });

    document.getElementById('treeReset').addEventListener('click', resetView);
  }

  async function loadAnalytics() {
    if (!window.analyticsService) return null;
    try {
      return await window.analyticsService.getCombinedAnalytics();
    } catch (error) {
      console.error('Skill tree analytics failed:', error);
      return null;
    }
  }

  async function initSkillTree() {
    const main = document.querySelector('main');
    if (!main) return;
    document.getElementById('mainApp')?.classList.remove('blur-md', 'pointer-events-none');
    renderPageShell(main);
    treeState.analytics = await loadAnalytics();
    const tree = buildTree(treeState.analytics);
    treeState.nodes = tree.nodes;
    treeState.edges = tree.edges;
    renderTree();
    setupInteractions();
    if (typeof initRevealAnimations === 'function') initRevealAnimations();
    if (typeof initializeMobileSidebar === 'function') initializeMobileSidebar();
  }

  window.addEventListener('DOMContentLoaded', initSkillTree);
})();
