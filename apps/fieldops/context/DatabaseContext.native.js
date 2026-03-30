import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { openDatabaseSync } from "expo-sqlite";
import * as FileSystem from "expo-file-system";
import { createSyncInboundApplier, runMigrations, createRepos } from "@servops/core";
import { createSyncService } from "../lib/syncService";
import { createLocalDatasetArchiveManager } from "./localDatasetArchive";

const DatabaseContext = createContext(null);
const ARCHIVE_DIR = `${FileSystem.documentDirectory || ""}tenant-archives/`;

function wrapExpoDatabase(db) {
  return {
    execSync: (sql) => db.execSync(sql),
    runSync: (sql, ...params) => db.runSync(sql, ...params),
    getFirstSync: (sql, ...params) => db.getFirstSync(sql, ...params),
    getAllSync: (sql, ...params) => db.getAllSync(sql, ...params),
  };
}

function archivePathForTenant(tenantId) {
  return `${ARCHIVE_DIR}${tenantId}.json`;
}

async function saveTenantArchive(tenantId, payload) {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.makeDirectoryAsync(ARCHIVE_DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(archivePathForTenant(tenantId), JSON.stringify(payload));
}

async function loadTenantArchive(tenantId) {
  if (!FileSystem.documentDirectory) return null;
  const path = archivePathForTenant(tenantId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const raw = await FileSystem.readAsStringAsync(path);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function DatabaseProvider({ children }) {
  const [syncState, setSyncState] = useState(null);
  const value = useMemo(() => {
    const db = openDatabaseSync("fieldops.db");
    const engine = wrapExpoDatabase(db);
    runMigrations(engine);
    const repos = createRepos(engine);
    const inboundApplier = createSyncInboundApplier(engine);
    const localDatasetArchive = createLocalDatasetArchiveManager({
      engine,
      runMigrationsFn: runMigrations,
      saveArchive: saveTenantArchive,
      loadArchive: loadTenantArchive,
    });
    const syncService = createSyncService({ repos, inboundApplier, localDatasetArchive });
    return { db, repos, syncService };
  }, []);

  useEffect(() => {
    const unsub = value.syncService.subscribe(setSyncState);
    value.syncService.start();
    return () => {
      unsub();
      value.syncService.stop();
    };
  }, [value]);

  const composed = useMemo(
    () => ({
      db: value.db,
      repos: value.repos,
      sync: { ready: Boolean(syncState), ...(syncState || {}), service: value.syncService },
    }),
    [syncState, value]
  );

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
