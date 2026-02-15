chrome.runtime.onInstalled.addListener(() => {
  // Placeholder until organize workflow is wired.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ORGANIZE_NOW") {
    sendResponse({ ok: false, error: "NOT_READY" });
    return true;
  }

  if (message?.type === "GET_LAST_RUN") {
    sendResponse({ ok: true, summary: null });
    return true;
  }

  return false;
});
