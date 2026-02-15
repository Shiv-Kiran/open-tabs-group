import { MESSAGE_TYPES } from "../lib/messages.js";

const organizeBtn = document.getElementById("organizeBtn");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const statusText = document.getElementById("statusText");
const hintText = document.getElementById("hintText");
const summaryText = document.getElementById("summaryText");

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

function formatSummary(summary) {
  if (!summary) {
    return "No runs yet.";
  }

  const runDate =
    typeof summary.ranAt === "number"
      ? new Date(summary.ranAt).toLocaleString()
      : "Unknown";

  const groupedTabs = Number.isInteger(summary.groupedTabs)
    ? summary.groupedTabs
    : 0;
  const groupsCreated = Number.isInteger(summary.groupsCreated)
    ? summary.groupsCreated
    : 0;
  const skippedTabs = Number.isInteger(summary.skippedTabs)
    ? summary.skippedTabs
    : 0;

  return `${groupedTabs} tabs, ${groupsCreated} groups, ${skippedTabs} skipped. Last run: ${runDate}.`;
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
    setStatus("Unable to load last run summary.", "error");
    return;
  }

  setStatus("Ready.");
  setSummary(response.summary);
}

organizeBtn.addEventListener("click", async () => {
  organizeBtn.disabled = true;
  setHint("");
  setStatus("Organizing tabs...", "loading");

  try {
    const response = await sendMessage({ type: MESSAGE_TYPES.ORGANIZE_NOW });
    if (!response?.ok) {
      if (response?.error === "MISSING_API_KEY") {
        setStatus("Missing API key.", "error");
        setHint("Open Settings and paste your OpenAI API key.");
      } else {
        setStatus(
          `Organize failed: ${response?.error ?? "Unknown error"}`,
          "error"
        );
      }
      return;
    }

    setSummary(response.summary);
    setStatus(
      response.summary.usedFallback
        ? "Done with fallback grouping."
        : "Done. Tabs organized.",
      "success"
    );
  } catch (error) {
    setStatus(`Organize failed: ${error.message}`, "error");
  } finally {
    organizeBtn.disabled = false;
  }
});

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void init().catch((error) => {
  setStatus(`Init failed: ${error.message}`, "error");
});
