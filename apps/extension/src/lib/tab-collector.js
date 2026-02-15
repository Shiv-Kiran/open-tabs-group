function isSupportedUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const blockedPrefixes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "view-source:",
    "devtools://"
  ];

  if (blockedPrefixes.some((prefix) => url.startsWith(prefix))) {
    return false;
  }

  return url.startsWith("http://") || url.startsWith("https://");
}

function domainFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function normalizeTitle(title) {
  if (!title || typeof title !== "string") {
    return "Untitled Tab";
  }
  return title.trim().slice(0, 180);
}

function toOrganizeTab(tab, includeFullUrl) {
  const normalized = {
    chromeTabId: tab.id,
    windowId: tab.windowId,
    title: normalizeTitle(tab.title),
    domain: domainFromUrl(tab.url),
    pinned: Boolean(tab.pinned)
  };

  if (includeFullUrl) {
    normalized.url = tab.url;
  }

  return normalized;
}

/**
 * Collects tabs across all windows and returns normalized tab metadata.
 * @param {{ includeFullUrl: boolean }} options
 */
export async function collectTabs(options) {
  const includeFullUrl = Boolean(options?.includeFullUrl);
  const allTabs = await chrome.tabs.query({});
  const supportedTabs = allTabs.filter(
    (tab) => typeof tab.id === "number" && isSupportedUrl(tab.url)
  );

  return supportedTabs.map((tab) => toOrganizeTab(tab, includeFullUrl));
}
