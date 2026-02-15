function buildTabsPayload(tabs, includeFullUrl) {
  return tabs
    .map((tab, index) => {
      const pieces = [`${index}`, tab.title, tab.domain];
      if (includeFullUrl && tab.url) {
        pieces.push(tab.url);
      }
      return pieces.join(" | ");
    })
    .join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOpenAI(payload, openaiApiKey, timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`AI_HTTP_${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("AI_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function normalizeGroupName(name, fallback) {
  if (typeof name !== "string") {
    return fallback;
  }
  const cleaned = name.trim();
  return cleaned.length > 0 ? cleaned.slice(0, 60) : fallback;
}

function validateGroups(rawGroups, tabCount) {
  if (!Array.isArray(rawGroups)) {
    return [];
  }

  return rawGroups
    .map((group, idx) => {
      const indices = Array.isArray(group?.tabIndices)
        ? [...new Set(group.tabIndices.filter((value) => Number.isInteger(value)))]
            .filter((value) => value >= 0 && value < tabCount)
        : [];

      if (indices.length === 0) {
        return null;
      }

      return {
        name: normalizeGroupName(group?.name, `Group ${idx + 1}`),
        tabIndices: indices,
        confidence:
          typeof group?.confidence === "number" ? group.confidence : undefined
      };
    })
    .filter(Boolean);
}

function parseResponsePayload(data, tabCount) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI_RESPONSE_EMPTY");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI_RESPONSE_INVALID_JSON");
  }

  const groups = validateGroups(parsed?.groups, tabCount);
  if (groups.length === 0) {
    throw new Error("AI_RESPONSE_NO_VALID_GROUPS");
  }

  return groups;
}

/**
 * @param {import("./models").OrganizeRequestTab[]} tabs
 * @param {{ openaiApiKey: string, model: string, includeFullUrl: boolean }} settings
 * @returns {Promise<import("./models").GroupSuggestion[]>}
 */
export async function groupTabsWithAI(tabs, settings) {
  const timeoutMs = 20_000;
  const maxRetries = 1;

  const payload = {
    model: settings.model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a browser tab organizer. Return JSON only with the shape {\"groups\":[{\"name\":\"...\",\"tabIndices\":[0,1],\"confidence\":0.0}]}. Group tabs by topic and keep names concise."
      },
      {
        role: "user",
        content: `Group these tabs by topic.\nTabs:\n${buildTabsPayload(
          tabs,
          settings.includeFullUrl
        )}`
      }
    ]
  };

  let attempt = 0;
  let lastError = null;
  while (attempt <= maxRetries) {
    try {
      const data = await requestOpenAI(
        payload,
        settings.openaiApiKey,
        timeoutMs
      );
      return parseResponsePayload(data, tabs.length);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }
      await sleep((attempt + 1) * 500);
      attempt += 1;
    }
  }

  throw lastError ?? new Error("AI_REQUEST_FAILED");
}
