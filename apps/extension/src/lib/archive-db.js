const DB_NAME = "mindweave-local";
const DB_VERSION = 1;
const STORE_ARCHIVES = "archives";

function createId(prefix) {
  const random =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function openArchiveDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ARCHIVES)) {
        const store = db.createObjectStore(STORE_ARCHIVES, {
          keyPath: "archiveId"
        });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("ARCHIVE_DB_OPEN_FAILED"));
  });
}

function withStore(mode, handler) {
  return openArchiveDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ARCHIVES, mode);
        const store = tx.objectStore(STORE_ARCHIVES);
        let result;
        try {
          result = handler(store);
        } catch (error) {
          reject(error);
          db.close();
          return;
        }
        tx.oncomplete = () => {
          Promise.resolve(result)
            .then((resolved) => {
              resolve(resolved);
              db.close();
            })
            .catch((error) => {
              reject(error);
              db.close();
            });
        };
        tx.onerror = () => {
          reject(tx.error ?? new Error("ARCHIVE_DB_TX_FAILED"));
          db.close();
        };
        tx.onabort = () => {
          reject(tx.error ?? new Error("ARCHIVE_DB_TX_ABORTED"));
          db.close();
        };
      })
  );
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("ARCHIVE_DB_REQUEST_FAILED"));
  });
}

function sanitizeArchiveTab(tab) {
  return {
    chromeTabId: Number.isInteger(tab?.chromeTabId) ? tab.chromeTabId : undefined,
    title: typeof tab?.title === "string" ? tab.title.slice(0, 220) : "Untitled Tab",
    url: typeof tab?.url === "string" ? tab.url : undefined,
    domain: typeof tab?.domain === "string" ? tab.domain : "unknown",
    windowId: Number.isInteger(tab?.windowId) ? tab.windowId : -1,
    tabIndex: Number.isInteger(tab?.tabIndex) ? tab.tabIndex : 0
  };
}

export async function saveArchiveEntry(entry) {
  return withStore("readwrite", (store) => {
    store.put(entry);
  });
}

/**
 * @param {{ reason: string, tabs: Array<{chromeTabId?: number, title?: string, url?: string, domain?: string, windowId?: number, tabIndex?: number}>, draftId?: string, groupName?: string }} payload
 * @returns {Promise<{ archiveId: string, closedCount: number, failedTabIds: number[] }>}
 */
export async function archiveAndCloseTabs(payload) {
  const tabs = Array.isArray(payload?.tabs) ? payload.tabs : [];
  const archiveTabs = tabs.map((tab) => sanitizeArchiveTab(tab));
  const archiveId = createId("archive");
  const entry = {
    archiveId,
    createdAt: Date.now(),
    reason: typeof payload?.reason === "string" ? payload.reason : "manual",
    tabs: archiveTabs,
    draftId: typeof payload?.draftId === "string" ? payload.draftId : undefined,
    groupName: typeof payload?.groupName === "string" ? payload.groupName : undefined
  };

  await saveArchiveEntry(entry);

  const failedTabIds = [];
  let closedCount = 0;
  for (const tab of archiveTabs) {
    if (!Number.isInteger(tab.chromeTabId)) {
      continue;
    }
    try {
      await chrome.tabs.remove(tab.chromeTabId);
      closedCount += 1;
    } catch {
      failedTabIds.push(tab.chromeTabId);
    }
  }

  return {
    archiveId,
    closedCount,
    failedTabIds
  };
}

/**
 * @param {number} limit
 * @returns {Promise<import("./models").ArchiveEntry[]>}
 */
export async function listRecentArchives(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, limit));
  const db = await openArchiveDb();
  try {
    const tx = db.transaction(STORE_ARCHIVES, "readonly");
    const store = tx.objectStore(STORE_ARCHIVES);
    const index = store.index("createdAt");

    return await new Promise((resolve, reject) => {
      const entries = [];
      const request = index.openCursor(null, "prev");
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || entries.length >= safeLimit) {
          resolve(entries);
          return;
        }
        entries.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error("ARCHIVE_DB_CURSOR_FAILED"));
    });
  } finally {
    db.close();
  }
}

/**
 * @param {string} archiveId
 * @returns {Promise<import("./models").ArchiveEntry|null>}
 */
export async function getArchiveById(archiveId) {
  if (!archiveId) {
    return null;
  }
  return withStore("readonly", (store) =>
    requestToPromise(store.get(archiveId))
  ).then((entry) => entry ?? null);
}

/**
 * @param {number} maxEntries
 * @returns {Promise<number>} pruned count
 */
export async function pruneArchives(maxEntries = 1000) {
  const cap = Math.max(1, maxEntries);
  const db = await openArchiveDb();
  try {
    const tx = db.transaction(STORE_ARCHIVES, "readwrite");
    const store = tx.objectStore(STORE_ARCHIVES);
    const index = store.index("createdAt");

    return await new Promise((resolve, reject) => {
      let seen = 0;
      let deleted = 0;
      const cursorRequest = index.openCursor(null, "prev");
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve(deleted);
          return;
        }
        seen += 1;
        if (seen > cap) {
          store.delete(cursor.primaryKey);
          deleted += 1;
        }
        cursor.continue();
      };
      cursorRequest.onerror = () =>
        reject(cursorRequest.error ?? new Error("ARCHIVE_DB_PRUNE_CURSOR_FAILED"));
    });
  } finally {
    db.close();
  }
}
