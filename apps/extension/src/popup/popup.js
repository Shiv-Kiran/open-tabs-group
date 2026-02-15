import { MESSAGE_TYPES } from "../lib/messages.js";

const organizeBtn = document.getElementById("organizeBtn");
const applyPreviewBtn = document.getElementById("applyPreviewBtn");
const regeneratePreviewBtn = document.getElementById("regeneratePreviewBtn");
const cancelPreviewBtn = document.getElementById("cancelPreviewBtn");
const clearGroupsBtn = document.getElementById("clearGroupsBtn");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const revertBtn = document.getElementById("revertBtn");
const revertSelect = document.getElementById("revertSelect");

const statusText = document.getElementById("statusText");
const hintText = document.getElementById("hintText");
const summaryText = document.getElementById("summaryText");

const previewSection = document.getElementById("previewSection");
const previewMetaText = document.getElementById("previewMetaText");
const previewGroups = document.getElementById("previewGroups");
const excludedSection = document.getElementById("excludedSection");
const excludedTabs = document.getElementById("excludedTabs");

let previewState = null;
const collapsedGroupIds = new Set();
let includeScrapedContextSetting = true;

function setStatus(message, tone = "neutral") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function setHint(message = "") {
  if (!message) {
    hintText.hidden = true;
    hintText.textContent = "";
    return;
  }
  hintText.hidden = false;
  hintText.textContent = message;
}

