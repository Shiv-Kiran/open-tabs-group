import { applyTabGroups } from "../lib/group-applier.js";
import {
  archiveAndCloseTabs,
  getArchiveById,
  pruneArchives
} from "../lib/archive-db.js";
import { buildPreviewFromTabs } from "../lib/grouping-engine.js";
import { MESSAGE_TYPES } from "../lib/messages.js";
import {
  appendRevertSnapshot,
  clearPreviewDraft,
  findRevertSnapshot,
  getLastAiMeta,
  getLastRunSummary,
  getPreviewDraft,
  getRevertHistory,
  getSettings,
  setLastAiMeta,
  setLastRunSummary,
  setPreviewDraft
} from "../lib/storage.js";
import { collectTabs } from "../lib/tab-collector.js";

const UNDO_WINDOW_MS = 10_000;
const ARCHIVE_RETENTION = 1000;
let lastUndoToken = null;

function createId(prefix) {
  const random =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function createUndoToken(archiveId) {
  return {
    tokenId: createId("undo"),
    archiveId,
    expiresAt: Date.now() + UNDO_WINDOW_MS
  };
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
    hint: typeof draft.hint === "string" ? draft.hint : "",
    aiMeta:
      draft.aiMeta && typeof draft.aiMeta === "object"
        ? {
            primaryModel: draft.aiMeta.primaryModel ?? "",
            fallbackModel: draft.aiMeta.fallbackModel ?? "",
            usedFallbackModel: Boolean(draft.aiMeta.usedFallbackModel),
            aiErrorCode:
              typeof draft.aiMeta.aiErrorCode === "string"
                ? draft.aiMeta.aiErrorCode
                : undefined
          }
        : undefined
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
    await setLastAiMeta(null);
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
  await setLastAiMeta(previewResult.aiMeta ?? null);
  const draft = sanitizePreviewDraft({
    draftId: createId("draft"),
    createdAt: Date.now(),
    tabs: previewResult.tabs,
    groups: previewResult.groups,
    excludedTabIndices: [],
    usedFallback: previewResult.usedFallback,
    enrichedContextUsed: previewResult.enrichedContextUsed,
    hint: previewResult.hint,
    aiErrorCode: previewResult.aiErrorCode,
    aiMeta: previewResult.aiMeta
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

async function handleCloseTab(tabId) {
  if (!Number.isInteger(tabId)) {
    return { ok: false, error: "INVALID_TAB_ID" };
  }

  try {
    await chrome.tabs.remove(tabId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message ?? "TAB_CLOSE_FAILED" };
  }
}

function sanitizeArchiveTabs(rawTabs) {
  if (!Array.isArray(rawTabs)) {
    return [];
  }
  return rawTabs
    .map((tab) => ({
      chromeTabId: Number.isInteger(tab?.chromeTabId) ? tab.chromeTabId : undefined,
      title: typeof tab?.title === "string" ? tab.title : "Untitled Tab",
      url: typeof tab?.url === "string" ? tab.url : undefined,
      domain: typeof tab?.domain === "string" ? tab.domain : "unknown",
      windowId: Number.isInteger(tab?.windowId) ? tab.windowId : -1,
      tabIndex: Number.isInteger(tab?.tabIndex) ? tab.tabIndex : 0
    }))
    .filter((tab) => Number.isInteger(tab.chromeTabId) || tab.url);
}

async function handleArchiveAndCloseTabs(message) {
  const tabs = sanitizeArchiveTabs(message?.tabs);
  if (tabs.length === 0) {
    return { ok: false, error: "NO_TABS_TO_ARCHIVE" };
  }

  const result = await archiveAndCloseTabs({
    reason: typeof message?.reason === "string" ? message.reason : "preview-action",
    tabs,
    draftId: typeof message?.draftId === "string" ? message.draftId : undefined,
    groupName:
      typeof message?.groupName === "string" ? message.groupName : undefined
  });
  await pruneArchives(ARCHIVE_RETENTION).catch(() => undefined);

  const undoToken = createUndoToken(result.archiveId);
  lastUndoToken = undoToken;

  return {
    ok: true,
    ...result,
    undoToken
  };
}

async function handleUndoCloseBatch(tokenId) {
  if (!lastUndoToken) {
    return { ok: false, error: "NO_UNDO_TOKEN" };
  }
  if (tokenId && tokenId !== lastUndoToken.tokenId) {
    return { ok: false, error: "UNDO_TOKEN_MISMATCH" };
  }
  if (Date.now() > lastUndoToken.expiresAt) {
    lastUndoToken = null;
    return { ok: false, error: "UNDO_TOKEN_EXPIRED" };
  }

  const archive = await getArchiveById(lastUndoToken.archiveId);
  if (!archive) {
    lastUndoToken = null;
    return { ok: false, error: "ARCHIVE_NOT_FOUND" };
  }

  let restoredTabs = 0;
  for (const tab of archive.tabs ?? []) {
    if (typeof tab?.url !== "string" || tab.url.length === 0) {
      continue;
    }
    const baseCreate = {
      url: tab.url,
      active: false
    };

    try {
      if (Number.isInteger(tab.windowId) && tab.windowId >= 0) {
        await chrome.tabs.create({
          ...baseCreate,
          windowId: tab.windowId,
          index: Number.isInteger(tab.tabIndex) ? Math.max(tab.tabIndex, 0) : undefined
        });
      } else {
        await chrome.tabs.create(baseCreate);
      }
      restoredTabs += 1;
    } catch {
      try {
        await chrome.tabs.create(baseCreate);
        restoredTabs += 1;
      } catch {
        // skip unrecoverable tab restore errors
      }
    }
  }

  const skippedTabs = (archive.tabs ?? []).length - restoredTabs;
  lastUndoToken = null;
  return {
    ok: true,
    restoredTabs,
    skippedTabs
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
      case MESSAGE_TYPES.CLOSE_TAB:
        return handleCloseTab(message?.tabId);
      case MESSAGE_TYPES.ARCHIVE_AND_CLOSE_TABS:
        return handleArchiveAndCloseTabs(message);
      case MESSAGE_TYPES.UNDO_CLOSE_BATCH:
        return handleUndoCloseBatch(message?.tokenId);
      case MESSAGE_TYPES.GET_LAST_RUN:
        return {
          ok: true,
          summary: await getLastRunSummary(),
          aiMeta: await getLastAiMeta()
        };
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
