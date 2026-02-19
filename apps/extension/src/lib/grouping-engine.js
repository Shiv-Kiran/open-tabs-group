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
 * @param {{ openaiApiKey: string, model: string, fallbackModel: string, includeFullUrl: boolean, includeScrapedContext: boolean }} settings
 */
export async function buildPreviewFromTabs(tabs, settings) {
  let workingTabs = tabs;
  let groups = [];
  let usedFallback = false;
  let enrichedContextUsed = false;
  let hint = "";
  let aiErrorCode = "";
  let aiMeta = {
    primaryModel: settings.model,
    fallbackModel: settings.fallbackModel,
    usedFallbackModel: false
  };

  try {
    const firstPass = await groupTabsWithAI(workingTabs, settings);
    groups = firstPass.groups;
    aiMeta = firstPass.meta;

    if (settings.includeScrapedContext) {
      const enrichment = await enrichTabsWithPageContext(workingTabs, groups);
      workingTabs = enrichment.tabs;
      hint = enrichment.hint || "";

      if (enrichment.enriched) {
        enrichedContextUsed = true;
        try {
          const secondPass = await groupTabsWithAI(workingTabs, settings);
          groups = secondPass.groups;
          aiMeta = secondPass.meta;
        } catch (error) {
          aiErrorCode = error?.message ?? "UNKNOWN_AI_ERROR";
          aiMeta = {
            ...aiMeta,
            aiErrorCode
          };
          hint =
            hint ||
            `Second-pass AI enrichment failed (${aiErrorCode}). Kept first-pass groups.`;
        }
      }
    }
  } catch (error) {
    groups = groupTabsHeuristic(workingTabs);
    usedFallback = true;
    aiErrorCode = error?.message ?? "UNKNOWN_AI_ERROR";
    aiMeta = {
      ...aiMeta,
      aiErrorCode
    };
    if (!hint) {
      hint = `AI request failed (${aiErrorCode}). Used local heuristic grouping.`;
    }
  }

  const processed = postProcessGroups(groups, workingTabs);
  const previewGroups = toPreviewGroups(processed, workingTabs);

  return {
    tabs: workingTabs,
    groups: previewGroups,
    usedFallback,
    enrichedContextUsed,
    hint,
    aiErrorCode,
    aiMeta
  };
}
