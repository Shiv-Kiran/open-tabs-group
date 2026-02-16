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
  "watch",
  "official",
  "channel",
  "home",
  "page"
]);

function tokenize(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function pathTokens(url) {
  if (typeof url !== "string") {
    return [];
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname
      .split("/")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length >= 3);
  } catch {
    return [];
  }
}

function tokensFromTab(tab) {
  return new Set([
    ...tokenize(tab.title),
    ...tokenize(tab.pageContext?.description),
    ...tokenize(tab.pageContext?.snippet),
    ...tokenize((tab.pageContext?.headings ?? []).join(" ")),
    ...(tab.pageContext?.siteHints ?? []),
    ...(tab.urlPathHints ?? []),
    ...pathTokens(tab.url)
  ]);
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function scoreAgainstCluster(tabIndex, cluster, tabTokens, tabs) {
  const compareIndices = cluster.tabIndices.slice(0, 4);
  let total = 0;
  for (const index of compareIndices) {
    total += jaccard(tabTokens[tabIndex], tabTokens[index]);
  }
  const avgSimilarity =
    compareIndices.length > 0 ? total / compareIndices.length : 0;
  const domainBonus =
    tabs[tabIndex]?.domain &&
    tabs[tabIndex].domain === cluster.primaryDomain
      ? 0.06
      : 0;
  return avgSimilarity + domainBonus;
}

function titleCase(value) {
  if (!value) {
    return "Focused";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function nameFromCluster(cluster, tabTokens) {
  const frequency = new Map();
  for (const index of cluster.tabIndices) {
    for (const token of tabTokens[index]) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const [topToken] =
    [...frequency.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return `${titleCase(topToken || cluster.primaryDomain || "Focused")} Focus`;
}

function normalizeClusters(clusters, tabs, tabTokens) {
  return clusters
    .map((cluster) => ({
      name: nameFromCluster(cluster, tabTokens),
      tabIndices: [...new Set(cluster.tabIndices)].sort((a, b) => a - b)
    }))
    .filter((group) => group.tabIndices.length > 0)
    .sort((a, b) => b.tabIndices.length - a.tabIndices.length);
}

/**
 * Topic-first fallback grouping when AI fails.
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @returns {import("./models").GroupSuggestion[]}
 */
export function groupTabsHeuristic(tabs) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return [];
  }

  const tabTokens = tabs.map((tab) => tokensFromTab(tab));
  const clusters = [];

  tabs.forEach((tab, index) => {
    let bestCluster = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const score = scoreAgainstCluster(index, cluster, tabTokens, tabs);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestScore >= 0.26) {
      bestCluster.tabIndices.push(index);
    } else {
      clusters.push({
        tabIndices: [index],
        primaryDomain: tab.domain || "misc"
      });
    }
  });

  const stableClusters = [];
  const singletonClusters = [];
  for (const cluster of clusters) {
    if (cluster.tabIndices.length === 1) {
      singletonClusters.push(cluster);
    } else {
      stableClusters.push(cluster);
    }
  }

  for (const singleton of singletonClusters) {
    const [index] = singleton.tabIndices;
    let bestTarget = null;
    let bestScore = 0;
    for (const cluster of stableClusters) {
      const score = scoreAgainstCluster(index, cluster, tabTokens, tabs);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = cluster;
      }
    }
    if (bestTarget && bestScore >= 0.34) {
      bestTarget.tabIndices.push(index);
    } else {
      stableClusters.push(singleton);
    }
  }

  return normalizeClusters(stableClusters, tabs, tabTokens);
}
