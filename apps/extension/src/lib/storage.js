const SETTINGS_OPENAI_KEY = "settings.openaiApiKey";
const SETTINGS_MODEL = "settings.model";
const SETTINGS_INCLUDE_FULL_URL = "settings.includeFullUrl";
const SETTINGS_INCLUDE_SCRAPED_CONTEXT = "settings.includeScrapedContext";
const LAST_RUN_SUMMARY = "runs.lastSummary";
const PREVIEW_DRAFT = "runs.previewDraft";
const REVERT_HISTORY = "runs.revertHistory";

const MAX_REVERT_HISTORY = 3;

export const DEFAULT_SETTINGS = Object.freeze({
  openaiApiKey: "",
  model: "gpt-4o-mini",
  includeFullUrl: true,
  includeScrapedContext: true
});

async function getValues(keys) {
  return chrome.storage.local.get(keys);
}

async function setValues(values) {
  await chrome.storage.local.set(values);
}

export async function getSettings() {
  const values = await getValues([
    SETTINGS_OPENAI_KEY,
    SETTINGS_MODEL,
    SETTINGS_INCLUDE_FULL_URL,
    SETTINGS_INCLUDE_SCRAPED_CONTEXT
  ]);

  return {
    openaiApiKey: values[SETTINGS_OPENAI_KEY] ?? DEFAULT_SETTINGS.openaiApiKey,
    model: values[SETTINGS_MODEL] ?? DEFAULT_SETTINGS.model,
    includeFullUrl:
      values[SETTINGS_INCLUDE_FULL_URL] ?? DEFAULT_SETTINGS.includeFullUrl,
    includeScrapedContext:
      values[SETTINGS_INCLUDE_SCRAPED_CONTEXT] ??
      DEFAULT_SETTINGS.includeScrapedContext
  };
}

export async function saveSettings(settings) {
  await setValues({
    [SETTINGS_OPENAI_KEY]: settings.openaiApiKey ?? DEFAULT_SETTINGS.openaiApiKey,
    [SETTINGS_MODEL]: settings.model ?? DEFAULT_SETTINGS.model,
    [SETTINGS_INCLUDE_FULL_URL]:
      settings.includeFullUrl ?? DEFAULT_SETTINGS.includeFullUrl,
    [SETTINGS_INCLUDE_SCRAPED_CONTEXT]:
      settings.includeScrapedContext ?? DEFAULT_SETTINGS.includeScrapedContext
  });
}

export async function getLastRunSummary() {
  const values = await getValues([LAST_RUN_SUMMARY]);
  return values[LAST_RUN_SUMMARY] ?? null;
}

export async function setLastRunSummary(summary) {
  await setValues({
    [LAST_RUN_SUMMARY]: summary
  });
}

export async function getPreviewDraft() {
  const values = await getValues([PREVIEW_DRAFT]);
  return values[PREVIEW_DRAFT] ?? null;
}

export async function setPreviewDraft(previewDraft) {
  await setValues({
    [PREVIEW_DRAFT]: previewDraft
  });
}

export async function clearPreviewDraft() {
  await chrome.storage.local.remove(PREVIEW_DRAFT);
}

export async function getRevertHistory() {
  const values = await getValues([REVERT_HISTORY]);
  return Array.isArray(values[REVERT_HISTORY]) ? values[REVERT_HISTORY] : [];
}

export async function appendRevertSnapshot(snapshot) {
  const history = await getRevertHistory();
  const nextHistory = [snapshot, ...history].slice(0, MAX_REVERT_HISTORY);
  await setValues({
    [REVERT_HISTORY]: nextHistory
  });
}

export async function findRevertSnapshot(snapshotId) {
  const history = await getRevertHistory();
  return history.find((entry) => entry?.snapshotId === snapshotId) ?? null;
}
