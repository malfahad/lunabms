const ENTITY_META = {
  clients: {
    table: "clients",
    mode: "mutable",
    columns: ["id", "name", "phone", "email", "notes", "type", "kind", "updated_at"],
  },
  suppliers: {
    table: "suppliers",
    mode: "mutable",
    columns: ["id", "name", "category", "contact", "updated_at"],
  },
  retainers: {
    table: "retainers",
    mode: "mutable",
    columns: [
      "id",
      "client_id",
      "total_amount",
      "balance",
      "status",
      "start_date",
      "opportunity_id",
      "updated_at",
    ],
  },
  opportunities: {
    table: "opportunities",
    mode: "mutable",
    columns: [
      "id",
      "name",
      "status",
      "client_id",
      "value",
      "estimated_value",
      "expected_close",
      "location",
      "contact_name",
      "contact_phone",
      "contact_email",
      "captured_at",
      "updated_at",
    ],
  },
  quotations: {
    table: "quotations",
    mode: "mutable",
    columns: [
      "id",
      "opportunity_id",
      "status",
      "sub_total",
      "tax_amount",
      "total_amount",
      "issued_date",
      "expiry_date",
      "project_id",
      "updated_at",
    ],
  },
  projects: {
    table: "projects",
    mode: "mutable",
    columns: [
      "id",
      "opportunity_id",
      "retainer_id",
      "name",
      "status",
      "budget",
      "start_date",
      "end_date",
      "archived",
      "updated_at",
    ],
  },
  tasks: {
    table: "tasks",
    mode: "mutable",
    columns: ["id", "project_id", "title", "status", "due_date", "priority", "updated_at"],
  },
  invoices: {
    table: "invoices",
    mode: "mutable",
    columns: [
      "id",
      "project_id",
      "status",
      "sub_total",
      "tax",
      "tax_rate",
      "tax_amount",
      "total_amount",
      "issued_date",
      "due_date",
      "updated_at",
    ],
  },
  expenses: {
    table: "expenses",
    mode: "mutable",
    columns: [
      "id",
      "project_id",
      "supplier_id",
      "amount",
      "supplier_name",
      "category",
      "receipt_url",
      "expense_date",
      "updated_at",
    ],
  },
  workers: {
    table: "workers",
    mode: "mutable",
    columns: ["id", "name", "role", "phone", "display_name", "notes", "updated_at"],
  },
  payments: {
    table: "payments",
    mode: "append",
    columns: ["id", "invoice_id", "amount", "method", "created_at", "paid_at"],
  },
  posts: {
    table: "posts",
    mode: "append",
    columns: [
      "id",
      "parent_type",
      "parent_id",
      "type",
      "media_url",
      "body",
      "transcript",
      "author_id",
      "created_at",
    ],
  },
  retainer_applications: {
    table: "retainer_applications",
    mode: "append",
    columns: ["id", "invoice_id", "retainer_id", "amount_applied", "applied_at"],
  },
  task_workers: {
    table: "task_workers",
    mode: "custom",
    columns: ["task_id", "worker_id", "updated_at"],
  },
  invoice_line_items: {
    table: "invoice_line_items",
    mode: "mutable",
    columns: ["id", "invoice_id", "description", "quantity", "unit_price", "sort_order"],
  },
  quotation_line_items: {
    table: "quotation_line_items",
    mode: "mutable",
    columns: ["id", "quotation_id", "description", "quantity", "unit_price", "sort_order"],
  },
  app_settings: {
    table: "app_settings",
    mode: "mutable",
    primaryKey: "key",
    columns: ["key", "value", "updated_at"],
  },
  receipts: {
    table: "receipts",
    mode: "mutable",
    columns: ["id", "payment_id", "pdf_url", "whatsapp_sent", "generated_at"],
  },
  notifications: {
    table: "notifications",
    mode: "mutable",
    columns: ["id", "task_id", "worker_id", "type", "status", "sent_at", "updated_at"],
  },
};

