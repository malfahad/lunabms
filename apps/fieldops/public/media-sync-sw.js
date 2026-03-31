const IDB_NAME = "luna-bms-fieldops";
const IDB_VERSION = 3;
const SQLITE_STORE = "sqliteBlob";
const MEDIA_OBJECT_STORE = "mediaObjects";
const MEDIA_LIBRARY_STORE = "mediaLibrary";
const LIBRARY_KEY = "media-library";

const STATUS_LOCAL = 0;
const STATUS_SYNCING = 1;
const STATUS_SYNCED = 2;
const STATUS_FAILED = 3;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
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
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (cb) => {
      if (settled) return;
      settled = true;
      try {
        db.close();
      } catch {
        // ignore
      }
      cb();
    };
    try {
      const tx = db.transaction([MEDIA_LIBRARY_STORE, MEDIA_OBJECT_STORE], mode);
      Promise.resolve(fn(tx))
        .then((v) => done(() => resolve(v)))
        .catch((e) => done(() => reject(e)));
      tx.onerror = () => done(() => reject(tx.error || new Error("IDB tx failed")));
      tx.onabort = () => done(() => reject(tx.error || new Error("IDB tx aborted")));
    } catch (e) {
      done(() => reject(e));
    }
  });
}

async function readLibrarySnapshot() {
  return withDb("readonly", async (tx) => {
    const req = tx.objectStore(MEDIA_LIBRARY_STORE).get(LIBRARY_KEY);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || { key: LIBRARY_KEY, items: {}, updatedAt: Date.now() });
      req.onerror = () => reject(req.error);
    });
  });
}

async function writeLibrarySnapshot(snapshot) {
  return withDb("readwrite", async (tx) => {
    const req = tx.objectStore(MEDIA_LIBRARY_STORE).put(snapshot, LIBRARY_KEY);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  });
}

async function patchLibraryItem(idbKey, patch) {
  const snapshot = await readLibrarySnapshot();
  const items = snapshot.items && typeof snapshot.items === "object" ? snapshot.items : {};
  const prev = items[idbKey] || { idbKey, createdAt: Date.now() };
  items[idbKey] = {
    ...prev,
    ...patch,
    idbKey,
    updatedAt: Date.now(),
  };
  await writeLibrarySnapshot({ key: LIBRARY_KEY, items, updatedAt: Date.now() });
}

async function readBlob(idbKey) {
  return withDb("readonly", async (tx) => {
    const req = tx.objectStore(MEDIA_OBJECT_STORE).get(idbKey);
    return await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

async function syncMediaLibrary() {
  const snapshot = await readLibrarySnapshot();
  const items = snapshot.items && typeof snapshot.items === "object" ? snapshot.items : {};
  const entries = Object.entries(items);
  for (const [idbKey, item] of entries) {
    const currentStatus = Number(item?.status ?? STATUS_LOCAL);
    if (currentStatus === STATUS_SYNCED) continue;
    await patchLibraryItem(idbKey, { status: STATUS_SYNCING, lastError: "" });
    try {
      const blob = await readBlob(idbKey);
      if (!blob) throw new Error("media_not_found");

      let remoteUrl = String(item?.remoteUrl || "");
      if (item?.uploadUrl) {
        const form = new FormData();
        const name = item.fileName || `media-${idbKey}`;
        form.append("file", blob, name);
        const headers = {};
        if (item?.accessToken) headers.Authorization = `Bearer ${item.accessToken}`;
        const resp = await fetch(item.uploadUrl, { method: "POST", headers, body: form });
        if (!resp.ok) throw new Error(`upload_failed_${resp.status}`);
        const body = await resp.json().catch(() => ({}));
        remoteUrl = body?.media_url ? String(body.media_url) : remoteUrl;
      }

      await patchLibraryItem(idbKey, {
        remoteUrl,
        status: STATUS_SYNCED,
        lastError: "",
        syncedAt: Date.now(),
      });
    } catch (e) {
      await patchLibraryItem(idbKey, {
        status: STATUS_FAILED,
        lastError: String(e?.message || e),
      });
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await syncMediaLibrary();
    })()
  );
});

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "MEDIA_SYNC_TRIGGER") {
    event.waitUntil(syncMediaLibrary());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "media-sync") {
    event.waitUntil(syncMediaLibrary());
  }
});
