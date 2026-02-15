const MAX_ENRICHED_TABS = 25;

const GENERIC_NAME_PATTERN = /\b(group|tabs|misc|other|stuff|random)\b/i;

function isGenericGroupName(name) {
  if (typeof name !== "string") {
    return true;
  }
  return GENERIC_NAME_PATTERN.test(name.trim());
}

function dominantDomainRatio(indices, tabs) {
  const counts = new Map();
  for (const index of indices) {
    const domain = tabs[index]?.domain ?? "unknown";
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  let max = 0;
  for (const value of counts.values()) {
    max = Math.max(max, value);
  }
  return indices.length > 0 ? max / indices.length : 0;
}

function detectAmbiguousTabIndices(tabs, groups) {
  const ambiguous = new Set();

  for (const group of groups) {
    const indices = Array.isArray(group?.tabIndices) ? group.tabIndices : [];
    if (indices.length === 0) {
      continue;
    }

    const tooLarge = indices.length > 12;
    const domainHeavy = dominantDomainRatio(indices, tabs) >= 0.7;
    const lowConfidence =
      typeof group.confidence === "number" && group.confidence < 0.65;
    const genericName = isGenericGroupName(group.name);

    if (tooLarge || domainHeavy || lowConfidence || genericName) {
      for (const index of indices) {
        ambiguous.add(index);
      }
    }
  }

  return [...ambiguous].slice(0, MAX_ENRICHED_TABS);
}

function buildSiteHints(tab) {
  const hints = new Set();
  if (typeof tab.title === "string") {
    tab.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .slice(0, 6)
      .forEach((token) => hints.add(token));
  }

  if (typeof tab.url === "string") {
    try {
      const parsed = new URL(tab.url);
      parsed.pathname
        .split("/")
        .map((segment) => segment.trim().toLowerCase())
        .filter((segment) => segment.length >= 4)
        .slice(0, 6)
        .forEach((segment) => hints.add(segment));
    } catch {
      // ignore invalid URL parsing
    }
  }

  return [...hints].slice(0, 6);
}

function extractionScript() {
  function clean(text, limit = 280) {
    if (!text || typeof text !== "string") {
      return "";
    }
    return text.replace(/\s+/g, " ").trim().slice(0, limit);
  }

  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    "";

  const headingNodes = [
    ...document.querySelectorAll("h1, h2")
  ].slice(0, 4);
  const headings = headingNodes.map((node) => clean(node.textContent, 120)).filter(Boolean);

  const articleText = clean(
    document.querySelector("article")?.textContent ||
      document.querySelector("main")?.textContent ||
      document.querySelector("p")?.textContent ||
      "",
    360
  );

  return {
    description: clean(description, 220),
    headings,
    snippet: articleText
  };
}

async function requestOptionalSiteAccess() {
  const permissions = { origins: ["https://*/*", "http://*/*"] };
  const granted = await chrome.permissions.contains(permissions);
  return { granted, requested: false };
}

/**
 * Tries targeted context enrichment for ambiguous tabs.
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @param {import("./models").GroupSuggestion[]} groups
 */
export async function enrichTabsWithPageContext(tabs, groups) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return { tabs, enriched: false, hint: "No tabs to enrich." };
  }

  const targetIndices = detectAmbiguousTabIndices(tabs, groups);
  if (targetIndices.length === 0) {
    return { tabs, enriched: false, hint: "No ambiguous tabs detected." };
  }

  const permissionResult = await requestOptionalSiteAccess();
  if (!permissionResult.granted) {
    return {
      tabs,
      enriched: false,
      hint: "Site permission denied. Using title and URL only."
    };
  }

  const nextTabs = tabs.map((tab) => ({ ...tab }));
  let enrichedCount = 0;

  for (const index of targetIndices) {
    const tab = nextTabs[index];
    if (!tab || !Number.isInteger(tab.chromeTabId)) {
      continue;
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.chromeTabId },
        func: extractionScript
      });
      const context = result?.[0]?.result ?? {};
      tab.pageContext = {
        description: context.description || undefined,
        headings: Array.isArray(context.headings) ? context.headings : undefined,
        snippet: context.snippet || undefined,
        siteHints: buildSiteHints(tab)
      };
      enrichedCount += 1;
    } catch {
      tab.pageContext = {
        siteHints: buildSiteHints(tab)
      };
    }
  }

  return {
    tabs: nextTabs,
    enriched: enrichedCount > 0,
    hint:
      enrichedCount > 0
        ? `Enriched ${enrichedCount} tabs with page context.`
        : "No readable page context extracted. Used title/URL metadata."
  };
}
