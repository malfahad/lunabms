/**
 * Dev / test helper: marks all pending outbound sync rows as done without calling a server.
 * Real builds replace this with a transport that POSTs to PostgreSQL (or similar).
 *
 * @param {ReturnType<import("./sqlite/syncOutboundQueue.js").createSyncOutboundQueue>} syncOutbound
 * @param {{ onItem?: (row: Record<string, unknown>) => void }} [opts]
 * @returns {number} number of rows cleared
 */
function flushSyncOutboundQueueStub(syncOutbound, opts = {}) {
  const items = syncOutbound.listPending(5000);
  for (const q of items) {
    try {
      if (typeof opts.onItem === "function") opts.onItem(q);
      syncOutbound.markDone(q.id);
    } catch (e) {
      syncOutbound.markFailed(q.id, e instanceof Error ? e.message : String(e));
    }
  }
  return items.length;
}

module.exports = { flushSyncOutboundQueueStub };
