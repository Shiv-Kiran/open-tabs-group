import { MESSAGE_TYPES } from "../lib/messages.js";

const organizeBtn = document.getElementById("organizeBtn");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const statusText = document.getElementById("statusText");
const summaryText = document.getElementById("summaryText");

function setStatus(message) {
  statusText.textContent = message;
}

function formatSummary(summary) {
  if (!summary) {
    return "No runs yet.";
  }

  const runDate = new Date(summary.ranAt).toLocaleString();
  return `${summary.groupedTabs} tabs, ${summary.groupsCreated} groups, ${summary.skippedTabs} skipped. Last run: ${runDate}.`;
}

function setSummary(summary) {
  summaryText.textContent = formatSummary(summary);
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

async function init() {
  const response = await sendMessage({ type: MESSAGE_TYPES.GET_LAST_RUN });
  if (!response?.ok) {
    setStatus("Unable to load last run summary.");
    return;
  }

  setStatus("Ready.");
  setSummary(response.summary);
}

organizeBtn.addEventListener("click", async () => {
  organizeBtn.disabled = true;
  setStatus("Organizing tabs...");

  try {
    const response = await sendMessage({ type: MESSAGE_TYPES.ORGANIZE_NOW });
    if (!response?.ok) {
      if (response?.error === "MISSING_API_KEY") {
        setStatus("Missing API key. Open settings to add it.");
      } else {
        setStatus(`Organize failed: ${response?.error ?? "Unknown error"}`);
      }
      return;
    }

    setSummary(response.summary);
    setStatus(
      response.summary.usedFallback
        ? "Done with fallback grouping."
        : "Done. Tabs organized."
    );
  } catch (error) {
    setStatus(`Organize failed: ${error.message}`);
  } finally {
    organizeBtn.disabled = false;
  }
});

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void init().catch((error) => {
  setStatus(`Init failed: ${error.message}`);
});
