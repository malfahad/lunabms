/**
 * Wraps a sql.js Database as the SqlEngine used by runMigrations + createRepos (Node tests).
 */
function createSqlJsEngine(rawDb) {
  return {
    execSync(sql) {
      rawDb.exec(sql);
    },
    runSync(sql, ...params) {
      if (params.length === 0) {
        rawDb.run(sql);
        return { changes: rawDb.getRowsModified() };
      }
      const stmt = rawDb.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      return { changes: rawDb.getRowsModified() };
    },
    getFirstSync(sql, ...params) {
      const stmt = rawDb.prepare(sql);
      if (params.length) stmt.bind(params);
      const stepped = stmt.step();
      if (!stepped) {
        stmt.free();
        return null;
      }
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    },
    getAllSync(sql, ...params) {
      const stmt = rawDb.prepare(sql);
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },
  };
}

module.exports = { createSqlJsEngine };
