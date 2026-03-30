/**
 * In-memory queue stub for tests/tools that do not open SQLite.
 * **FieldOps** uses the durable **`sync_outbound_queue`** table (migration v8) via `repos.syncOutbound`.
 */

const SYNC_QUEUE_STUB_VERSION = 2;

function createLocalDbStub() {
  const queue = [];

  return {
    version: SYNC_QUEUE_STUB_VERSION,
    enqueue(op) {
      queue.push({ ...op, _queuedAt: Date.now() });
    },
    pending() {
      return [...queue];
    },
  };
}

module.exports = { createLocalDbStub, SYNC_QUEUE_STUB_VERSION };
