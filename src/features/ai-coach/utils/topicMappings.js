const TOPIC_MAPPINGS = [
  {
    displayName: 'Binary Search',
    aliases: ['binary search', 'binary_search', 'binary-search'],
    codeforcesTag: 'binary search',
    leetcodeSlug: 'binary-search'
  },
  {
    displayName: 'Dynamic Programming',
    aliases: ['dynamic programming', 'dp', 'dynamic-programming'],
    codeforcesTag: 'dp',
    leetcodeSlug: 'dynamic-programming'
  },
  {
    displayName: 'Graphs',
    aliases: ['graph', 'graphs'],
    codeforcesTag: 'graphs',
    leetcodeSlug: 'graph'
  },
  {
    displayName: 'Trees',
    aliases: ['tree', 'trees'],
    codeforcesTag: 'trees',
    leetcodeSlug: 'tree'
  },
  {
    displayName: 'Greedy',
    aliases: ['greedy'],
    codeforcesTag: 'greedy',
    leetcodeSlug: 'greedy'
  },
  {
    displayName: 'Bit Manipulation',
    aliases: ['bit manipulation', 'bitmask', 'bitmasks', 'bit-manipulation'],
    codeforcesTag: 'bitmasks',
    leetcodeSlug: 'bit-manipulation'
  },
  {
    displayName: 'Prefix Sum',
    aliases: ['prefix sum', 'prefix sums', 'prefix-sum'],
    codeforcesTag: 'prefix sums',
    leetcodeSlug: 'prefix-sum'
  },
  {
    displayName: 'Sliding Window',
    aliases: ['sliding window', 'sliding-window'],
    codeforcesTag: 'two pointers',
    leetcodeSlug: 'sliding-window'
  },
  {
    displayName: 'Two Pointers',
    aliases: ['two pointers', 'two-pointers'],
    codeforcesTag: 'two pointers',
    leetcodeSlug: 'two-pointers'
  },
  {
    displayName: 'DFS',
    aliases: ['dfs', 'depth first search', 'depth-first-search'],
    codeforcesTag: 'dfs and similar',
    leetcodeSlug: 'depth-first-search'
  },
  {
    displayName: 'BFS',
    aliases: ['bfs', 'breadth first search', 'breadth-first-search'],
    codeforcesTag: 'bfs',
    leetcodeSlug: 'breadth-first-search'
  },
  {
    displayName: 'Implementation',
    aliases: ['implementation'],
    codeforcesTag: 'implementation',
    leetcodeSlug: null
  },
  {
    displayName: 'Math',
    aliases: ['math', 'mathematics'],
    codeforcesTag: 'math',
    leetcodeSlug: 'math'
  },
  {
    displayName: 'Strings',
    aliases: ['string', 'strings'],
    codeforcesTag: 'strings',
    leetcodeSlug: 'string'
  },
  {
    displayName: 'Sorting',
    aliases: ['sort', 'sorting'],
    codeforcesTag: 'sortings',
    leetcodeSlug: 'sorting'
  },
  {
    displayName: 'Shortest Paths',
    aliases: ['shortest paths', 'shortest path', 'dijkstra'],
    codeforcesTag: 'shortest paths',
    leetcodeSlug: 'shortest-path'
  },
  {
    displayName: 'Combinatorics',
    aliases: ['combinatorics'],
    codeforcesTag: 'combinatorics',
    leetcodeSlug: 'combinatorics'
  },
  {
    displayName: 'Number Theory',
    aliases: ['number theory', 'number-theory'],
    codeforcesTag: 'number theory',
    leetcodeSlug: 'number-theory'
  },
  {
    displayName: 'Data Structures',
    aliases: ['data structures', 'data-structures'],
    codeforcesTag: 'data structures',
    leetcodeSlug: 'data-structure'
  },
  {
    displayName: 'Segment Trees',
    aliases: ['segment tree', 'segment trees', 'segment-tree'],
    codeforcesTag: 'data structures',
    leetcodeSlug: 'segment-tree'
  }
];

function topicKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

const TOPIC_INDEX = TOPIC_MAPPINGS.reduce((index, mapping) => {
  index.set(topicKey(mapping.displayName), mapping);
  mapping.aliases.forEach((alias) => index.set(topicKey(alias), mapping));
  return index;
}, new Map());

function titleCaseFallback(value) {
  const text = String(value || '').replace(/[_-]/g, ' ').trim();
  if (!text) return 'General Practice';
  return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function fallbackSearchTerm(topic) {
  return topicKey(topic).replace(/\s+/g, '+');
}

export function resolveTopicMapping(topic) {
  const mapping = TOPIC_INDEX.get(topicKey(topic));
  if (mapping) return mapping;
  const displayName = titleCaseFallback(topic);
  return {
    displayName,
    aliases: [],
    codeforcesTag: null,
    leetcodeSlug: null
  };
}

export function normalizeTopicDisplayName(topic) {
  return resolveTopicMapping(topic).displayName;
}

export function buildTopicPracticeUrl(platform, topic) {
  const mapping = resolveTopicMapping(topic);
  if (platform === 'LeetCode') {
    if (mapping.leetcodeSlug) return `https://leetcode.com/problem-list/${mapping.leetcodeSlug}/`;
    return `https://leetcode.com/problemset/?search=${fallbackSearchTerm(mapping.displayName)}`;
  }

  if (platform === 'CodeChef') {
    return `https://www.codechef.com/practice?search=${fallbackSearchTerm(mapping.displayName)}`;
  }

  if (mapping.codeforcesTag) {
    return `https://codeforces.com/problemset?tags=${encodeURIComponent(mapping.codeforcesTag).replace(/%20/g, '+')}`;
  }
  return `https://codeforces.com/problemset?tags=${fallbackSearchTerm(mapping.displayName)}`;
}

export const topicMappings = Object.freeze(TOPIC_MAPPINGS.map((mapping) => Object.freeze({ ...mapping })));
