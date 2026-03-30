const { newId } = require("../util/id.js");

/** @param {{ runSync: Function, getFirstSync: Function, getAllSync: Function }} engine */
function createSyncOutboundQueue(engine) {
  const now = () => Date.now();

  /**
   * @param {Record<string, unknown>} row
   */
  function serializableRow(row) {
    const out = {};
    if (!row || typeof row !== "object") return out;
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v === undefined) continue;
      if (typeof v === "function" || typeof v === "symbol") continue;
      out[k] = v;
    }
    return out;
  }

  return {
    /**
     * LWW / mutable entities: coalesce pending upserts for same entity+id to one row.
     */
    enqueueUpsert(entity, entityId, row) {
      const payload = JSON.stringify(serializableRow(row));
      engine.runSync(
        "DELETE FROM sync_outbound_queue WHERE entity = ? AND entity_id = ? AND status = 'pending' AND op = 'upsert'",
        entity,
        entityId
      );
      const id = newId();
      engine.runSync(
        `INSERT INTO sync_outbound_queue (id, op, entity, entity_id, payload_json, flags_json, created_at, status, attempts)
         VALUES (?, 'upsert', ?, ?, ?, ?, ?, 'pending', 0)`,
        id,
        entity,
        entityId,
        payload,
        JSON.stringify({ appendOnly: false }),
        now()
      );
      return id;
    },
    /** Append-only facts: each insert is its own queue row (never coalesced). */
    enqueueAppend(entity, entityId, row) {
      const payload = JSON.stringify(serializableRow(row));
      const id = newId();
      engine.runSync(
        `INSERT INTO sync_outbound_queue (id, op, entity, entity_id, payload_json, flags_json, created_at, status, attempts)
         VALUES (?, 'append', ?, ?, ?, ?, ?, 'pending', 0)`,
        id,
        entity,
        entityId,
        payload,
        JSON.stringify({ appendOnly: true }),
        now()
      );
      return id;
    },
    enqueueDelete(entity, entityId) {
      const id = newId();
      engine.runSync(
        `INSERT INTO sync_outbound_queue (id, op, entity, entity_id, payload_json, flags_json, created_at, status, attempts)
         VALUES (?, 'delete', ?, ?, NULL, ?, ?, 'pending', 0)`,
        id,
        entity,
        entityId,
        JSON.stringify({ appendOnly: false }),
        now()
      );
      return id;
    },
    listPending(limit = 500) {
      return engine.getAllSync(
        "SELECT * FROM sync_outbound_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
        limit
      );
    },
    markDone(id) {
      engine.runSync("UPDATE sync_outbound_queue SET status = 'done', last_error = NULL WHERE id = ?", id);
    },
    markFailed(id, message) {
      engine.runSync(
        "UPDATE sync_outbound_queue SET status = 'failed', last_error = ?, attempts = attempts + 1 WHERE id = ?",
        String(message).slice(0, 2000),
        id
      );
    },
    /** Reset failed rows to pending for retry (dev / manual recovery). */
    resetFailedToPending() {
      engine.runSync("UPDATE sync_outbound_queue SET status = 'pending', last_error = NULL WHERE status = 'failed'");
    },
    countPending() {
      const r = engine.getFirstSync("SELECT COUNT(*) AS c FROM sync_outbound_queue WHERE status = 'pending'");
      return Number(r?.c ?? r?.C ?? 0);
    },
    countFailed() {
      const r = engine.getFirstSync("SELECT COUNT(*) AS c FROM sync_outbound_queue WHERE status = 'failed'");
      return Number(r?.c ?? r?.C ?? 0);
    },
  };
}

module.exports = { createSyncOutboundQueue };
