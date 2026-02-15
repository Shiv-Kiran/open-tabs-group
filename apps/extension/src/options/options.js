import { DEFAULT_SETTINGS, getSettings, saveSettings } from "../lib/storage.js";

const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const includeFullUrlInput = document.getElementById("includeFullUrl");
const saveBtn = document.getElementById("saveBtn");
const statusText = document.getElementById("statusText");

function setStatus(message) {
  statusText.textContent = message;
}

async function loadSettings() {
  const settings = await getSettings();
  apiKeyInput.value = settings.openaiApiKey;
  modelInput.value = settings.model || DEFAULT_SETTINGS.model;
  includeFullUrlInput.checked = settings.includeFullUrl;
}

async function handleSave() {
  saveBtn.disabled = true;
  setStatus("Saving...");

  const openaiApiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || DEFAULT_SETTINGS.model;
  const includeFullUrl = includeFullUrlInput.checked;

  await saveSettings({
    openaiApiKey,
    model,
    includeFullUrl
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