function setSummary(summary) {
  if (!summary) {
    summaryText.textContent = "No runs yet.";
    return;
  }

  const runDate =
    typeof summary.ranAt === "number"
      ? new Date(summary.ranAt).toLocaleString()
      : "Unknown";
  summaryText.textContent = `${summary.groupedTabs ?? 0} tabs, ${
    summary.groupsCreated ?? 0
  } groups, ${summary.skippedTabs ?? 0} skipped. Last run: ${runDate}.`;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function setBusyState(isBusy) {
  organizeBtn.disabled = isBusy;
  applyPreviewBtn.disabled = isBusy;
  regeneratePreviewBtn.disabled = isBusy;
  cancelPreviewBtn.disabled = isBusy;
  clearGroupsBtn.disabled = isBusy;
  revertBtn.disabled = isBusy;
}

async function loadClientSettings() {
  const values = await chrome.storage.local.get(["settings.includeScrapedContext"]);
  includeScrapedContextSetting =
    values["settings.includeScrapedContext"] ?? true;
}

async function requestSiteAccessIfNeeded() {
  if (!includeScrapedContextSetting) {
    return { granted: true, attempted: false };
  }

  const permissions = { origins: ["https://*/*", "http://*/*"] };
  try {
    // This must run directly from popup user action context.
    const granted = await chrome.permissions.request(permissions);
    return { granted, attempted: true };
  } catch (error) {
    return {
      granted: false,
      attempted: true,
      error: error?.message ?? "PERMISSION_REQUEST_FAILED"
    };
  }
}

function normalizePreview(preview) {
  if (!preview || !Array.isArray(preview.tabs)) {
    return null;
  }

  const tabCount = preview.tabs.length;
  const used = new Set();
  const groups = [];

  for (const group of Array.isArray(preview.groups) ? preview.groups : []) {
    const tabIndices = [];
    for (const index of group.tabIndices ?? []) {
      if (!Number.isInteger(index) || index < 0 || index >= tabCount) {
        continue;
      }
      if (used.has(index)) {
        continue;
      }
      used.add(index);
      tabIndices.push(index);
    }
    if (tabIndices.length === 0) {
      continue;
    }
    groups.push({
      id: group.id || `group_${groups.length + 1}`,
      name: group.name || `Group ${groups.length + 1}`,
      tabIndices,
      confidence: group.confidence,
      rationale: group.rationale
    });
  }

  const excluded = new Set(
    (preview.excludedTabIndices ?? []).filter(
      (index) => Number.isInteger(index) && index >= 0 && index < tabCount
    )
  );
  for (let index = 0; index < tabCount; index += 1) {
    if (!used.has(index)) {
      excluded.add(index);
    }
  }

  return {
    draftId: preview.draftId,
    createdAt: preview.createdAt,
    tabs: preview.tabs,
    groups,
    excludedTabIndices: [...excluded],
    usedFallback: Boolean(preview.usedFallback),
    enrichedContextUsed: Boolean(preview.enrichedContextUsed),
    hint: preview.hint || ""
  };
}

function getTabLabel(tab) {
  return `${tab.title} (${tab.domain})`;
}

function createTabItem(tabIndex, sourceGroupId) {
  const tab = previewState.tabs[tabIndex];
  const item = document.createElement("li");
  item.className = "tab-item";
  item.draggable = true;
  item.dataset.tabIndex = String(tabIndex);
  item.dataset.sourceGroupId = sourceGroupId;

  const label = document.createElement("span");
  label.className = "tab-label";
  label.textContent = getTabLabel(tab);
  item.appendChild(label);

  const actions = document.createElement("div");
  actions.className = "tab-actions";

  const excludeBtn = document.createElement("button");
  excludeBtn.type = "button";
  excludeBtn.dataset.action = "exclude-tab";
  excludeBtn.dataset.tabIndex = String(tabIndex);
  excludeBtn.textContent = "Exclude";
  actions.appendChild(excludeBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.dataset.action = "close-tab";
  closeBtn.dataset.tabIndex = String(tabIndex);
  closeBtn.textContent = "Close";
  actions.appendChild(closeBtn);

  item.appendChild(actions);
  return item;
}

function renderPreview() {
  if (!previewState) {
    previewSection.hidden = true;
    previewGroups.innerHTML = "";
    excludedSection.hidden = true;
    excludedTabs.innerHTML = "";
    previewMetaText.textContent = "";
    return;
  }

  previewSection.hidden = false;
  previewGroups.innerHTML = "";
  const groupedCount = previewState.groups.reduce(
    (count, group) => count + group.tabIndices.length,
    0
  );
  previewMetaText.textContent = `${groupedCount} grouped, ${
    previewState.excludedTabIndices.length
  } excluded`;

  for (const group of previewState.groups) {
    const groupCard = document.createElement("article");
    groupCard.className = "preview-card";
    groupCard.dataset.groupId = group.id;

    const header = document.createElement("div");
    header.className = "group-header";

    const nameInput = document.createElement("input");
    nameInput.className = "group-name-input";
    nameInput.type = "text";
    nameInput.value = group.name;
    nameInput.dataset.groupId = group.id;
    nameInput.dataset.action = "rename-group";
    header.appendChild(nameInput);

    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = `${group.tabIndices.length} tabs`;
    header.appendChild(count);

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.dataset.action = "toggle-collapse";
    collapseBtn.dataset.groupId = group.id;
    collapseBtn.textContent = collapsedGroupIds.has(group.id) ? "Expand" : "Collapse";
    header.appendChild(collapseBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.dataset.action = "delete-group";
    deleteBtn.dataset.groupId = group.id;
    deleteBtn.textContent = "Delete Group";
    header.appendChild(deleteBtn);
    groupCard.appendChild(header);

    if (group.rationale) {
      const rationale = document.createElement("p");
      rationale.className = "preview-rationale";
      rationale.textContent = group.rationale;
      groupCard.appendChild(rationale);
    }

    const list = document.createElement("ul");
    list.className = "tab-list dropzone";
    list.dataset.dropTarget = "group";
    list.dataset.groupId = group.id;
    if (collapsedGroupIds.has(group.id)) {
      list.hidden = true;
    }

    for (const tabIndex of group.tabIndices) {
      list.appendChild(createTabItem(tabIndex, group.id));
    }

    groupCard.appendChild(list);
    previewGroups.appendChild(groupCard);
  }

  excludedTabs.innerHTML = "";
  for (const tabIndex of previewState.excludedTabIndices) {
    excludedTabs.appendChild(createTabItem(tabIndex, "excluded"));
  }
  excludedSection.hidden = previewState.excludedTabIndices.length === 0;
}

function removeTabEverywhere(tabIndex) {
  previewState.groups.forEach((group) => {
    group.tabIndices = group.tabIndices.filter((value) => value !== tabIndex);
  });
  previewState.groups = previewState.groups.filter((group) => group.tabIndices.length > 0);
  previewState.excludedTabIndices = previewState.excludedTabIndices.filter(
    (value) => value !== tabIndex
  );
}

function moveTabToGroup(tabIndex, targetGroupId) {
  if (!previewState) {
    return;
  }
  removeTabEverywhere(tabIndex);

  if (targetGroupId === "excluded") {
    previewState.excludedTabIndices.push(tabIndex);
  } else {
    const targetGroup = previewState.groups.find((group) => group.id === targetGroupId);
    if (targetGroup) {
      targetGroup.tabIndices.push(tabIndex);
    } else {
      previewState.excludedTabIndices.push(tabIndex);
    }
  }
  renderPreview();
}

function deleteGroup(groupId) {
  const group = previewState.groups.find((value) => value.id === groupId);
  if (!group) {
    return;
  }
  for (const tabIndex of group.tabIndices) {
    if (!previewState.excludedTabIndices.includes(tabIndex)) {
      previewState.excludedTabIndices.push(tabIndex);
    }
  }
  previewState.groups = previewState.groups.filter((value) => value.id !== groupId);
  collapsedGroupIds.delete(groupId);
  renderPreview();
}

function clearAllGroups() {
  for (const group of previewState.groups) {
    for (const tabIndex of group.tabIndices) {
      if (!previewState.excludedTabIndices.includes(tabIndex)) {
        previewState.excludedTabIndices.push(tabIndex);
      }
    }
  }
  previewState.groups = [];
  collapsedGroupIds.clear();
  renderPreview();
}

function getApplyPayload() {
  return {
    draftId: previewState.draftId,
    createdAt: previewState.createdAt,
    tabs: previewState.tabs,
    groups: previewState.groups,
    excludedTabIndices: previewState.excludedTabIndices,
    usedFallback: previewState.usedFallback,
    enrichedContextUsed: previewState.enrichedContextUsed,
    hint: previewState.hint
  };
}

async function refreshRevertHistory() {
  const response = await sendMessage({ type: MESSAGE_TYPES.LIST_REVERT_HISTORY });
  if (!response?.ok) {
    revertSelect.innerHTML = "<option value=\"\">No revert history</option>";
    return;
  }

  const history = response.history ?? [];
  if (history.length === 0) {
    revertSelect.innerHTML = "<option value=\"\">No revert history</option>";
    return;
  }

  revertSelect.innerHTML = "";
  for (const entry of history) {
    const option = document.createElement("option");
    const date = new Date(entry.createdAt).toLocaleString();
    option.value = entry.snapshotId;
    option.textContent = `${date} - ${entry.groupedTabs} tabs / ${entry.groupsCreated} groups`;
    revertSelect.appendChild(option);
  }
}

async function loadPreview() {
  const response = await sendMessage({ type: MESSAGE_TYPES.GET_PREVIEW });
  previewState = normalizePreview(response?.ok ? response.preview : null);
  renderPreview();
}

async function generatePreview() {
  setBusyState(true);
  setStatus("Generating preview...", "loading");
  setHint("");

  try {
    const permissionState = await requestSiteAccessIfNeeded();
    if (!permissionState.granted && includeScrapedContextSetting) {
      setHint("Site access not granted. Using title/URL-only preview context.");
    }

    const response = await sendMessage({ type: MESSAGE_TYPES.ORGANIZE_PREVIEW });
    if (!response?.ok) {
      if (response?.error === "MISSING_API_KEY") {
        setStatus("Missing API key.", "error");
        setHint("Open Settings and add your OpenAI API key.");
      } else {
        setStatus(`Preview failed: ${response?.error ?? "Unknown error"}`, "error");
      }
      return;
    }

    previewState = normalizePreview(response.preview);
    renderPreview();
    setSummary(response.summary);
    if (previewState?.usedFallback) {
      setStatus("Preview ready (fallback mode).", "warning");
    } else {
      setStatus("Preview ready. Edit and apply.", "success");
    }
    if (previewState?.hint) {
      setHint(previewState.hint);
    }
  } finally {
    setBusyState(false);
  }
}

async function applyPreview() {
  if (!previewState) {
    setStatus("No preview to apply.", "error");
    return;
  }

  setBusyState(true);
  setStatus("Applying groups...", "loading");

  try {
    const response = await sendMessage({
      type: MESSAGE_TYPES.APPLY_PREVIEW,
      previewDraft: getApplyPayload()
    });
    if (!response?.ok) {
      setStatus(`Apply failed: ${response?.error ?? "Unknown error"}`, "error");
      return;
    }

    previewState = null;
    renderPreview();
    setSummary(response.summary);
    setStatus("Groups applied.", "success");
    await refreshRevertHistory();
  } finally {
    setBusyState(false);
  }
}

async function cancelPreview() {
  setBusyState(true);
  try {
    await sendMessage({ type: MESSAGE_TYPES.DISCARD_PREVIEW });
    previewState = null;
    renderPreview();
    setStatus("Preview discarded.", "neutral");
  } finally {
    setBusyState(false);
  }
}

async function revertSelected() {
  const snapshotId = revertSelect.value;
  if (!snapshotId) {
    setStatus("No revert point selected.", "error");
    return;
  }

  setBusyState(true);
  setStatus("Reverting...", "loading");
  try {
    const response = await sendMessage({
      type: MESSAGE_TYPES.REVERT_RUN,
      snapshotId
    });
    if (!response?.ok) {
      setStatus(`Revert failed: ${response?.error ?? "Unknown error"}`, "error");
      return;
    }
    setSummary(response.summary);
    setStatus("Revert complete.", "success");
    await refreshRevertHistory();
    await loadPreview();
  } finally {
    setBusyState(false);
  }
}

async function closeTabAndRefresh(tabIndex) {
  const tab = previewState?.tabs?.[tabIndex];
  if (!tab || !Number.isInteger(tab.chromeTabId)) {
    return;
  }
  const closeResponse = await sendMessage({
    type: MESSAGE_TYPES.CLOSE_TAB,
    tabId: tab.chromeTabId
  });
  if (!closeResponse?.ok) {
    throw new Error(closeResponse?.error ?? "TAB_CLOSE_FAILED");
  }
  await generatePreview();
}

previewGroups.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.dataset.action !== "rename-group") {
    return;
  }
  const groupId = target.dataset.groupId;
  const group = previewState?.groups?.find((value) => value.id === groupId);
  if (!group) {
    return;
  }
  group.name = target.value;
});

function handlePreviewClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (!action || !previewState) {
    return;
  }

  if (action === "toggle-collapse") {
    const groupId = target.dataset.groupId;
    if (!groupId) {
      return;
    }
    if (collapsedGroupIds.has(groupId)) {
      collapsedGroupIds.delete(groupId);
    } else {
      collapsedGroupIds.add(groupId);
    }
    renderPreview();
    return;
  }

  if (action === "delete-group") {
    deleteGroup(target.dataset.groupId);
    return;
  }

  if (action === "exclude-tab") {
    const tabIndex = Number(target.dataset.tabIndex);
    if (!Number.isInteger(tabIndex)) {
      return;
    }
    moveTabToGroup(tabIndex, "excluded");
    return;
  }

  if (action === "close-tab") {
    const tabIndex = Number(target.dataset.tabIndex);
    if (!Number.isInteger(tabIndex)) {
      return;
    }
    void closeTabAndRefresh(tabIndex).catch((error) => {
      setStatus(`Close failed: ${error.message}`, "error");
    });
  }
}

previewGroups.addEventListener("click", handlePreviewClick);
excludedTabs.addEventListener("click", handlePreviewClick);

function handleDragStart(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const tabIndex = target.dataset.tabIndex;
  if (typeof tabIndex !== "string") {
    return;
  }
  event.dataTransfer?.setData("text/plain", tabIndex);
}

