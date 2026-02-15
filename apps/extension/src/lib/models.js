/**
 * @typedef {Object} GroupSuggestion
 * @property {string} name
 * @property {number[]} tabIndices
 * @property {number=} confidence
 */

/**
 * @typedef {Object} OrganizeRequestTab
 * @property {number} chromeTabId
 * @property {number} windowId
 * @property {string} title
 * @property {string} domain
 * @property {string=} url
 * @property {boolean} pinned
 */

/**
 * @typedef {Object} ApplySummary
 * @property {number} groupedTabs
 * @property {number} groupsCreated
 * @property {number} skippedTabs
 */

export const typeHints = {};
