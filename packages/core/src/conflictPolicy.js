/**
 * Conflict resolution policy (see app_design.md Data Layer).
 *
 * Enforcement (Milestone 1):
 * - LWW: mutable entities use `expectedUpdatedAt` on update; mismatch → LWWConflictError.
 * - Append-only: `payments`, `posts`, `retainer_applications` — insert + read only in @servops/core repos (no update/delete).
 */
const CONFLICT_POLICY = Object.freeze({
  simpleFields: "last-write-wins",
  posts: "append-only",
  payments: "append-only",
  retainerApplications: "append-only",
});

/** @readonly */
const APPEND_ONLY_ENTITIES = Object.freeze(["Post", "Payment", "RetainerApplication"]);

/**
 * Server / sync reconciliation (Milestone 10+).
 * Outbound rows in `sync_outbound_queue` carry `flags_json.appendOnly`. PostgreSQL ingest must:
 * - **Upsert** LWW entities using `updated_at` (or server version) — reject stale writes or merge per product rules.
 * - **Append** rows for Post, Payment, RetainerApplication — **never** UPDATE/DELETE existing server rows for those IDs;
 *   duplicates are application bugs, not silent overwrites.
 * Web: FieldOps persists SQLite to **IndexedDB** (see DatabaseContext.web.js); treat as offline-capable, not “ephemeral tab only”.
 */
const SYNC_RECONCILIATION = Object.freeze({
  lwwUpsertOps: "upsert",
  appendOnlyOps: "append",
  deleteOps: "delete",
  appendOnlyEntities: APPEND_ONLY_ENTITIES,
});

module.exports = { CONFLICT_POLICY, APPEND_ONLY_ENTITIES, SYNC_RECONCILIATION };
