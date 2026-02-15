const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const includeFullUrlInput = document.getElementById("includeFullUrl");
const saveBtn = document.getElementById("saveBtn");
const statusText = document.getElementById("statusText");

saveBtn.addEventListener("click", () => {
  statusText.textContent = "Settings logic is being wired...";
});

modelInput.value = "gpt-4o-mini";
apiKeyInput.value = "";
includeFullUrlInput.checked = false;
