import { applyTabGroups } from "../lib/group-applier.js";
import { groupTabsHeuristic } from "../lib/grouping-heuristic.js";
import { MESSAGE_TYPES } from "../lib/messages.js";
import { groupTabsWithAI } from "../lib/openai-client.js";
import { getSettings, getLastRunSummary, setLastRunSummary } from "../lib/storage.js";
import { collectTabs } from "../lib/tab-collector.js";

async function handleOrganizeNow() {
  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    return { ok: false, error: "MISSING_API_KEY" };
  }

  const tabs = await collectTabs({ includeFullUrl: settings.includeFullUrl });
  if (tabs.length === 0) {
    const emptySummary = {
      groupedTabs: 0,
      groupsCreated: 0,
      skippedTabs: 0,
      usedFallback: false,
      ranAt: Date.now()
    };
    await setLastRunSummary(emptySummary);
    return { ok: true, summary: emptySummary };
  }

  let groups;
  let usedFallback = false;
  try {
    groups = await groupTabsWithAI(tabs, settings);
    if (!Array.isArray(groups) || groups.length === 0) {
      throw new Error("AI_GROUPS_EMPTY");
    }
  } catch {
    groups = groupTabsHeuristic(tabs);
    usedFallback = true;
  }

  const applySummary = await applyTabGroups(tabs, groups);
  const summary = {
    ...applySummary,
    usedFallback,
    ranAt: Date.now()
  };
  await setLastRunSummary(summary);

  return { ok: true, summary };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE_TYPES.ORGANIZE_NOW:
        return handleOrganizeNow();
      case MESSAGE_TYPES.GET_LAST_RUN:
        return { ok: true, summary: await getLastRunSummary() };
      default:
        return { ok: false, error: "UNSUPPORTED_MESSAGE" };
    }
  })()
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error?.message ?? "UNKNOWN_ERROR"
      });
    });

  return true;
});