/** @param {{ runSync: Function, getFirstSync: Function }} engine */
function createSyncInboundApplier(engine) {
  function mutableGuard(table, primaryKey, id, incomingLwwTs, hasUpdatedAt = true) {
    if (!hasUpdatedAt) return true;
    const cur = engine.getFirstSync(`SELECT updated_at FROM ${table} WHERE ${primaryKey} = ?`, id);
    if (!cur) return true;
    const localTs = Number(cur.updated_at ?? cur.UPDATED_AT ?? 0);
    return localTs <= Number(incomingLwwTs ?? 0);
  }

  function upsertRow(table, cols, row, mode, primaryKey = "id") {
    const selectedCols = cols.filter((c) => row[c] !== undefined);
    if (!selectedCols.includes(primaryKey)) selectedCols.unshift(primaryKey);
    const placeholders = selectedCols.map(() => "?").join(", ");
    const values = selectedCols.map((c) => row[c] ?? null);
    if (mode === "append") {
      engine.runSync(
        `INSERT OR IGNORE INTO ${table} (${selectedCols.join(", ")}) VALUES (${placeholders})`,
        ...values
      );
      return;
    }
    const updates = selectedCols
      .filter((c) => c !== primaryKey)
      .map((c) => `${c}=excluded.${c}`)
      .join(", ");
    engine.runSync(
      `INSERT INTO ${table} (${selectedCols.join(", ")}) VALUES (${placeholders})
       ON CONFLICT(${primaryKey}) DO UPDATE SET ${updates}`,
      ...values
    );
  }

  function parseTaskWorkerEntityId(entityId, payload) {
    const taskId = payload?.task_id ?? String(entityId || "").split(":")[0] ?? "";
    const workerId = payload?.worker_id ?? String(entityId || "").split(":")[1] ?? "";
    if (!taskId || !workerId) return null;
    return { taskId, workerId };
  }

  return {
    /**
     * @param {{ op: string, entity: string, entity_id: string, payload?: Record<string, unknown> | null, lww_ts?: number }} change
     */
    applyChange(change) {
      const meta = ENTITY_META[change?.entity];
      if (!meta) return { skipped: true, reason: "unknown_entity" };
      const id = change?.entity_id;
      if (!id) return { skipped: true, reason: "missing_entity_id" };
      const payload = change?.payload && typeof change.payload === "object" ? { ...change.payload } : {};
      const primaryKey = meta.primaryKey || "id";
      payload[primaryKey] = payload[primaryKey] ?? id;

      if (change?.entity === "task_workers") {
        const parsed = parseTaskWorkerEntityId(id, payload);
        if (!parsed) return { skipped: true, reason: "missing_task_worker_keys" };
        const lwwTs = Number(payload.updated_at ?? change?.lww_ts ?? 0);
        if (change?.op === "delete") {
          engine.runSync(
            "DELETE FROM task_workers WHERE task_id = ? AND worker_id = ?",
            parsed.taskId,
            parsed.workerId
          );
          return { applied: true };
        }
        engine.runSync(
          "INSERT OR REPLACE INTO task_workers (task_id, worker_id, updated_at) VALUES (?, ?, ?)",
          parsed.taskId,
          parsed.workerId,
          lwwTs
        );
        return { applied: true };
      }

      if (meta.mode === "append") {
        upsertRow(meta.table, meta.columns, payload, "append", primaryKey);
        return { applied: true };
      }

      const lwwTs = Number(payload.updated_at ?? change?.lww_ts ?? 0);
      const hasUpdatedAt = meta.columns.includes("updated_at");
      if (change?.op === "delete") {
        if (!mutableGuard(meta.table, primaryKey, id, lwwTs, hasUpdatedAt))
          return { skipped: true, reason: "local_newer_than_delete" };
        engine.runSync(`DELETE FROM ${meta.table} WHERE ${primaryKey} = ?`, id);
        return { applied: true };
      }

      if (!mutableGuard(meta.table, primaryKey, id, lwwTs, hasUpdatedAt))
        return { skipped: true, reason: "local_newer_than_upsert" };
      if (payload.updated_at === undefined && meta.columns.includes("updated_at")) {
        payload.updated_at = lwwTs;
      }
      upsertRow(meta.table, meta.columns, payload, "mutable", primaryKey);
      return { applied: true };
    },
  };
}

module.exports = { createSyncInboundApplier };