function handleDragOver(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  const dropTarget = event.target.closest(".dropzone");
  if (!dropTarget) {
    return;
  }
  event.preventDefault();
}

function handleDrop(event) {
  if (!(event.target instanceof HTMLElement) || !previewState) {
    return;
  }

  const dropzone = event.target.closest(".dropzone");
  if (!dropzone) {
    return;
  }
  event.preventDefault();

  const rawValue = event.dataTransfer?.getData("text/plain");
  const tabIndex = Number(rawValue);
  if (!Number.isInteger(tabIndex)) {
    return;
  }

  if (dropzone.dataset.dropTarget === "excluded") {
    moveTabToGroup(tabIndex, "excluded");
    return;
  }

  const groupId = dropzone.dataset.groupId;
  if (!groupId) {
    return;
  }
  moveTabToGroup(tabIndex, groupId);
}

previewGroups.addEventListener("dragstart", handleDragStart);
previewGroups.addEventListener("dragover", handleDragOver);
previewGroups.addEventListener("drop", handleDrop);
excludedTabs.addEventListener("dragstart", handleDragStart);
excludedTabs.addEventListener("dragover", handleDragOver);
excludedTabs.addEventListener("drop", handleDrop);

organizeBtn.addEventListener("click", () => {
  void generatePreview().catch((error) => {
    setStatus(`Preview failed: ${error.message}`, "error");
    setBusyState(false);
  });
});

applyPreviewBtn.addEventListener("click", () => {
  void applyPreview().catch((error) => {
    setStatus(`Apply failed: ${error.message}`, "error");
    setBusyState(false);
  });
});

regeneratePreviewBtn.addEventListener("click", () => {
  void generatePreview().catch((error) => {
    setStatus(`Regenerate failed: ${error.message}`, "error");
    setBusyState(false);
  });
});

cancelPreviewBtn.addEventListener("click", () => {
  void cancelPreview().catch((error) => {
    setStatus(`Cancel failed: ${error.message}`, "error");
    setBusyState(false);
  });
});

clearGroupsBtn.addEventListener("click", () => {
  if (!previewState) {
    return;
  }
  clearAllGroups();
  setStatus("All preview groups removed. Tabs are now excluded.", "neutral");
});

revertBtn.addEventListener("click", () => {
  void revertSelected().catch((error) => {
    setStatus(`Revert failed: ${error.message}`, "error");
    setBusyState(false);
  });
});

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function init() {
  const lastRun = await sendMessage({ type: MESSAGE_TYPES.GET_LAST_RUN });
  setSummary(lastRun?.ok ? lastRun.summary : null);
  await loadClientSettings();
  await loadPreview();
  await refreshRevertHistory();
  setStatus("Ready.");
}

void init().catch((error) => {
  setStatus(`Init failed: ${error.message}`, "error");
});
