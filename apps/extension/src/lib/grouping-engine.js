import { groupTabsHeuristic } from "./grouping-heuristic.js";
import { groupTabsWithAI } from "./openai-client.js";
import { enrichTabsWithPageContext } from "./page-context.js";
import { postProcessGroups } from "./group-postprocess.js";

function toPreviewGroups(groups, tabs) {
  return groups.map((group, index) => ({
    id: `group_${index + 1}`,
    name: group.name,
    tabIndices: group.tabIndices,
    confidence: group.confidence,
    rationale: group.rationale,
    sampleTitles: group.tabIndices
      .slice(0, 3)
      .map((tabIndex) => tabs[tabIndex]?.title)
      .filter(Boolean)
  }));
}

/**
 * Builds high-quality preview groups with optional page enrichment.
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @param {{ openaiApiKey: string, model: string, includeFullUrl: boolean, includeScrapedContext: boolean }} settings
 */
export async function buildPreviewFromTabs(tabs, settings) {
  let workingTabs = tabs;
  let groups = [];
  let usedFallback = false;
  let enrichedContextUsed = false;
  let hint = "";

  try {
    groups = await groupTabsWithAI(workingTabs, settings);

    if (settings.includeScrapedContext) {
      const enrichment = await enrichTabsWithPageContext(workingTabs, groups);
      workingTabs = enrichment.tabs;
      hint = enrichment.hint || "";

      if (enrichment.enriched) {
        enrichedContextUsed = true;
        try {
          groups = await groupTabsWithAI(workingTabs, settings);
        } catch {
          // keep first pass groups
        }
      }
    }
  } catch {
    groups = groupTabsHeuristic(workingTabs);
    usedFallback = true;
    if (!hint) {
      hint = "AI unavailable. Used local heuristic grouping.";
    }
  }

  const processed = postProcessGroups(groups, workingTabs);
  const previewGroups = toPreviewGroups(processed, workingTabs);

  return {
    tabs: workingTabs,
    groups: previewGroups,
    usedFallback,
    enrichedContextUsed,
    hint
  };
}
