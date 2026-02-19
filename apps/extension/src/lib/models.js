/**
 * @typedef {Object} GroupSuggestion
 * @property {string} name
 * @property {number[]} tabIndices
 * @property {number=} confidence
 * @property {string=} rationale
 */

/**
 * @typedef {Object} PageContext
 * @property {string=} description
 * @property {string[]=} headings
 * @property {string=} snippet
 * @property {string[]=} siteHints
 */

/**
 * @typedef {Object} OrganizeRequestTab
 * @property {number} chromeTabId
  * @property {number} windowId
 * @property {number} tabIndex
 * @property {string} title
  * @property {string} domain
 * @property {string[]=} urlPathHints
  * @property {string=} url
  * @property {boolean} pinned
 * @property {number|null=} groupId
 * @property {PageContext=} pageContext
 */

/**
 * @typedef {Object} ApplySummary
 * @property {number} groupedTabs
 * @property {number} groupsCreated
 * @property {number} skippedTabs
 */

/**
 * @typedef {Object} PreviewGroup
 * @property {string} id
 * @property {string} name
 * @property {number[]} tabIndices
 * @property {number=} confidence
 * @property {string[]=} sampleTitles
 * @property {string=} rationale
 */

/**
 * @typedef {Object} PreviewDraft
 * @property {string} draftId
 * @property {number} createdAt
 * @property {OrganizeRequestTab[]} tabs
 * @property {PreviewGroup[]} groups
 * @property {boolean} usedFallback
 * @property {boolean} enrichedContextUsed
 * @property {string=} hint
 * @property {AiRunMeta=} aiMeta
 */

/**
 * @typedef {Object} AiRunMeta
 * @property {string} primaryModel
 * @property {string} fallbackModel
 * @property {boolean} usedFallbackModel
 * @property {string=} aiErrorCode
 */

/**
 * @typedef {Object} RunSnapshotTab
 * @property {number} chromeTabId
 * @property {number|null} priorGroupId
 */

/**
 * @typedef {Object} RunSnapshotGroup
 * @property {number|null} oldGroupId
 * @property {string} title
 * @property {"grey"|"blue"|"red"|"yellow"|"green"|"pink"|"purple"|"cyan"|"orange"} color
 * @property {number[]} tabIds
 */

/**
 * @typedef {Object} RunSnapshot
 * @property {string} snapshotId
 * @property {number} createdAt
 * @property {RunSnapshotTab[]} tabs
 * @property {RunSnapshotGroup[]} priorGroups
 * @property {{ groupedTabs: number, groupsCreated: number }} summary
 */

/**
 * @typedef {Object} RevertHistoryEntry
 * @property {string} snapshotId
 * @property {number} createdAt
 * @property {number} groupedTabs
 * @property {number} groupsCreated
 */

/**
 * @typedef {Object} ArchiveTab
 * @property {number=} chromeTabId
 * @property {string} title
 * @property {string=} url
 * @property {string} domain
 * @property {number} windowId
 * @property {number} tabIndex
 */

/**
 * @typedef {Object} ArchiveEntry
 * @property {string} archiveId
 * @property {number} createdAt
 * @property {string} reason
 * @property {ArchiveTab[]} tabs
 * @property {string=} draftId
 * @property {string=} groupName
 */

/**
 * @typedef {Object} CloseBatchUndoToken
 * @property {string} tokenId
 * @property {string} archiveId
 * @property {number} expiresAt
 */

export const typeHints = {};
