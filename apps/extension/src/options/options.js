import { DEFAULT_SETTINGS, getSettings, saveSettings } from "../lib/storage.js";

const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const fallbackModelInput = document.getElementById("fallbackModel");
const includeFullUrlInput = document.getElementById("includeFullUrl");
const includeScrapedContextInput = document.getElementById(
  "includeScrapedContext"
);
const organizeScopeInput = document.getElementById("organizeScope");
const allowCrossWindowGroupingInput = document.getElementById(
  "allowCrossWindowGrouping"
);
const saveBtn = document.getElementById("saveBtn");
const statusText = document.getElementById("statusText");

function setStatus(message) {
  statusText.textContent = message;
}

async function loadSettings() {
  const settings = await getSettings();
  apiKeyInput.value = settings.openaiApiKey;
  modelInput.value = settings.model || DEFAULT_SETTINGS.model;
  fallbackModelInput.value =
    settings.fallbackModel || DEFAULT_SETTINGS.fallbackModel;
  includeFullUrlInput.checked = settings.includeFullUrl;
  includeScrapedContextInput.checked = settings.includeScrapedContext;
  organizeScopeInput.value = settings.organizeScope || DEFAULT_SETTINGS.organizeScope;
  allowCrossWindowGroupingInput.checked = settings.allowCrossWindowGrouping;
}

async function handleSave() {
  saveBtn.disabled = true;
  setStatus("Saving...");

  const openaiApiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || DEFAULT_SETTINGS.model;
  const fallbackModel =
    fallbackModelInput.value.trim() || DEFAULT_SETTINGS.fallbackModel;
  const includeFullUrl = includeFullUrlInput.checked;
  const includeScrapedContext = includeScrapedContextInput.checked;
  const organizeScope = organizeScopeInput.value || DEFAULT_SETTINGS.organizeScope;
  const allowCrossWindowGrouping = allowCrossWindowGroupingInput.checked;

  await saveSettings({
    openaiApiKey,
    model,
    fallbackModel,
    includeFullUrl,
    includeScrapedContext,
    organizeScope,
    allowCrossWindowGrouping
  });

  setStatus("Saved.");
  saveBtn.disabled = false;
}

saveBtn.addEventListener("click", () => {
  void handleSave().catch((error) => {
    saveBtn.disabled = false;
    setStatus(`Save failed: ${error.message}`);
  });
});

void loadSettings().catch((error) => {
  setStatus(`Load failed: ${error.message}`);
});
