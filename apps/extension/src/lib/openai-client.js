function buildTabsPayload(tabs, includeFullUrl) {
  return tabs
    .map((tab, index) => {
      const pieces = [
        `id:${index}`,
        `window:${tab.windowId}`,
        `position:${tab.tabIndex}`,
        `title:${tab.title}`,
        `domain:${tab.domain}`
      ];
      if (includeFullUrl && tab.url) {
        pieces.push(`url:${tab.url}`);
      }
      if (tab.pageContext?.description) {
        pieces.push(`description:${tab.pageContext.description}`);
      }
      if (tab.pageContext?.snippet) {
        pieces.push(`snippet:${tab.pageContext.snippet}`);
      }
      if (Array.isArray(tab.pageContext?.headings) && tab.pageContext.headings.length > 0) {
        pieces.push(`headings:${tab.pageContext.headings.join(" || ")}`);
      }
      if (Array.isArray(tab.pageContext?.siteHints) && tab.pageContext.siteHints.length > 0) {
        pieces.push(`hints:${tab.pageContext.siteHints.join(", ")}`);
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
          typeof group?.confidence === "number" ? group.confidence : undefined,
        rationale:
          typeof group?.rationale === "string"
            ? group.rationale.trim().slice(0, 160)
            : undefined
      };
    })
    .filter(Boolean);
}

function parseResponsePayload(data, tabCount) {
  const rawContent = data?.choices?.[0]?.message?.content;

  let content = rawContent;
  if (Array.isArray(rawContent)) {
    content = rawContent
      .map((chunk) => {
        if (typeof chunk === "string") {
          return chunk;
        }
        if (typeof chunk?.text === "string") {
          return chunk.text;
        }
        return "";
      })
      .join("\n");
  }

  if (typeof content !== "string") {
    throw new Error("AI_RESPONSE_EMPTY");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const extracted = content.match(/\{[\s\S]*\}/);
    if (!extracted) {
      throw new Error("AI_RESPONSE_INVALID_JSON");
    }
    try {
      parsed = JSON.parse(extracted[0]);
    } catch {
      throw new Error("AI_RESPONSE_INVALID_JSON");
    }
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
          "You are a browser tab organizer. Return JSON only with shape {\"groups\":[{\"name\":\"...\",\"tabIndices\":[0,1],\"confidence\":0.0,\"rationale\":\"...\"}]}. Group by user intent/topic. Do not group primarily by domain. Same-domain tabs can belong to different topics. Use tab adjacency as a weak signal only."
      },
      {
        role: "user",
        content: `Group these tabs by topic and intent.\nRules:\n- Avoid giant single-domain buckets.\n- Keep unrelated tasks separate.\n- Keep group names specific and short.\nTabs:\n${buildTabsPayload(
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
