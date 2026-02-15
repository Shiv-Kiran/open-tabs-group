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
  "video",
  "watch"
]);

function tokensFromTab(tab) {
  const content = [
    tab.title,
    tab.pageContext?.description,
    tab.pageContext?.snippet,
    ...(tab.pageContext?.headings ?? []),
    ...(tab.pageContext?.siteHints ?? [])
  ]
    .filter(Boolean)
    .join(" ");

  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function selectAnchorToken(tab, globalFrequency) {
  const tokens = tokensFromTab(tab);
  if (tokens.length === 0) {
    return tab.domain || "misc";
  }

  let bestToken = tokens[0];
  let bestScore = globalFrequency.get(bestToken) ?? 0;
  for (const token of tokens) {
    const score = globalFrequency.get(token) ?? 0;
    if (score > bestScore) {
      bestToken = token;
      bestScore = score;
    }
  }
  return bestToken;
}

function titleCase(value) {
  if (!value) {
    return "Focused";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Topic-first fallback grouping when AI fails.
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @returns {import("./models").GroupSuggestion[]}
 */
export function groupTabsHeuristic(tabs) {
  const tokenFrequency = new Map();
  for (const tab of tabs) {
    for (const token of tokensFromTab(tab)) {
      tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
    }
  }

  const buckets = new Map();
  tabs.forEach((tab, index) => {
    const anchor = selectAnchorToken(tab, tokenFrequency);
    const bucket = buckets.get(anchor) ?? [];
    bucket.push(index);
    buckets.set(anchor, bucket);
  });

  const groups = [...buckets.entries()].map(([anchor, tabIndices]) => ({
    name: `${titleCase(anchor)} Focus`,
    tabIndices
  }));

  return groups.sort((a, b) => b.tabIndices.length - a.tabIndices.length);
}
