class LWWConflictError extends Error {
  /** @param {string} entity */
  constructor(entity) {
    super(`LWW conflict: ${entity} was updated elsewhere (updated_at mismatch)`);
    this.name = "LWWConflictError";
    this.entity = entity;
  }
}

class AppendOnlyError extends Error {
  /** @param {string} entity */
  constructor(entity) {
    super(`Append-only: ${entity} cannot be updated or deleted locally`);
    this.name = "AppendOnlyError";
    this.entity = entity;
  }
}

module.exports = { LWWConflictError, AppendOnlyError };
