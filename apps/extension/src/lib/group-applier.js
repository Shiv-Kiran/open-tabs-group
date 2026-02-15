const GROUP_COLORS = [
  "orange",
  "blue",
  "green",
  "yellow",
  "purple",
  "pink",
  "cyan",
  "grey",
  "red"
];

function colorForGroup(index) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

function sanitizeIndices(tabIndices, tabCount, alreadyGrouped) {
  const unique = [];
  for (const tabIndex of tabIndices) {
    if (!Number.isInteger(tabIndex)) {
      continue;
    }
    if (tabIndex < 0 || tabIndex >= tabCount) {
      continue;
    }
    if (alreadyGrouped.has(tabIndex)) {
      continue;
    }
    alreadyGrouped.add(tabIndex);
    unique.push(tabIndex);
  }
  return unique;
}

/**
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @param {import("./models").GroupSuggestion[]} suggestions
 * @returns {Promise<import("./models").ApplySummary>}
 */
export async function applyTabGroups(tabs, suggestions) {
  if (!Array.isArray(tabs) || !Array.isArray(suggestions) || tabs.length === 0) {
    return {
      groupedTabs: 0,
      groupsCreated: 0,
      skippedTabs: Array.isArray(tabs) ? tabs.length : 0
    };
  }

  const groupedIndices = new Set();
  let groupsCreated = 0;

  for (const suggestion of suggestions) {
    if (!Array.isArray(suggestion?.tabIndices)) {
      continue;
    }

    const validIndices = sanitizeIndices(
      suggestion.tabIndices,
      tabs.length,
      groupedIndices
    );
    if (validIndices.length === 0) {
      continue;
    }

    const tabIds = validIndices
      .map((index) => tabs[index]?.chromeTabId)
      .filter((tabId) => Number.isInteger(tabId));
    if (tabIds.length === 0) {
      continue;
    }
    const groupId = await chrome.tabs.group({ tabIds });

    await chrome.tabGroups.update(groupId, {
      title: suggestion.name.slice(0, 40),
      color: colorForGroup(groupsCreated)
    });

    groupsCreated += 1;
  }

  return {
    groupedTabs: groupedIndices.size,
    groupsCreated,
    skippedTabs: tabs.length - groupedIndices.size
  };
}
