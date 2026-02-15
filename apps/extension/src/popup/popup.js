import { MESSAGE_TYPES } from "../lib/messages.js";

const organizeBtn = document.getElementById("organizeBtn");
const applyPreviewBtn = document.getElementById("applyPreviewBtn");
const regeneratePreviewBtn = document.getElementById("regeneratePreviewBtn");
const cancelPreviewBtn = document.getElementById("cancelPreviewBtn");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const revertBtn = document.getElementById("revertBtn");
const revertSelect = document.getElementById("revertSelect");

const statusText = document.getElementById("statusText");
const hintText = document.getElementById("hintText");
const summaryText = document.getElementById("summaryText");

const previewSection = document.getElementById("previewSection");
const previewMetaText = document.getElementById("previewMetaText");
const previewGroups = document.getElementById("previewGroups");

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

function createPreviewCard(group) {
  const wrapper = document.createElement("article");
  wrapper.className = "preview-card";

  const title = document.createElement("h3");
  title.textContent = `${group.name} (${group.tabIndices.length})`;
  wrapper.appendChild(title);

  if (group.rationale) {
    const rationale = document.createElement("p");
    rationale.className = "preview-rationale";
    rationale.textContent = group.rationale;
    wrapper.appendChild(rationale);
  }

  const list = document.createElement("ul");
  list.className = "preview-samples";
  for (const sample of group.sampleTitles ?? []) {
    const item = document.createElement("li");
    item.textContent = sample;
    list.appendChild(item);
  }

  wrapper.appendChild(list);
  return wrapper;
}

function renderPreview(preview) {
  if (!preview) {
    previewSection.hidden = true;
    previewGroups.innerHTML = "";
    previewMetaText.textContent = "";
    return;
  }

  previewSection.hidden = false;
  previewMetaText.textContent = `${preview.tabs.length} tabs across ${preview.groups.length} groups`;
  previewGroups.innerHTML = "";

  preview.groups.forEach((group) => {
    previewGroups.appendChild(createPreviewCard(group));
  });

  if (preview.hint) {
    setHint(preview.hint);
  }
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
  revertBtn.disabled = isBusy;
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
  history.forEach((entry) => {
    const option = document.createElement("option");
    const date = new Date(entry.createdAt).toLocaleString();
    option.value = entry.snapshotId;
    option.textContent = `${date} - ${entry.groupedTabs} tabs / ${entry.groupsCreated} groups`;
    revertSelect.appendChild(option);
  });
}

async function refreshPreview() {
  const response = await sendMessage({ type: MESSAGE_TYPES.GET_PREVIEW });
  renderPreview(response?.ok ? response.preview : null);
}

async function generatePreview() {
  setBusyState(true);
  setStatus("Generating preview...", "loading");
  setHint("");

  try {
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

    renderPreview(response.preview);
    setSummary(response.summary);
    setStatus("Preview ready. Review and apply.", "success");
  } finally {
    setBusyState(false);
  }
}

async function applyPreview() {
  setBusyState(true);
  setStatus("Applying groups...", "loading");

  try {
    const response = await sendMessage({ type: MESSAGE_TYPES.APPLY_PREVIEW });
    if (!response?.ok) {
      setStatus(`Apply failed: ${response?.error ?? "Unknown error"}`, "error");
      return;
    }

    renderPreview(null);
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
    renderPreview(null);
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
  setStatus("Reverting grouping...", "loading");
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
  } finally {
    setBusyState(false);
  }
}

async function init() {
  const lastRun = await sendMessage({ type: MESSAGE_TYPES.GET_LAST_RUN });
  setSummary(lastRun?.ok ? lastRun.summary : null);
  await refreshPreview();
  await refreshRevertHistory();
  setStatus("Ready.");
}

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
    setStatus(`Preview failed: ${error.message}`, "error");
    setBusyState(false);
  });
});

cancelPreviewBtn.addEventListener("click", () => {
  void cancelPreview().catch((error) => {
    setStatus(`Cancel failed: ${error.message}`, "error");
    setBusyState(false);
  });
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

void init().catch((error) => {
  setStatus(`Init failed: ${error.message}`, "error");
});
