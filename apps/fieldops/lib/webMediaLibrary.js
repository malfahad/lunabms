const IDB_NAME = "luna-bms-fieldops";
const IDB_VERSION = 3;
const SQLITE_STORE = "sqliteBlob";
const MEDIA_OBJECT_STORE = "mediaObjects";
const MEDIA_LIBRARY_STORE = "mediaLibrary";
const LIBRARY_KEY = "media-library";

export const MEDIA_STATUS_LOCAL = 0;
export const MEDIA_STATUS_SYNCING = 1;
export const MEDIA_STATUS_SYNCED = 2;
export const MEDIA_STATUS_FAILED = 3;

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export function makeMediaIdbKey() {
  return `media_${Date.now()}_${randomSuffix()}`;
}

export function parseMediaIdbKey(storageUri) {
  const raw = String(storageUri || "");
  const prefix = "idb://media/";
  if (!raw.startsWith(prefix)) return "";
  return raw.slice(prefix.length).trim();
}

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(SQLITE_STORE)) db.createObjectStore(SQLITE_STORE);
      if (!db.objectStoreNames.contains(MEDIA_OBJECT_STORE)) db.createObjectStore(MEDIA_OBJECT_STORE);
      if (!db.objectStoreNames.contains(MEDIA_LIBRARY_STORE)) db.createObjectStore(MEDIA_LIBRARY_STORE);
    };
  });
}

async function withDb(mode, fn) {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (cb) => {
      if (settled) return;
      settled = true;
      try {
        db.close();
      } catch {
        /* ignore */
      }
      cb();
    };
    try {
      const tx = db.transaction([MEDIA_OBJECT_STORE, MEDIA_LIBRARY_STORE], mode);
      Promise.resolve(fn(tx))
        .then((value) => done(() => resolve(value)))
        .catch((error) => done(() => reject(error)));
      tx.onerror = () => done(() => reject(tx.error ?? new Error("indexedDB transaction failed")));
      tx.onabort = () => done(() => reject(tx.error ?? new Error("indexedDB transaction aborted")));
    } catch (error) {
      done(() => reject(error));
    }
  });
}

export async function getLibrarySnapshot() {
  const result = await withDb("readonly", async (tx) => {
    const req = tx.objectStore(MEDIA_LIBRARY_STORE).get(LIBRARY_KEY);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });
  return result ?? { key: LIBRARY_KEY, items: {}, updatedAt: Date.now() };
}

async function putLibrarySnapshot(snapshot, tx) {
  const req = tx.objectStore(MEDIA_LIBRARY_STORE).put(snapshot, LIBRARY_KEY);
  return await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(snapshot);
    req.onerror = () => reject(req.error);
  });
}

export async function putMediaObject(idbKey, blob) {
  return withDb("readwrite", async (tx) => {
    const req = tx.objectStore(MEDIA_OBJECT_STORE).put(blob, idbKey);
    await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(null);
      req.onerror = () => reject(req.error);
    });
    return true;
  });
}

