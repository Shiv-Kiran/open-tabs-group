import { applyTabGroups } from "../lib/group-applier.js";
import { buildPreviewFromTabs } from "../lib/grouping-engine.js";
import { MESSAGE_TYPES } from "../lib/messages.js";
import {
  appendRevertSnapshot,
  clearPreviewDraft,
  findRevertSnapshot,
  getLastRunSummary,
  getPreviewDraft,
  getRevertHistory,
  getSettings,
  setLastRunSummary,
  setPreviewDraft
} from "../lib/storage.js";
import { collectTabs } from "../lib/tab-collector.js";

function createId(prefix) {
  const random =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function summarizePreview(previewDraft) {
  return {
    groupedTabs: previewDraft.tabs.length,
    groupsCreated: previewDraft.groups.length,
    skippedTabs: 0,
    usedFallback: previewDraft.usedFallback,
    ranAt: previewDraft.createdAt
  };
}

async function handleOrganizePreview() {
  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    return { ok: false, error: "MISSING_API_KEY" };
  }

  const tabs = await collectTabs({ includeFullUrl: settings.includeFullUrl });
  if (tabs.length === 0) {
    await clearPreviewDraft();
    const emptySummary = {
      groupedTabs: 0,
      groupsCreated: 0,
      skippedTabs: 0,
      usedFallback: false,
      ranAt: Date.now()
    };
    await setLastRunSummary(emptySummary);
    return { ok: true, preview: null, summary: emptySummary };
  }

  const previewResult = await buildPreviewFromTabs(tabs, settings);
  const draft = {
    draftId: createId("draft"),
    createdAt: Date.now(),
    tabs: previewResult.tabs,
    groups: previewResult.groups,
    usedFallback: previewResult.usedFallback,
    enrichedContextUsed: previewResult.enrichedContextUsed,
    hint: previewResult.hint
  };

  await setPreviewDraft(draft);
  return {
    ok: true,
    preview: draft,
    summary: summarizePreview(draft)
  };
}

async function captureSnapshot(tabs) {
  const currentTabs = await chrome.tabs.query({});
  const tabLookup = new Map(
    currentTabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => [tab.id, tab])
  );

  const snapshotTabs = tabs
    .map((tab) => tabLookup.get(tab.chromeTabId))
    .filter(Boolean)
    .map((tab) => ({
      chromeTabId: tab.id,
      priorGroupId:
        Number.isInteger(tab.groupId) && tab.groupId >= 0 ? tab.groupId : null
    }));

  const groupedByOldGroup = new Map();
  for (const snapshotTab of snapshotTabs) {
    if (!Number.isInteger(snapshotTab.priorGroupId)) {
      continue;
    }
    const list = groupedByOldGroup.get(snapshotTab.priorGroupId) ?? [];
    list.push(snapshotTab.chromeTabId);
    groupedByOldGroup.set(snapshotTab.priorGroupId, list);
  }

  const priorGroups = [];
  for (const [oldGroupId, tabIds] of groupedByOldGroup.entries()) {
    try {
      const metadata = await chrome.tabGroups.get(oldGroupId);
      priorGroups.push({
        oldGroupId,
        title: metadata.title ?? "",
        color: metadata.color ?? "grey",
        tabIds
      });
    } catch {
      priorGroups.push({
        oldGroupId,
        title: "",
        color: "grey",
        tabIds
      });
    }
  }

  return {
    snapshotId: createId("snapshot"),
    createdAt: Date.now(),
    tabs: snapshotTabs,
    priorGroups,
    summary: {
      groupedTabs: snapshotTabs.length,
      groupsCreated: priorGroups.length
    }
  };
}

async function handleApplyPreview() {
  const draft = await getPreviewDraft();
  if (!draft) {
    return { ok: false, error: "NO_PREVIEW_DRAFT" };
  }

  const snapshot = await captureSnapshot(draft.tabs);
  const applySummary = await applyTabGroups(draft.tabs, draft.groups);
  snapshot.summary = {
    groupedTabs: applySummary.groupedTabs,
    groupsCreated: applySummary.groupsCreated
  };
  await appendRevertSnapshot(snapshot);

  const summary = {
    ...applySummary,
    usedFallback: draft.usedFallback,
    ranAt: Date.now()
  };
  await setLastRunSummary(summary);
  await clearPreviewDraft();

  return {
    ok: true,
    summary
  };
}

async function handleRevertRun(snapshotId) {
  if (!snapshotId) {
    return { ok: false, error: "MISSING_SNAPSHOT_ID" };
  }

  const snapshot = await findRevertSnapshot(snapshotId);
  if (!snapshot) {
    return { ok: false, error: "SNAPSHOT_NOT_FOUND" };
  }

  const currentTabs = await chrome.tabs.query({});
  const currentTabMap = new Map(
    currentTabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => [tab.id, tab])
  );
  const openTabIds = new Set(
    currentTabs.filter((tab) => Number.isInteger(tab.id)).map((tab) => tab.id)
  );

  const restoreTabIds = snapshot.tabs
    .map((tab) => tab.chromeTabId)
    .filter((tabId) => openTabIds.has(tabId));

  if (restoreTabIds.length === 0) {
    return { ok: false, error: "NO_OPEN_TABS_FROM_SNAPSHOT" };
  }

  const groupedRestoreIds = snapshot.tabs
    .map((tab) => tab.chromeTabId)
    .filter((tabId) => {
      const currentTab = currentTabMap.get(tabId);
      return Number.isInteger(currentTab?.groupId) && currentTab.groupId >= 0;
    });

  if (groupedRestoreIds.length > 0) {
    await chrome.tabs.ungroup(groupedRestoreIds);
  }

  let restoredGroups = 0;
  for (const priorGroup of snapshot.priorGroups) {
    const validTabIds = priorGroup.tabIds.filter((tabId) => openTabIds.has(tabId));
    if (validTabIds.length === 0) {
      continue;
    }

    const groupId = await chrome.tabs.group({ tabIds: validTabIds });
    await chrome.tabGroups.update(groupId, {
      title: (priorGroup.title ?? "").slice(0, 40),
      color: priorGroup.color ?? "grey"
    });
    restoredGroups += 1;
  }

  const result = {
    groupedTabs: restoreTabIds.length,
    groupsCreated: restoredGroups,
    skippedTabs: snapshot.tabs.length - restoreTabIds.length,
    usedFallback: false,
    ranAt: Date.now()
  };
  await setLastRunSummary(result);
  await clearPreviewDraft();

  return { ok: true, summary: result };
}

async function handleListRevertHistory() {
  const snapshots = await getRevertHistory();
  return {
    ok: true,
    history: snapshots.map((entry) => ({
      snapshotId: entry.snapshotId,
      createdAt: entry.createdAt,
      groupedTabs: entry.summary?.groupedTabs ?? 0,
      groupsCreated: entry.summary?.groupsCreated ?? 0
    }))
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE_TYPES.ORGANIZE_NOW:
      case MESSAGE_TYPES.ORGANIZE_PREVIEW:
        return handleOrganizePreview();
      case MESSAGE_TYPES.GET_PREVIEW:
        return { ok: true, preview: await getPreviewDraft() };
      case MESSAGE_TYPES.APPLY_PREVIEW:
        return handleApplyPreview();
      case MESSAGE_TYPES.DISCARD_PREVIEW:
        await clearPreviewDraft();
        return { ok: true };
      case MESSAGE_TYPES.LIST_REVERT_HISTORY:
        return handleListRevertHistory();
      case MESSAGE_TYPES.REVERT_RUN:
        return handleRevertRun(message?.snapshotId);
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
