import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { createRepos, createSqlJsEngine, createSyncInboundApplier, runMigrations } from "@lunabms/core";
import { createSyncService } from "../lib/syncService";
import { createLocalDatasetArchiveManager } from "./localDatasetArchive";

const DatabaseContext = createContext(null);

const IDB_NAME = "luna-bms-fieldops";
const IDB_VERSION = 3;
const IDB_STORE = "sqliteBlob";
const IDB_MEDIA_STORE = "mediaObjects";
const IDB_LIBRARY_STORE = "mediaLibrary";
const IDB_KEY = "fieldops.db";
const IDB_ARCHIVE_PREFIX = "tenantArchive:";
const PERSIST_DEBOUNCE_MS = 200;

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
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_MEDIA_STORE)) {
        db.createObjectStore(IDB_MEDIA_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_LIBRARY_STORE)) {
        db.createObjectStore(IDB_LIBRARY_STORE);
      }
    };
  });
}

/** @returns {Promise<Uint8Array | null>} */
async function loadSqliteBytes() {
  if (typeof indexedDB === "undefined") return null;
  const idb = await openIdb();
  if (!idb) return null;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn) => {
      if (settled) return;
      settled = true;
      try {
        idb.close();
      } catch {
        /* ignore */
      }
      fn();
    };
    try {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        const v = req.result;
        if (v == null) done(() => resolve(null));
        else if (v instanceof Uint8Array) done(() => resolve(v));
        else if (v instanceof ArrayBuffer) done(() => resolve(new Uint8Array(v)));
        else done(() => resolve(null));
      };
      req.onerror = () => done(() => reject(req.error));
    } catch (e) {
      done(() => reject(e));
    }
  });
}

/** @param {Uint8Array} bytes */
async function saveSqliteBytes(bytes) {
  if (typeof indexedDB === "undefined") return;
  const idb = await openIdb();
  if (!idb) return;
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => {
      idb.close();
      resolve();
    };
    tx.onerror = () => {
      idb.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      idb.close();
      reject(tx.error ?? new Error("indexedDB transaction aborted"));
    };
  });
}

async function loadTenantArchive(tenantId) {
  if (typeof indexedDB === "undefined") return null;
  const idb = await openIdb();
  if (!idb) return null;
  const key = `${IDB_ARCHIVE_PREFIX}${tenantId}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn) => {
      if (settled) return;
      settled = true;
      try {
        idb.close();
      } catch {
        /* ignore */
      }
      fn();
    };
    try {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => done(() => resolve(req.result ?? null));
      req.onerror = () => done(() => reject(req.error));
    } catch (e) {
      done(() => reject(e));
    }
  });
}

async function saveTenantArchive(tenantId, payload) {
  if (typeof indexedDB === "undefined") return;
  const idb = await openIdb();
  if (!idb) return;
  const key = `${IDB_ARCHIVE_PREFIX}${tenantId}`;
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(payload, key);
    tx.oncomplete = () => {
      idb.close();
      resolve();
    };
    tx.onerror = () => {
      idb.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      idb.close();
      reject(tx.error ?? new Error("indexedDB transaction aborted"));
    };
  });
}

/**
 * sql.js is in-memory unless we export/import. Mirror native `fieldops.db` by
 * persisting the serialized file to IndexedDB so reloads and dev server restarts keep data.
 */
function wrapEngineWithPersist(inner, schedulePersist) {
  return {
    execSync(sql) {
      inner.execSync(sql);
      schedulePersist();
    },
    runSync(sql, ...params) {
      const r = inner.runSync(sql, ...params);
      schedulePersist();
      return r;
    },
    getFirstSync: (...args) => inner.getFirstSync(...args),
    getAllSync: (...args) => inner.getAllSync(...args),
  };
}

/**
 * expo-sqlite uses a native module (ExpoSQLite) that does not exist on web.
 * Same schema + repos run on sql.js (WASM). `locateFile` loads sql-wasm.wasm from the
 * sql.js CDN; FieldOps `metro.config.js` forces the `sql-wasm.js` build on web (not the
 * package "browser" entry), which expects a wasm file actually hosted there.
 */
export function DatabaseProvider({ children }) {
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const [syncState, setSyncState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer = null;
    let rawDb = null;
    let syncService = null;
    let syncUnsub = null;

    const persistNow = () => {
      if (!rawDb || cancelled) return;
      try {
        const data = rawDb.export();
        saveSqliteBytes(data).catch((e) => {
          console.warn("luna-bms: failed to persist web sqlite", e);
        });
      } catch (e) {
        console.warn("luna-bms: sqlite export failed", e);
      }
    };

    const schedulePersist = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        persistNow();
      }, PERSIST_DEBOUNCE_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;
        persistNow();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    (async () => {
      try {
        const mod = await import("sql.js");
        const initSqlJs = mod.default || mod;
        const SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`,
        });

        const existing = await loadSqliteBytes();
        try {
          rawDb =
            existing && existing.byteLength > 0 ? new SQL.Database(existing) : new SQL.Database();
        } catch (loadErr) {
          console.warn("luna-bms: corrupted or incompatible persisted sqlite; starting fresh", loadErr);
          rawDb = new SQL.Database();
        }

        const inner = createSqlJsEngine(rawDb);
        const engine = wrapEngineWithPersist(inner, schedulePersist);
        runMigrations(engine);
        schedulePersist();

        const repos = createRepos(engine);
        const inboundApplier = createSyncInboundApplier(engine);
        const localDatasetArchive = createLocalDatasetArchiveManager({
          engine,
          runMigrationsFn: runMigrations,
          saveArchive: saveTenantArchive,
          loadArchive: loadTenantArchive,
        });
        syncService = createSyncService({ repos, inboundApplier, localDatasetArchive });
        syncUnsub = syncService.subscribe((s) => {
          if (!cancelled) setSyncState(s);
        });
        syncService.start();
        if (!cancelled) setValue({ db: rawDb, repos, syncService });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      if (syncService) {
        try {
          syncService.stop();
        } catch {
          /* ignore */
        }
      }
      if (syncUnsub) {
        try {
          syncUnsub();
        } catch {
          /* ignore */
        }
      }
      if (rawDb) {
        try {
          const data = rawDb.export();
          saveSqliteBytes(data).catch((e) => {
            console.warn("luna-bms: failed to persist web sqlite on unload", e);
          });
        } catch (e) {
          console.warn("luna-bms: sqlite export on unload failed", e);
        }
        try {
          rawDb.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const composed = useMemo(() => {
    if (!value) return null;
    return {
      db: value.db,
      repos: value.repos,
      sync: { ready: Boolean(syncState), ...(syncState || {}), service: value.syncService },
    };
  }, [syncState, value]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Database failed to load</Text>
        <Text style={styles.errBody}>{error.message}</Text>
      </View>
    );
  }

  if (!composed) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.hint}>Loading local database…</Text>
      </View>
    );
  }

  return <DatabaseContext.Provider value={composed}>{children}</DatabaseContext.Provider>;
}

export function useRepos() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error("useRepos must be used within DatabaseProvider");
  }
  return ctx.repos;
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error("useDatabase must be used within DatabaseProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  hint: { marginTop: 12, color: "#64748b", fontSize: 14 },
  errTitle: { fontSize: 18, fontWeight: "600", color: "#b91c1c", marginBottom: 8 },
  errBody: { fontSize: 14, color: "#64748b", textAlign: "center" },
});