export async function getMediaObject(idbKey) {
  return withDb("readonly", async (tx) => {
    const req = tx.objectStore(MEDIA_OBJECT_STORE).get(idbKey);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

function getSnapshotItems(snapshot) {
  return snapshot?.items && typeof snapshot.items === "object" ? snapshot.items : {};
}

function findItemByAttachmentOrRemote(items, attachmentId, remoteUrl) {
  const aId = String(attachmentId || "").trim();
  const rUrl = String(remoteUrl || "").trim();
  const values = Object.values(items || {});
  if (aId) {
    const byId = values.find((x) => String(x?.attachmentId || "") === aId);
    if (byId) return byId;
  }
  if (rUrl) {
    const byRemote = values.find((x) => String(x?.remoteUrl || "") === rUrl);
    if (byRemote) return byRemote;
  }
  return null;
}

export async function resolveMediaDisplayUri(storageUri, options = {}) {
  const key = parseMediaIdbKey(storageUri);
  const attachmentId = String(options?.attachmentId || "").trim();
  const rawUri = String(storageUri || "");
  if (key) {
    const blob = await getMediaObject(key);
    if (blob) {
      if (typeof URL === "undefined" || !URL.createObjectURL) return "";
      return URL.createObjectURL(blob);
    }
    const snapshot = await getLibrarySnapshot();
    const items = getSnapshotItems(snapshot);
    const linked = findItemByAttachmentOrRemote(items, attachmentId, rawUri);
    const fallbackRemote = String(linked?.remoteUrl || "").trim();
    return isRemoteHttpUrl(fallbackRemote) ? fallbackRemote : "";
  }
  const snapshot = await getLibrarySnapshot();
  const items = getSnapshotItems(snapshot);
  const linked = findItemByAttachmentOrRemote(items, attachmentId, rawUri);
  if (!linked?.idbKey) return rawUri;
  const blob = await getMediaObject(linked.idbKey);
  if (!blob) {
    const fallbackRemote = String(linked?.remoteUrl || "").trim();
    return isRemoteHttpUrl(fallbackRemote) ? fallbackRemote : rawUri;
  }
  if (typeof URL === "undefined" || !URL.createObjectURL) return "";
  return URL.createObjectURL(blob);
}

export async function deleteMediaObject(idbKey) {
  return withDb("readwrite", async (tx) => {
    const req = tx.objectStore(MEDIA_OBJECT_STORE).delete(idbKey);
    await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(null);
      req.onerror = () => reject(req.error);
    });
    return true;
  });
}

export async function upsertLibraryItem(item) {
  return withDb("readwrite", async (tx) => {
    const getReq = tx.objectStore(MEDIA_LIBRARY_STORE).get(LIBRARY_KEY);
    const current = await new Promise((resolve, reject) => {
      getReq.onsuccess = () => resolve(getReq.result ?? { key: LIBRARY_KEY, items: {} });
      getReq.onerror = () => reject(getReq.error);
    });
    const items = current?.items && typeof current.items === "object" ? current.items : {};
    const key = String(item?.idbKey || "");
    if (!key) throw new Error("idbKey is required");
    const now = Date.now();
    const prev = items[key] || {};
    items[key] = {
      ...prev,
      ...item,
      idbKey: key,
      attachmentId: String(item?.attachmentId ?? prev?.attachmentId ?? ""),
      remoteUrl: String(item?.remoteUrl ?? prev?.remoteUrl ?? ""),
      status: Number(item?.status ?? prev?.status ?? MEDIA_STATUS_LOCAL),
      createdAt: Number(item?.createdAt ?? prev?.createdAt ?? now),
      updatedAt: now,
    };
    const next = { key: LIBRARY_KEY, items, updatedAt: now };
    await putLibrarySnapshot(next, tx);
    return items[key];
  });
}

export async function updateLibraryItemStatus(idbKey, status, patch = {}) {
  return withDb("readwrite", async (tx) => {
    const getReq = tx.objectStore(MEDIA_LIBRARY_STORE).get(LIBRARY_KEY);
    const current = await new Promise((resolve, reject) => {
      getReq.onsuccess = () => resolve(getReq.result ?? { key: LIBRARY_KEY, items: {} });
      getReq.onerror = () => reject(getReq.error);
    });
    const items = current?.items && typeof current.items === "object" ? current.items : {};
    const prev = items[idbKey] || { idbKey, createdAt: Date.now() };
    items[idbKey] = {
      ...prev,
      ...patch,
      idbKey,
      status: Number(status),
      updatedAt: Date.now(),
    };
    const next = { key: LIBRARY_KEY, items, updatedAt: Date.now() };
    await putLibrarySnapshot(next, tx);
    return items[idbKey];
  });
}

export async function removeLibraryItem(idbKey) {
  return withDb("readwrite", async (tx) => {
    const getReq = tx.objectStore(MEDIA_LIBRARY_STORE).get(LIBRARY_KEY);
    const current = await new Promise((resolve, reject) => {
      getReq.onsuccess = () => resolve(getReq.result ?? { key: LIBRARY_KEY, items: {} });
      getReq.onerror = () => reject(getReq.error);
    });
    const items = current?.items && typeof current.items === "object" ? current.items : {};
    delete items[idbKey];
    const next = { key: LIBRARY_KEY, items, updatedAt: Date.now() };
    await putLibrarySnapshot(next, tx);
    return true;
  });
}

export async function triggerMediaSyncWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg?.active) {
      reg.active.postMessage({ type: "MEDIA_SYNC_TRIGGER", libraryKey: LIBRARY_KEY });
    }
    if (reg?.sync?.register) {
      await reg.sync.register("media-sync");
    }
  } catch {
    /* best effort */
  }
}

function isRemoteHttpUrl(uri) {
  const value = String(uri || "").trim().toLowerCase();
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function hydrateLibraryFromPostAttachments(attachments) {
  const rows = Array.isArray(attachments) ? attachments : [];
  if (!rows.length) return { downloaded: 0, failed: 0 };
  let downloaded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const snapshot = await getLibrarySnapshot();
      const items = getSnapshotItems(snapshot);
      const rawStorageUri = String(row?.storage_uri || "").trim();
      const existing = findItemByAttachmentOrRemote(items, row?.id, rawStorageUri);
      const existingKey = String(existing?.idbKey || parseMediaIdbKey(rawStorageUri) || "");
   
      const remoteUrl = isRemoteHttpUrl(rawStorageUri)
        ? rawStorageUri
        : String(existing?.remoteUrl || "").trim();
      if (existingKey) {
        const cached = await getMediaObject(existingKey);
        if (cached) {
          await upsertLibraryItem({
            ...existing,
            idbKey: existingKey,
            attachmentId: String(row?.id || ""),
            remoteUrl: isRemoteHttpUrl(remoteUrl) ? remoteUrl : String(existing?.remoteUrl || ""),
            fileName: row?.file_name || existing?.fileName || "attachment",
            fileSize: Number(row?.file_size ?? existing?.fileSize ?? 0),
            mimeType: row?.mime_type || existing?.mimeType || "",
            attachmentType: row?.attachment_type || existing?.attachmentType || "document",
            status: MEDIA_STATUS_SYNCED,
          });
          continue;
        }
      }
      if (!isRemoteHttpUrl(remoteUrl)) continue;
      const response = await fetch(remoteUrl);
      if (!response.ok) throw new Error(`download_failed_${response.status}`);
      const blob = await response.blob();
      const idbKey = existingKey || makeMediaIdbKey();
      await putMediaObject(idbKey, blob);
      await upsertLibraryItem({
        idbKey,
        attachmentId: String(row?.id || ""),
        remoteUrl,
        storageUri: `idb://media/${idbKey}`,
        fileName: row?.file_name || "attachment",
        mimeType: row?.mime_type || blob.type || "",
        fileSize: Number(row?.file_size ?? blob.size ?? 0),
        attachmentType: row?.attachment_type || "document",
        status: MEDIA_STATUS_SYNCED,
      });
      downloaded += 1;
    } catch {
      failed += 1;
    }
  }
  return { downloaded, failed };
}

export { IDB_NAME, IDB_VERSION, MEDIA_OBJECT_STORE, MEDIA_LIBRARY_STORE, LIBRARY_KEY };
