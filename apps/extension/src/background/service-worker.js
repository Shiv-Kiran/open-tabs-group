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
  const groupedCount = previewDraft.groups.reduce(
    (count, group) => count + (group.tabIndices?.length ?? 0),
    0
  );
  return {
    groupedTabs: groupedCount,
    groupsCreated: previewDraft.groups.length,
    skippedTabs: (previewDraft.excludedTabIndices ?? []).length,
    usedFallback: previewDraft.usedFallback,
    ranAt: previewDraft.createdAt
  };
}

function sanitizePreviewDraft(draft) {
  if (!draft || !Array.isArray(draft.tabs)) {
    return null;
  }

  const tabCount = draft.tabs.length;
  const excludedSet = new Set(
    (Array.isArray(draft.excludedTabIndices) ? draft.excludedTabIndices : [])
      .filter((value) => Number.isInteger(value) && value >= 0 && value < tabCount)
  );
  const alreadyAssigned = new Set(excludedSet);

  const groups = [];
  for (const rawGroup of Array.isArray(draft.groups) ? draft.groups : []) {
    const tabIndices = [];
    for (const value of rawGroup?.tabIndices ?? []) {
      if (!Number.isInteger(value) || value < 0 || value >= tabCount) {
        continue;
      }
      if (alreadyAssigned.has(value)) {
        continue;
      }
      alreadyAssigned.add(value);
      tabIndices.push(value);
    }

    if (tabIndices.length === 0) {
      continue;
    }

    groups.push({
      id:
        typeof rawGroup?.id === "string" && rawGroup.id.length > 0
          ? rawGroup.id
          : createId("group"),
      name:
        typeof rawGroup?.name === "string" && rawGroup.name.trim().length > 0
          ? rawGroup.name.trim().slice(0, 40)
          : "Focused Group",
      tabIndices,
      confidence:
        typeof rawGroup?.confidence === "number" ? rawGroup.confidence : undefined,
      rationale:
        typeof rawGroup?.rationale === "string"
          ? rawGroup.rationale.slice(0, 160)
          : undefined,
      sampleTitles: Array.isArray(rawGroup?.sampleTitles)
        ? rawGroup.sampleTitles.slice(0, 3)
        : undefined
    });
  }

  for (let index = 0; index < tabCount; index += 1) {
    if (!alreadyAssigned.has(index)) {
      excludedSet.add(index);
    }
  }

  return {
    draftId:
      typeof draft.draftId === "string" && draft.draftId.length > 0
        ? draft.draftId
        : createId("draft"),
    createdAt:
      typeof draft.createdAt === "number" ? draft.createdAt : Date.now(),
    tabs: draft.tabs,
    groups,
    excludedTabIndices: [...excludedSet],
    usedFallback: Boolean(draft.usedFallback),
    enrichedContextUsed: Boolean(draft.enrichedContextUsed),
    hint: typeof draft.hint === "string" ? draft.hint : ""
  };
}

async function handleOrganizePreview() {
  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    return { ok: false, error: "MISSING_API_KEY" };
  }

  const tabs = await collectTabs({
    includeFullUrl: settings.includeFullUrl,
    scope: settings.organizeScope
  });
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
  const draft = sanitizePreviewDraft({
    draftId: createId("draft"),
    createdAt: Date.now(),
    tabs: previewResult.tabs,
    groups: previewResult.groups,
    excludedTabIndices: [],
    usedFallback: previewResult.usedFallback,
    enrichedContextUsed: previewResult.enrichedContextUsed,
    hint: previewResult.hint,
    aiErrorCode: previewResult.aiErrorCode
  });

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

async function handleApplyPreview(message) {
  const settings = await getSettings();
  const storedDraft = await getPreviewDraft();
  if (!storedDraft) {
    return { ok: false, error: "NO_PREVIEW_DRAFT" };
  }

  const incomingDraft =
    message?.previewDraft &&
    message.previewDraft.draftId === storedDraft.draftId
      ? message.previewDraft
      : storedDraft;

  const draft = sanitizePreviewDraft(incomingDraft);
  if (!draft) {
    return { ok: false, error: "INVALID_PREVIEW_DRAFT" };
  }

  const snapshot = await captureSnapshot(draft.tabs);
  const applySummary = await applyTabGroups(draft.tabs, draft.groups, {
    allowCrossWindowGrouping: settings.allowCrossWindowGrouping
  });
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
        return handleApplyPreview(message);
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
