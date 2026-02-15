const organizeBtn = document.getElementById("organizeBtn");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const statusText = document.getElementById("statusText");
const summaryText = document.getElementById("summaryText");

function setStatus(message) {
  statusText.textContent = message;
}

function setSummary(message) {
  summaryText.textContent = message;
}

async function init() {
  setStatus("Ready.");
  setSummary("No runs yet.");
}

organizeBtn.addEventListener("click", () => {
  setStatus("Core organize flow is being wired...");
});

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void init();
