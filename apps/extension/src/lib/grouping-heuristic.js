const STOP_WORDS = new Set([
  "with",
  "from",
  "about",
  "that",
  "this",
  "when",
  "where",
  "which",
  "what",
  "your",
  "have",
  "will",
  "just",
  "into",
  "using",
  "guide",
  "best",
  "2024",
  "2025",
  "2026"
]);

function titleTokens(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function prettyToken(token) {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function domainLabel(domain) {
  const cleaned = domain.replace(/\.[a-z]+$/, "");
  const base = cleaned.split(".").pop() || cleaned;
  return prettyToken(base);
}

function createDomainGroups(tabs, assigned) {
  const domainBuckets = new Map();

  tabs.forEach((tab, index) => {
    if (assigned.has(index)) {
      return;
    }
    const bucket = domainBuckets.get(tab.domain) ?? [];
    bucket.push(index);
    domainBuckets.set(tab.domain, bucket);
  });

  const groups = [];
  for (const [domain, indices] of domainBuckets.entries()) {
    if (indices.length < 2) {
      continue;
    }
    indices.forEach((index) => assigned.add(index));
    groups.push({
      name: `${domainLabel(domain)} Work`,
      tabIndices: indices
    });
  }

  return groups;
}

function createKeywordGroups(tabs, assigned) {
  const tokenFrequency = new Map();
  const indexToTokens = new Map();

  tabs.forEach((tab, index) => {
    if (assigned.has(index)) {
      return;
    }
    const tokens = titleTokens(tab.title);
    indexToTokens.set(index, tokens);
    for (const token of tokens) {
      tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
    }
  });

  const keywordBuckets = new Map();

  for (const [index, tokens] of indexToTokens.entries()) {
    if (tokens.length === 0) {
      continue;
    }

    let topToken = tokens[0];
    let bestScore = tokenFrequency.get(topToken) ?? 0;
    for (const token of tokens) {
      const score = tokenFrequency.get(token) ?? 0;
      if (score > bestScore) {
        topToken = token;
        bestScore = score;
      }
    }

    if (bestScore < 2) {
      continue;
    }

    const bucket = keywordBuckets.get(topToken) ?? [];
    bucket.push(index);
    keywordBuckets.set(topToken, bucket);
  }

  const groups = [];
  for (const [token, indices] of keywordBuckets.entries()) {
    if (indices.length < 2) {
      continue;
    }
    indices.forEach((index) => assigned.add(index));
    groups.push({
      name: `${prettyToken(token)} Notes`,
      tabIndices: indices
    });
  }

  return groups;
}

function createSingletonGroups(tabs, assigned) {
  const groups = [];

  tabs.forEach((tab, index) => {
    if (assigned.has(index)) {
      return;
    }
    assigned.add(index);
    groups.push({
      name: `${domainLabel(tab.domain)} Tab`,
      tabIndices: [index]
    });
  });

  return groups;
}

/**
 * Lightweight fallback grouping when AI fails.
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @returns {import("./models").GroupSuggestion[]}
 */
export function groupTabsHeuristic(tabs) {
  const assigned = new Set();

  const domainGroups = createDomainGroups(tabs, assigned);
  const keywordGroups = createKeywordGroups(tabs, assigned);
  const singletonGroups = createSingletonGroups(tabs, assigned);

  return [...domainGroups, ...keywordGroups, ...singletonGroups];
}
