const SETTINGS_OPENAI_KEY = "settings.openaiApiKey";
const SETTINGS_MODEL = "settings.model";
const SETTINGS_INCLUDE_FULL_URL = "settings.includeFullUrl";
const LAST_RUN_SUMMARY = "runs.lastSummary";

export const DEFAULT_SETTINGS = Object.freeze({
  openaiApiKey: "",
  model: "gpt-4o-mini",
  includeFullUrl: false
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
    SETTINGS_INCLUDE_FULL_URL
  ]);

  return {
    openaiApiKey: values[SETTINGS_OPENAI_KEY] ?? DEFAULT_SETTINGS.openaiApiKey,
    model: values[SETTINGS_MODEL] ?? DEFAULT_SETTINGS.model,
    includeFullUrl:
      values[SETTINGS_INCLUDE_FULL_URL] ?? DEFAULT_SETTINGS.includeFullUrl
  };
}

export async function saveSettings(settings) {
  await setValues({
    [SETTINGS_OPENAI_KEY]: settings.openaiApiKey ?? DEFAULT_SETTINGS.openaiApiKey,
    [SETTINGS_MODEL]: settings.model ?? DEFAULT_SETTINGS.model,
    [SETTINGS_INCLUDE_FULL_URL]:
      settings.includeFullUrl ?? DEFAULT_SETTINGS.includeFullUrl
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
