function quoteIdent(name) {
  return `"${String(name || "").replace(/"/g, '""')}"`;
}

function listUserTables(engine) {
  const rows = engine.getAllSync(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => String(r.name)).filter((n) => n && n !== "schema_migrations");
}

function tableColumns(engine, table) {
  const rows = engine.getAllSync(`PRAGMA table_info(${quoteIdent(table)})`);
  return rows.map((r) => String(r.name)).filter(Boolean);
}

function wipeAllTables(engine, runMigrationsFn) {
  const tables = listUserTables(engine);
  engine.execSync("PRAGMA foreign_keys = OFF;");
  for (const table of tables) {
    engine.execSync(`DROP TABLE IF EXISTS ${quoteIdent(table)};`);
  }
  engine.execSync("PRAGMA foreign_keys = ON;");
  runMigrationsFn(engine);
}

function snapshotAllTables(engine) {
  const tables = [];
  for (const table of listUserTables(engine)) {
    const rows = engine.getAllSync(`SELECT * FROM ${quoteIdent(table)}`);
    tables.push({ name: table, rows: Array.isArray(rows) ? rows : [] });
  }
  return tables;
}

function restoreTableRows(engine, table, rows) {
  if (!rows?.length) return;
  const cols = tableColumns(engine, table);
  if (!cols.length) return;
  for (const row of rows) {
    const usedCols = cols.filter((c) => row[c] !== undefined);
    if (!usedCols.length) continue;
    const placeholders = usedCols.map(() => "?").join(", ");
    const values = usedCols.map((c) => row[c]);
    engine.runSync(
      `INSERT OR REPLACE INTO ${quoteIdent(table)} (${usedCols.map(quoteIdent).join(", ")}) VALUES (${placeholders})`,
      ...values
    );
  }
}

export function createLocalDatasetArchiveManager({
  engine,
  runMigrationsFn,
  saveArchive,
  loadArchive,
}) {
  async function archiveAndWipeTenant(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id) return false;
    const payload = {
      version: 1,
      tenantId: id,
      createdAt: Date.now(),
      tables: snapshotAllTables(engine),
    };
    await saveArchive(id, payload);
    wipeAllTables(engine, runMigrationsFn);
    return true;
  }

  async function restoreTenantIfArchived(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id) return false;
    const archived = await loadArchive(id);
    if (!archived || archived.tenantId !== id || !Array.isArray(archived.tables)) return false;
    wipeAllTables(engine, runMigrationsFn);
    for (const table of archived.tables) {
      const name = String(table?.name || "").trim();
      if (!name) continue;
      restoreTableRows(engine, name, Array.isArray(table?.rows) ? table.rows : []);
    }
    return true;
  }

  return {
    archiveAndWipeTenant,
    restoreTenantIfArchived,
  };
}
