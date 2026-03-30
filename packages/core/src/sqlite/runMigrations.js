const { MIGRATIONS } = require("./migrations.js");

/**
 * @typedef {{ execSync: (sql: string) => void, runSync: (sql: string, ...params: unknown[]) => unknown, getFirstSync: (sql: string, ...params: unknown[]) => any, getAllSync: (sql: string, ...params: unknown[]) => any[] }} SqlEngine
 */

/**
 * Apply pending migrations. Idempotent per version row in schema_migrations.
 * @param {SqlEngine} engine
 */
function runMigrations(engine) {
  engine.execSync("PRAGMA foreign_keys = ON;");
  engine.execSync(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL
);
`);

  const appliedRows = engine.getAllSync("SELECT version FROM schema_migrations ORDER BY version");
  const applied = new Set(appliedRows.map((r) => r.version));

  const ordered = [...MIGRATIONS].sort((a, b) => a.version - b.version);
  for (const m of ordered) {
    if (applied.has(m.version)) continue;
    engine.execSync(m.sql);
    engine.runSync("INSERT INTO schema_migrations (version) VALUES (?)", m.version);
  }
}

module.exports = { runMigrations };
