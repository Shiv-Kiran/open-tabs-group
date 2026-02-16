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

const GENERIC_GROUP_NAMES = /\b(group|tabs|misc|other|random|stuff)\b/i;

function tokenize(text) {
  if (!text || typeof text !== "string") {
    return [];
  }
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function setFromTab(tab) {
  const tokens = new Set([
    ...tokenize(tab.title),
    ...tokenize(tab.pageContext?.description ?? ""),
    ...tokenize(tab.pageContext?.snippet ?? ""),
    ...tokenize((tab.pageContext?.headings ?? []).join(" ")),
    ...(tab.pageContext?.siteHints ?? []),
    ...(tab.urlPathHints ?? [])
  ]);
  return tokens;
}

function similarity(tabA, tabB) {
  const tokensA = setFromTab(tabA);
  const tokensB = setFromTab(tabB);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

function averageGroupSimilarity(indices, tabs) {
  if (indices.length <= 1) {
    return 1;
  }
  let score = 0;
  let pairs = 0;
  for (let i = 0; i < indices.length; i += 1) {
    for (let j = i + 1; j < indices.length; j += 1) {
      score += similarity(tabs[indices[i]], tabs[indices[j]]);
      pairs += 1;
    }
  }
  return pairs > 0 ? score / pairs : 0;
}

function dominantDomainRatio(indices, tabs) {
  if (indices.length === 0) {
    return 0;
  }
  const counts = new Map();
  for (const index of indices) {
    const domain = tabs[index]?.domain ?? "unknown";
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  let max = 0;
  for (const count of counts.values()) {
    max = Math.max(max, count);
  }
  return max / indices.length;
}

function groupTokenFrequency(indices, tabs) {
  const frequency = new Map();
  for (const index of indices) {
    for (const token of setFromTab(tabs[index])) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return frequency;
}

function groupByDominantToken(indices, tabs) {
  const buckets = new Map();
  const frequency = groupTokenFrequency(indices, tabs);
  const candidateTokens = [...frequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([token]) => token);

  for (const index of indices) {
    const tab = tabs[index];
    if (!tab) {
      continue;
    }
    const tabTokens = setFromTab(tab);
    let bestToken = "";
    let bestScore = 0;
    for (const token of candidateTokens) {
      if (!tabTokens.has(token)) {
        continue;
      }
      const score = frequency.get(token) ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestToken = token;
      }
    }
    const key = bestToken || tab.domain || "misc";
    const bucket = buckets.get(key) ?? [];
    bucket.push(index);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].map(([token, tabIndices]) => ({ token, tabIndices }));
}

function preferredGroupName(group, tabs) {
  if (!GENERIC_GROUP_NAMES.test(group.name)) {
    return group.name;
  }

  const frequency = new Map();
  for (const index of group.tabIndices) {
    const tab = tabs[index];
    if (!tab) {
      continue;
    }
    for (const token of setFromTab(tab)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const [topToken] =
    [...frequency.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (topToken) {
    return `${topToken.charAt(0).toUpperCase()}${topToken.slice(1)} Focus`;
  }
  return "Focused Group";
}

function ensureUniqueCoverage(groups, tabCount) {
  const used = new Set();
  const normalized = [];

  for (const group of groups) {
    const unique = [];
    for (const index of group.tabIndices ?? []) {
      if (!Number.isInteger(index) || index < 0 || index >= tabCount) {
        continue;
      }
      if (used.has(index)) {
        continue;
      }
      used.add(index);
      unique.push(index);
    }
    if (unique.length > 0) {
      normalized.push({ ...group, tabIndices: unique });
    }
  }

  for (let index = 0; index < tabCount; index += 1) {
    if (!used.has(index)) {
      normalized.push({
        name: "Ungrouped Focus",
        tabIndices: [index]
      });
    }
  }

  return normalized;
}

function splitOversizedOrWeakGroups(groups, tabs) {
  const nextGroups = [];
  for (const group of groups) {
    const similarityScore = averageGroupSimilarity(group.tabIndices, tabs);
    const domainHeavy =
      group.tabIndices.length >= 5 &&
      dominantDomainRatio(group.tabIndices, tabs) >= 0.65;
    const tooLarge = group.tabIndices.length > 9;
    const lowCohesion = similarityScore < 0.16 && group.tabIndices.length >= 3;
    const lowConfidence =
      typeof group.confidence === "number" && group.confidence < 0.62;
    if (!tooLarge && !lowCohesion && !domainHeavy && !lowConfidence) {
      nextGroups.push(group);
      continue;
    }

    const buckets = groupByDominantToken(group.tabIndices, tabs);
    if (buckets.length <= 1) {
      nextGroups.push(group);
      continue;
    }

    for (const bucket of buckets) {
      nextGroups.push({
        ...group,
        name: `${preferredGroupName(group, tabs)} ${bucket.token}`.slice(0, 40),
        tabIndices: bucket.tabIndices
      });
    }
  }
  return nextGroups;
}

function mergeTinyGroups(groups, tabs) {
  const stable = [];
  const tiny = [];
  for (const group of groups) {
    if (group.tabIndices.length <= 1) {
      tiny.push(group);
    } else {
      stable.push(group);
    }
  }

  for (const candidate of tiny) {
    let bestTarget = null;
    let bestScore = 0;
    for (const target of stable) {
      const score = similarity(
        tabs[candidate.tabIndices[0]],
        tabs[target.tabIndices[0]]
      );
      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }
    if (bestTarget && bestScore >= 0.22) {
      bestTarget.tabIndices.push(...candidate.tabIndices);
    } else {
      stable.push(candidate);
    }
  }

  return stable;
}

/**
 * Quality guardrails for AI/heuristic groups.
 * @param {import("./models").GroupSuggestion[]} groups
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @returns {import("./models").GroupSuggestion[]}
 */
export function postProcessGroups(groups, tabs) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return [];
  }

  const uniqueCoverage = ensureUniqueCoverage(groups, tabs.length).map((group) => ({
    ...group,
    name: preferredGroupName(group, tabs)
  }));
  const splitGroups = splitOversizedOrWeakGroups(uniqueCoverage, tabs);
  const mergedGroups = mergeTinyGroups(splitGroups, tabs);

  return mergedGroups.map((group, index) => ({
    ...group,
    name: (group.name || `Group ${index + 1}`).slice(0, 40),
    tabIndices: [...new Set(group.tabIndices)]
  }));
}
