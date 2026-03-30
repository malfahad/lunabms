const { newId } = require("../util/id.js");
const { LWWConflictError, AppendOnlyError } = require("../errors.js");
const { buildReceiptStubText, NOTIF_TYPE_TASK_OVERDUE_LOCAL } = require("../invoicing.js");
const { createSyncOutboundQueue } = require("./syncOutboundQueue.js");
const { normalizeCurrencyCode, DEFAULT_CURRENCY_CODE } = require("../money.js");

/**
 * @typedef {{ execSync: (sql: string) => void, runSync: (sql: string, ...params: unknown[]) => { changes?: number }, getFirstSync: (sql: string, ...params: unknown[]) => any, getAllSync: (sql: string, ...params: unknown[]) => any[] }} SqlEngine
 */

function invoiceTotal(inv) {
  if (inv.total_amount != null && inv.total_amount !== "") return Number(inv.total_amount);
  return Number(inv.sub_total) + Number(inv.tax_amount ?? inv.tax ?? 0);
}

/**
 * @param {SqlEngine} engine
 */
function createRepos(engine) {
  const now = () => Date.now();
  const syncOutbound = createSyncOutboundQueue(engine);

  function currentCurrencyCode() {
    try {
      const row = engine.getFirstSync("SELECT value FROM app_settings WHERE key = ?", "currency");
      const raw = row?.value ?? row?.VALUE ?? row?.Value;
      return normalizeCurrencyCode(raw ?? DEFAULT_CURRENCY_CODE);
    } catch {
      return DEFAULT_CURRENCY_CODE;
    }
  }

  function qUpsert(entity, id, getRow) {
    try {
      const row = getRow();
      if (row) syncOutbound.enqueueUpsert(entity, id, row);
    } catch {
      /* queue must not break local writes */
    }
  }
  function qDel(entity, id) {
    try {
      syncOutbound.enqueueDelete(entity, id);
    } catch {
      /* ignore */
    }
  }
  function qAppend(entity, id, getRow) {
    try {
      const row = getRow();
      if (row) syncOutbound.enqueueAppend(entity, id, row);
    } catch {
      /* ignore */
    }
  }
  function taskWorkerEntityId(taskId, workerId) {
    return `${taskId}:${workerId}`;
  }

  function assertChanged(res, entity) {
    const n = res && typeof res.changes === "number" ? res.changes : 0;
    if (n === 0) throw new LWWConflictError(entity);
  }

  const clients = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      const ty = input.type ?? input.kind ?? "client";
      engine.runSync(
        "INSERT INTO clients (id, name, phone, email, notes, type, kind, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.name,
        input.phone ?? null,
        input.email ?? null,
        input.notes ?? null,
        ty,
        ty,
        t
      );
      const ins = clients.get(id);
      qUpsert("clients", id, () => ins);
      return ins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM clients WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync("SELECT * FROM clients ORDER BY name COLLATE NOCASE");
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = clients.get(id);
      if (!row) throw new LWWConflictError("Client");
      const t = now();
      const ty = patch.type ?? patch.kind ?? row.type ?? row.kind;
      const res = engine.runSync(
        "UPDATE clients SET name = ?, phone = ?, email = ?, notes = ?, type = ?, kind = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.name ?? row.name,
        patch.phone !== undefined ? patch.phone : row.phone,
        patch.email !== undefined ? patch.email : row.email,
        patch.notes !== undefined ? patch.notes : row.notes,
        ty,
        ty,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Client");
      const upd = clients.get(id);
      qUpsert("clients", id, () => upd);
      return upd;
    },
    delete(id) {
      qDel("clients", id);
      engine.runSync("DELETE FROM clients WHERE id = ?", id);
    },
  };

  const suppliers = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      engine.runSync(
        "INSERT INTO suppliers (id, name, category, contact, updated_at) VALUES (?, ?, ?, ?, ?)",
        id,
        input.name,
        input.category ?? null,
        input.contact ?? null,
        t
      );
      const sins = suppliers.get(id);
      qUpsert("suppliers", id, () => sins);
      return sins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM suppliers WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync("SELECT * FROM suppliers ORDER BY name COLLATE NOCASE");
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = suppliers.get(id);
      if (!row) throw new LWWConflictError("Supplier");
      const t = now();
      const res = engine.runSync(
        "UPDATE suppliers SET name = ?, category = ?, contact = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.name ?? row.name,
        patch.category !== undefined ? patch.category : row.category,
        patch.contact !== undefined ? patch.contact : row.contact,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Supplier");
      const supd = suppliers.get(id);
      qUpsert("suppliers", id, () => supd);
      return supd;
    },
    delete(id) {
      qDel("suppliers", id);
      engine.runSync("DELETE FROM suppliers WHERE id = ?", id);
    },
  };

  const retainers = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      engine.runSync(
        "INSERT INTO retainers (id, client_id, total_amount, balance, status, start_date, opportunity_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.client_id,
        input.total_amount,
        input.balance ?? input.total_amount,
        input.status ?? "active",
        input.start_date ?? t,
        input.opportunity_id ?? null,
        t
      );
      const rins = retainers.get(id);
      qUpsert("retainers", id, () => rins);
      return rins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM retainers WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync("SELECT * FROM retainers ORDER BY updated_at DESC");
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = retainers.get(id);
      if (!row) throw new LWWConflictError("Client deposit");
      const t = now();
      const res = engine.runSync(
        "UPDATE retainers SET client_id = ?, total_amount = ?, balance = ?, status = ?, start_date = ?, opportunity_id = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.client_id ?? row.client_id,
        patch.total_amount ?? row.total_amount,
        patch.balance ?? row.balance,
        patch.status !== undefined ? patch.status : row.status,
        patch.start_date !== undefined ? patch.start_date : row.start_date,
        patch.opportunity_id !== undefined ? patch.opportunity_id : row.opportunity_id,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Client deposit");
      const rupd = retainers.get(id);
      qUpsert("retainers", id, () => rupd);
      return rupd;
    },
    delete(id) {
      qDel("retainers", id);
      engine.runSync("DELETE FROM retainers WHERE id = ?", id);
    },
  };

  const opportunities = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      const capturedAt = input.captured_at != null ? Number(input.captured_at) : t;
      const est =
        input.estimated_value != null && input.estimated_value !== ""
          ? Number(input.estimated_value)
          : input.value != null && input.value !== ""
            ? Number(input.value)
            : null;
      engine.runSync(
        "INSERT INTO opportunities (id, name, status, client_id, value, estimated_value, expected_close, location, contact_name, contact_phone, contact_email, captured_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.name,
        input.status,
        input.client_id ?? null,
        est,
        est,
        input.expected_close ?? null,
        input.location ?? null,
        input.contact_name ?? null,
        input.contact_phone ?? null,
        input.contact_email ?? null,
        capturedAt,
        t
      );
      const oins = opportunities.get(id);
      qUpsert("opportunities", id, () => oins);
      return oins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM opportunities WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync(
        "SELECT * FROM opportunities ORDER BY COALESCE(captured_at, updated_at) DESC, updated_at DESC"
      );
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = opportunities.get(id);
      if (!row) throw new LWWConflictError("Opportunity");
      const t = now();
      const est =
        patch.estimated_value !== undefined
          ? patch.estimated_value
          : patch.value !== undefined
            ? patch.value
            : row.estimated_value ?? row.value;
      const res = engine.runSync(
        "UPDATE opportunities SET name = ?, status = ?, client_id = ?, value = ?, estimated_value = ?, expected_close = ?, location = ?, contact_name = ?, contact_phone = ?, contact_email = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.name ?? row.name,
        patch.status ?? row.status,
        patch.client_id !== undefined ? patch.client_id : row.client_id,
        est,
        est,
        patch.expected_close !== undefined ? patch.expected_close : row.expected_close,
        patch.location !== undefined ? patch.location : row.location,
        patch.contact_name !== undefined ? patch.contact_name : row.contact_name,
        patch.contact_phone !== undefined ? patch.contact_phone : row.contact_phone,
        patch.contact_email !== undefined ? patch.contact_email : row.contact_email,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Opportunity");
      const oupd = opportunities.get(id);
      qUpsert("opportunities", id, () => oupd);
      return oupd;
    },
    delete(id) {
      qDel("opportunities", id);
      engine.runSync("DELETE FROM opportunities WHERE id = ?", id);
    },
  };

  const posts = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.created_at ?? now();
      const body = input.body ?? null;
      const transcript = input.transcript ?? input.body ?? null;
      engine.runSync(
        "INSERT INTO posts (id, parent_type, parent_id, type, media_url, body, transcript, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.parent_type,
        input.parent_id,
        input.type,
        input.media_url ?? null,
        body,
        transcript,
        input.author_id ?? null,
        t
      );
      const pst = posts.get(id);
      qAppend("posts", id, () => pst);
      return pst;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM posts WHERE id = ?", id);
    },
    listByParent(parentType, parentId) {
      return engine.getAllSync(
        "SELECT * FROM posts WHERE parent_type = ? AND parent_id = ? ORDER BY created_at ASC",
        parentType,
        parentId
      );
    },
    listRecent(limit = 100) {
      return engine.getAllSync("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?", limit);
    },
    update() {
      throw new AppendOnlyError("Post");
    },
    delete() {
      throw new AppendOnlyError("Post");
    },
  };

  function formatMoneyAmount(n) {
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    return `${currentCurrencyCode()} ${x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  function implicitActivityPost(parentType, parentId, implicitType, body) {
    if (!parentType || !parentId || !body) return;
    posts.insert({
      parent_type: parentType,
      parent_id: parentId,
      type: implicitType,
      body,
      author_id: null,
    });
  }

  const quotations = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      const sub = Number(input.sub_total ?? 0);
      const taxAmt = Number(input.tax_amount ?? 0);
      const tot = input.total_amount != null ? Number(input.total_amount) : sub + taxAmt;
      engine.runSync(
        "INSERT INTO quotations (id, opportunity_id, status, sub_total, tax_amount, total_amount, issued_date, expiry_date, project_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.opportunity_id,
        input.status,
        sub,
        taxAmt,
        tot,
        input.issued_date ?? t,
        input.expiry_date ?? null,
        input.project_id ?? null,
        t
      );
      const qins = quotations.get(id);
      qUpsert("quotations", id, () => qins);
      if (qins.project_id) {
        implicitActivityPost(
          "project",
          qins.project_id,
          "implicit_quotation",
          `Quotation ${qins.status} — ${formatMoneyAmount(qins.total_amount)}`
        );
      } else if (qins.opportunity_id) {
        implicitActivityPost(
          "opportunity",
          qins.opportunity_id,
          "implicit_quotation",
          `Quotation ${qins.status} — ${formatMoneyAmount(qins.total_amount)}`
        );
      }
      return qins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM quotations WHERE id = ?", id);
    },
    listByOpportunity(opportunityId) {
      return engine.getAllSync(
        "SELECT * FROM quotations WHERE opportunity_id = ? ORDER BY updated_at DESC",
        opportunityId
      );
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = quotations.get(id);
      if (!row) throw new LWWConflictError("Quotation");
      const t = now();
      const sub = patch.sub_total != null ? Number(patch.sub_total) : Number(row.sub_total);
      const taxAmt = patch.tax_amount != null ? Number(patch.tax_amount) : Number(row.tax_amount);
      const tot =
        patch.total_amount != null ? Number(patch.total_amount) : patch.sub_total != null || patch.tax_amount != null ? sub + taxAmt : Number(row.total_amount);
      const res = engine.runSync(
        "UPDATE quotations SET opportunity_id = ?, status = ?, sub_total = ?, tax_amount = ?, total_amount = ?, issued_date = ?, expiry_date = ?, project_id = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.opportunity_id ?? row.opportunity_id,
        patch.status ?? row.status,
        sub,
        taxAmt,
        tot,
        patch.issued_date !== undefined ? patch.issued_date : row.issued_date,
        patch.expiry_date !== undefined ? patch.expiry_date : row.expiry_date,
        patch.project_id !== undefined ? patch.project_id : row.project_id,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Quotation");
      const qupd = quotations.get(id);
      qUpsert("quotations", id, () => qupd);
      if (patch.status !== undefined && patch.status !== row.status) {
        if (qupd.project_id) {
          implicitActivityPost(
            "project",
            qupd.project_id,
            "implicit_quotation",
            `Quotation status → ${qupd.status}`
          );
        } else if (qupd.opportunity_id) {
          implicitActivityPost(
            "opportunity",
            qupd.opportunity_id,
            "implicit_quotation",
            `Quotation status → ${qupd.status}`
          );
        }
      }
      return qupd;
    },
    delete(id) {
      qDel("quotations", id);
      engine.runSync("DELETE FROM quotations WHERE id = ?", id);
    },
  };

  const quotationLineItems = {
    listByQuotation(quotationId) {
      return engine.getAllSync(
        "SELECT * FROM quotation_line_items WHERE quotation_id = ? ORDER BY sort_order ASC, id ASC",
        quotationId
      );
    },
    /** Replaces all lines for a quotation (after insert or when editing lines later). */
    replaceForQuotation(quotationId, lines) {
      const existing = quotationLineItems.listByQuotation(quotationId);
      engine.runSync("DELETE FROM quotation_line_items WHERE quotation_id = ?", quotationId);
      for (const row of existing) qDel("quotation_line_items", row.id);
      let order = 0;
      for (const ln of lines) {
        const lid = ln.id ?? newId();
        const desc = ln.description != null ? String(ln.description) : "";
        const qty = ln.quantity != null && ln.quantity !== "" ? Number(ln.quantity) : 1;
        const unit = Number(ln.unit_price);
        if (Number.isNaN(unit)) continue;
        engine.runSync(
          "INSERT INTO quotation_line_items (id, quotation_id, description, quantity, unit_price, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
          lid,
          quotationId,
          desc,
          qty,
          unit,
          order
        );
        qUpsert("quotation_line_items", lid, () =>
          engine.getFirstSync("SELECT * FROM quotation_line_items WHERE id = ?", lid)
        );
        order += 1;
      }
    },
  };

  const projects = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      engine.runSync(
        "INSERT INTO projects (id, opportunity_id, retainer_id, name, status, budget, start_date, end_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.opportunity_id ?? null,
        input.retainer_id ?? null,
        input.name,
        input.status ?? "active",
        input.budget ?? null,
        input.start_date ?? null,
        input.end_date ?? null,
        t
      );
      const pins = projects.get(id);
      qUpsert("projects", id, () => pins);
      implicitActivityPost(
        "project",
        pins.id,
        "implicit_project",
        `Project created: ${pins.name}${pins.status ? ` (${pins.status})` : ""}`
      );
      return pins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM projects WHERE id = ?", id);
    },
    list(opts = {}) {
      const includeArchived = opts.includeArchived === true;
      if (includeArchived) {
        return engine.getAllSync("SELECT * FROM projects ORDER BY updated_at DESC");
      }
      return engine.getAllSync("SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC");
    },
    listWithStats(opts = {}) {
      const archivedOnly = opts.archivedOnly === true;
      const includeArchived = opts.includeArchived === true;
      let list;
      if (archivedOnly) {
        list = engine.getAllSync("SELECT * FROM projects WHERE archived = 1 ORDER BY updated_at DESC");
      } else if (includeArchived) {
        list = engine.getAllSync("SELECT * FROM projects ORDER BY updated_at DESC");
      } else {
        list = engine.getAllSync("SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC");
      }
      const ts = Date.now();
      return list.map((p) => {
        const taskRows = projects.listTasks(p.id);
        const total = taskRows.length;
        const done = taskRows.filter((x) => String(x.status).toLowerCase() === "done").length;
        const overdueCount = taskRows.filter(
          (x) =>
            x.due_date != null &&
            Number(x.due_date) < ts &&
            String(x.status).toLowerCase() !== "done"
        ).length;
        return { ...p, taskTotal: total, taskDone: done, overdueCount };
      });
    },
    listTasks(projectId) {
      return engine.getAllSync("SELECT * FROM tasks WHERE project_id = ? ORDER BY due_date ASC", projectId);
    },
    listInvoices(projectId) {
      return engine.getAllSync("SELECT * FROM invoices WHERE project_id = ? ORDER BY updated_at DESC", projectId);
    },
    listByRetainer(retainerId) {
      return engine.getAllSync(
        "SELECT * FROM projects WHERE retainer_id = ? ORDER BY name COLLATE NOCASE",
        retainerId
      );
    },
    /**
     * Sets this project’s retainer_id; clears the same retainer from any other project first.
     * Pass retainerId null to unlink only this project.
     */
    assignRetainer(projectId, retainerId) {
      const p = projects.get(projectId);
      if (!p) throw new LWWConflictError("Project");
      if (retainerId == null || retainerId === "") {
        return projects.update(projectId, { retainer_id: null }, { expectedUpdatedAt: p.updated_at });
      }
      const others = engine.getAllSync(
        "SELECT id FROM projects WHERE retainer_id = ? AND id != ?",
        retainerId,
        projectId
      );
      for (const o of others) {
        const cur = projects.get(o.id);
        projects.update(o.id, { retainer_id: null }, { expectedUpdatedAt: cur.updated_at });
      }
      const fresh = projects.get(projectId);
      return projects.update(projectId, { retainer_id: retainerId }, { expectedUpdatedAt: fresh.updated_at });
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = projects.get(id);
      if (!row) throw new LWWConflictError("Project");
      const t = now();
      const nextArchived =
        patch.archived !== undefined ? (patch.archived ? 1 : 0) : row.archived != null ? row.archived : 0;
      const res = engine.runSync(
        "UPDATE projects SET opportunity_id = ?, retainer_id = ?, name = ?, status = ?, budget = ?, start_date = ?, end_date = ?, archived = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.opportunity_id !== undefined ? patch.opportunity_id : row.opportunity_id,
        patch.retainer_id !== undefined ? patch.retainer_id : row.retainer_id,
        patch.name ?? row.name,
        patch.status !== undefined ? patch.status : row.status,
        patch.budget !== undefined ? patch.budget : row.budget,
        patch.start_date !== undefined ? patch.start_date : row.start_date,
        patch.end_date !== undefined ? patch.end_date : row.end_date,
        nextArchived,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Project");
      const pupd = projects.get(id);
      qUpsert("projects", id, () => pupd);
      const nameChanged = patch.name !== undefined && patch.name !== row.name;
      const statusChanged = patch.status !== undefined && patch.status !== row.status;
      const archivedChanged =
        patch.archived !== undefined && Boolean(patch.archived) !== Boolean(Number(row.archived ?? 0));
      if (nameChanged || statusChanged || archivedChanged) {
        const parts = [];
        if (nameChanged) parts.push(`renamed to “${pupd.name}”`);
        if (statusChanged) parts.push(`status → ${pupd.status}`);
        if (archivedChanged) parts.push(Number(pupd.archived) ? "archived" : "restored");
        implicitActivityPost("project", pupd.id, "implicit_project", `Project ${parts.join("; ")}`);
      }
      return pupd;
    },
    delete(id) {
      qDel("projects", id);
      engine.runSync("DELETE FROM projects WHERE id = ?", id);
    },
  };

  const tasks = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      engine.runSync(
        "INSERT INTO tasks (id, project_id, title, status, due_date, priority, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        input.project_id,
        input.title ?? "Task",
        input.status ?? "todo",
        input.due_date ?? null,
        input.priority ?? null,
        t
      );
      const tins = tasks.get(id);
      qUpsert("tasks", id, () => tins);
      implicitActivityPost(
        "project",
        tins.project_id,
        "implicit_task",
        `Task added: ${tins.title}`
      );
      return tins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM tasks WHERE id = ?", id);
    },
    listByProject(projectId) {
      return projects.listTasks(projectId);
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = tasks.get(id);
      if (!row) throw new LWWConflictError("Task");
      const t = now();
      const res = engine.runSync(
        "UPDATE tasks SET project_id = ?, title = ?, status = ?, due_date = ?, priority = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.project_id ?? row.project_id,
        patch.title !== undefined ? patch.title : row.title,
        patch.status ?? row.status,
        patch.due_date !== undefined ? patch.due_date : row.due_date,
        patch.priority !== undefined ? patch.priority : row.priority,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Task");
      const tupd = tasks.get(id);
      qUpsert("tasks", id, () => tupd);
      if (patch.status !== undefined && patch.status !== row.status) {
        implicitActivityPost(
          "project",
          tupd.project_id,
          "implicit_task",
          `Task “${tupd.title}” → ${tupd.status}`
        );
      }
      return tupd;
    },
    delete(id) {
      qDel("tasks", id);
      engine.runSync("DELETE FROM tasks WHERE id = ?", id);
    },
  };

  const taskWorkers = {
    assign(taskId, workerId) {
      const t = now();
      engine.runSync(
        "INSERT OR REPLACE INTO task_workers (task_id, worker_id, updated_at) VALUES (?, ?, ?)",
        taskId,
        workerId,
        t
      );
      qUpsert("task_workers", taskWorkerEntityId(taskId, workerId), () => ({
        task_id: taskId,
        worker_id: workerId,
        updated_at: t,
      }));
    },
    unassign(taskId, workerId) {
      engine.runSync("DELETE FROM task_workers WHERE task_id = ? AND worker_id = ?", taskId, workerId);
      qDel("task_workers", taskWorkerEntityId(taskId, workerId));
    },
    listWorkersForTask(taskId) {
      return engine.getAllSync(
        `SELECT w.* FROM workers w
         INNER JOIN task_workers tw ON tw.worker_id = w.id
         WHERE tw.task_id = ? ORDER BY w.name COLLATE NOCASE`,
        taskId
      );
    },
    listTasksForWorker(workerId) {
      return engine.getAllSync(
        `SELECT t.* FROM tasks t
         INNER JOIN task_workers tw ON tw.task_id = t.id
         WHERE tw.worker_id = ? ORDER BY t.due_date ASC`,
        workerId
      );
    },
  };

  /**
   * Tasks with due_date in the past (vs now), status not done, with project name and assigned workers.
   */
  tasks.listOverdueWithWorkers = function listOverdueWithWorkers() {
    const now = Date.now();
    const rows = engine.getAllSync(
      `SELECT t.*, p.name AS project_name
       FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       WHERE (p.archived IS NULL OR p.archived = 0)
         AND t.due_date IS NOT NULL
         AND t.due_date < ?
         AND LOWER(COALESCE(t.status, '')) != 'done'
       ORDER BY t.due_date ASC`,
      now
    );
    return rows.map((r) => {
      const { project_name, ...task } = r;
      return {
        task,
        project_name: project_name ?? "",
        workers: taskWorkers.listWorkersForTask(task.id),
      };
    });
  };

  const invoices = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      const sub = Number(input.sub_total);
      const taxAmt = Number(input.tax_amount ?? input.tax ?? 0);
      const rate = input.tax_rate != null ? Number(input.tax_rate) : null;
      const total = input.total_amount != null ? Number(input.total_amount) : sub + taxAmt;
      engine.runSync(
        "INSERT INTO invoices (id, project_id, status, sub_total, tax, tax_rate, tax_amount, total_amount, issued_date, due_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.project_id,
        input.status ?? "draft",
        sub,
        taxAmt,
        rate,
        taxAmt,
        total,
        input.issued_date ?? t,
        input.due_date ?? null,
        t
      );
      const iins = invoices.get(id);
      qUpsert("invoices", id, () => iins);
      implicitActivityPost(
        "project",
        iins.project_id,
        "implicit_invoice",
        `Invoice ${iins.status} — ${formatMoneyAmount(invoiceTotal(iins))}`
      );
      return iins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM invoices WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync("SELECT * FROM invoices ORDER BY updated_at DESC");
    },
    listByProject(projectId) {
      return projects.listInvoices(projectId);
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = invoices.get(id);
      if (!row) throw new LWWConflictError("Invoice");
      const t = now();
      const sub = patch.sub_total != null ? Number(patch.sub_total) : Number(row.sub_total);
      const taxAmt = patch.tax_amount != null ? Number(patch.tax_amount) : patch.tax != null ? Number(patch.tax) : Number(row.tax_amount ?? row.tax ?? 0);
      const total =
        patch.total_amount != null ? Number(patch.total_amount) : sub + taxAmt;
      const res = engine.runSync(
        "UPDATE invoices SET project_id = ?, status = ?, sub_total = ?, tax = ?, tax_rate = ?, tax_amount = ?, total_amount = ?, issued_date = ?, due_date = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.project_id ?? row.project_id,
        patch.status !== undefined ? patch.status : row.status,
        sub,
        taxAmt,
        patch.tax_rate !== undefined ? patch.tax_rate : row.tax_rate,
        taxAmt,
        total,
        patch.issued_date !== undefined ? patch.issued_date : row.issued_date,
        patch.due_date !== undefined ? patch.due_date : row.due_date,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Invoice");
      const iupd = invoices.get(id);
      qUpsert("invoices", id, () => iupd);
      if (patch.status !== undefined && patch.status !== row.status) {
        implicitActivityPost(
          "project",
          iupd.project_id,
          "implicit_invoice",
          `Invoice status → ${iupd.status}`
        );
      }
      return iupd;
    },
    delete(id) {
      qDel("invoices", id);
      engine.runSync("DELETE FROM invoices WHERE id = ?", id);
    },
  };

  function invoiceAmountDue(invoiceId) {
    const inv = invoices.get(invoiceId);
    if (!inv) return 0;
    const total = invoiceTotal(inv);
    const paidRow = engine.getFirstSync(
      "SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE invoice_id = ?",
      invoiceId
    );
    const paid = Number(paidRow?.s ?? paidRow?.S ?? 0);
    const credRow = engine.getFirstSync(
      "SELECT COALESCE(SUM(amount_applied), 0) AS s FROM retainer_applications WHERE invoice_id = ?",
      invoiceId
    );
    const cred = Number(credRow?.s ?? credRow?.S ?? 0);
    return Math.max(0, total - paid - cred);
  }

  /**
   * Cash still expected on this project after cash payments and retainer credits already applied to invoices,
   * minus any remaining retainer balance (deposit) that can still be applied to this project’s invoices.
   */
  function computeProjectBalanceDueNet(projectId) {
    const p = projects.get(projectId);
    if (!p) return 0;
    let sum = 0;
    for (const inv of invoices.listByProject(projectId)) {
      sum += invoiceAmountDue(inv.id);
    }
    sum = Math.round(sum * 100) / 100;
    if (p.retainer_id) {
      const r = retainers.get(p.retainer_id);
      if (r) {
        const credit = Math.round(Number(r.balance) * 100) / 100;
        return Math.max(0, Math.round((sum - credit) * 100) / 100);
      }
    }
    return sum;
  }

  const invoiceLineItems = {
    listByInvoice(invoiceId) {
      return engine.getAllSync(
        "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC",
        invoiceId
      );
    },
    /** Replaces all lines for an invoice (used after insert). */
    replaceForInvoice(invoiceId, lines) {
      const existing = invoiceLineItems.listByInvoice(invoiceId);
      engine.runSync("DELETE FROM invoice_line_items WHERE invoice_id = ?", invoiceId);
      for (const row of existing) qDel("invoice_line_items", row.id);
      let order = 0;
      for (const ln of lines) {
        const lid = ln.id ?? newId();
        const desc = ln.description != null ? String(ln.description) : "";
        const qty = ln.quantity != null && ln.quantity !== "" ? Number(ln.quantity) : 1;
        const unit = Number(ln.unit_price);
        if (Number.isNaN(unit)) continue;
        engine.runSync(
          "INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit_price, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
          lid,
          invoiceId,
          desc,
          qty,
          unit,
          order
        );
        qUpsert("invoice_line_items", lid, () =>
          engine.getFirstSync("SELECT * FROM invoice_line_items WHERE id = ?", lid)
        );
        order += 1;
      }
    },
  };

  const expenses = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      engine.runSync(
        "INSERT INTO expenses (id, project_id, supplier_id, amount, supplier_name, category, receipt_url, expense_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        input.project_id,
        input.supplier_id ?? null,
        Number(input.amount),
        input.supplier_name ?? null,
        input.category ?? null,
        input.receipt_url ?? null,
        input.expense_date ?? input.date ?? t,
        t
      );
      const eins = expenses.get(id);
      qUpsert("expenses", id, () => eins);
      return eins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM expenses WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync("SELECT * FROM expenses ORDER BY updated_at DESC");
    },
    listByProject(projectId) {
      return engine.getAllSync("SELECT * FROM expenses WHERE project_id = ? ORDER BY updated_at DESC", projectId);
    },
    listBySupplier(supplierId) {
      return engine.getAllSync("SELECT * FROM expenses WHERE supplier_id = ? ORDER BY expense_date DESC", supplierId);
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = expenses.get(id);
      if (!row) throw new LWWConflictError("Expense");
      const t = now();
      const res = engine.runSync(
        "UPDATE expenses SET project_id = ?, supplier_id = ?, amount = ?, supplier_name = ?, category = ?, receipt_url = ?, expense_date = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.project_id ?? row.project_id,
        patch.supplier_id !== undefined ? patch.supplier_id : row.supplier_id,
        patch.amount != null ? Number(patch.amount) : Number(row.amount),
        patch.supplier_name !== undefined ? patch.supplier_name : row.supplier_name,
        patch.category !== undefined ? patch.category : row.category,
        patch.receipt_url !== undefined ? patch.receipt_url : row.receipt_url,
        patch.expense_date !== undefined ? patch.expense_date : row.expense_date,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Expense");
      const eupd = expenses.get(id);
      qUpsert("expenses", id, () => eupd);
      return eupd;
    },
    delete(id) {
      qDel("expenses", id);
      engine.runSync("DELETE FROM expenses WHERE id = ?", id);
    },
  };

  const workers = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      const nm = input.name ?? input.display_name ?? "Worker";
      engine.runSync(
        "INSERT INTO workers (id, name, role, phone, display_name, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        nm,
        input.role ?? null,
        input.phone ?? null,
        nm,
        input.notes ?? null,
        t
      );
      const wins = workers.get(id);
      qUpsert("workers", id, () => wins);
      return wins;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM workers WHERE id = ?", id);
    },
    list() {
      return engine.getAllSync("SELECT * FROM workers ORDER BY COALESCE(name, display_name) COLLATE NOCASE");
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = workers.get(id);
      if (!row) throw new LWWConflictError("Worker");
      const t = now();
      const nm = patch.name ?? patch.display_name ?? row.name ?? row.display_name;
      const res = engine.runSync(
        "UPDATE workers SET name = ?, role = ?, phone = ?, display_name = ?, notes = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        nm,
        patch.role !== undefined ? patch.role : row.role,
        patch.phone !== undefined ? patch.phone : row.phone,
        nm,
        patch.notes !== undefined ? patch.notes : row.notes,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Worker");
      const wupd = workers.get(id);
      qUpsert("workers", id, () => wupd);
      return wupd;
    },
    delete(id) {
      qDel("workers", id);
      engine.runSync("DELETE FROM workers WHERE id = ?", id);
    },
  };

  const receipts = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.generated_at ?? now();
      engine.runSync(
        "INSERT INTO receipts (id, payment_id, pdf_url, whatsapp_sent, generated_at) VALUES (?, ?, ?, ?, ?)",
        id,
        input.payment_id,
        input.pdf_url ?? null,
        input.whatsapp_sent ? 1 : 0,
        t
      );
      const row = receipts.get(id);
      qUpsert("receipts", id, () => row);
      return row;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM receipts WHERE id = ?", id);
    },
    getByPaymentId(paymentId) {
      return engine.getFirstSync("SELECT * FROM receipts WHERE payment_id = ?", paymentId);
    },
    update(id, patch) {
      const row = receipts.get(id);
      if (!row) throw new LWWConflictError("Receipt");
      engine.runSync(
        "UPDATE receipts SET pdf_url = ?, whatsapp_sent = ?, generated_at = ? WHERE id = ?",
        patch.pdf_url !== undefined ? patch.pdf_url : row.pdf_url,
        patch.whatsapp_sent !== undefined ? (patch.whatsapp_sent ? 1 : 0) : row.whatsapp_sent,
        patch.generated_at !== undefined ? patch.generated_at : row.generated_at,
        id
      );
      const updated = receipts.get(id);
      qUpsert("receipts", id, () => updated);
      return updated;
    },
    delete(id) {
      qDel("receipts", id);
      engine.runSync("DELETE FROM receipts WHERE id = ?", id);
    },
  };

  const payments = {
    insert(input) {
      const id = input.id ?? newId();
      const ts = input.paid_at ?? input.created_at ?? now();
      engine.runSync(
        "INSERT INTO payments (id, invoice_id, amount, method, created_at, paid_at) VALUES (?, ?, ?, ?, ?, ?)",
        id,
        input.invoice_id,
        input.amount,
        input.method,
        ts,
        ts
      );
      const row = payments.get(id);
      const inv = invoices.get(input.invoice_id);
      const proj = inv ? projects.get(inv.project_id) : null;
      const stub = buildReceiptStubText(row, inv, proj, currentCurrencyCode());
      if (!receipts.getByPaymentId(id)) {
        receipts.insert({ payment_id: id, pdf_url: stub });
      }
      const due = invoiceAmountDue(input.invoice_id);
      if (proj) {
        implicitActivityPost(
          "project",
          proj.id,
          "implicit_payment",
          `Payment ${formatMoneyAmount(row.amount)} (${row.method})`
        );
      }
      if (due < 0.01) {
        const fresh = invoices.get(input.invoice_id);
        if (fresh && String(fresh.status || "").toLowerCase() !== "paid") {
          invoices.update(fresh.id, { status: "paid" }, { expectedUpdatedAt: fresh.updated_at });
        }
      }
      qAppend("payments", id, () => payments.get(id));
      return row;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM payments WHERE id = ?", id);
    },
    listByInvoice(invoiceId) {
      return engine.getAllSync(
        "SELECT * FROM payments WHERE invoice_id = ? ORDER BY COALESCE(paid_at, created_at) ASC",
        invoiceId
      );
    },
    list() {
      return engine.getAllSync("SELECT * FROM payments ORDER BY COALESCE(paid_at, created_at) DESC");
    },
    update() {
      throw new AppendOnlyError("Payment");
    },
    delete() {
      throw new AppendOnlyError("Payment");
    },
  };

  const retainerApplications = {
    insert(input) {
      const id = input.id ?? newId();
      engine.runSync(
        "INSERT INTO retainer_applications (id, invoice_id, retainer_id, amount_applied, applied_at) VALUES (?, ?, ?, ?, ?)",
        id,
        input.invoice_id,
        input.retainer_id,
        Number(input.amount_applied),
        input.applied_at ?? now()
      );
      const ra = retainerApplications.get(id);
      qAppend("retainer_applications", id, () => ra);
      return ra;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM retainer_applications WHERE id = ?", id);
    },
    listByInvoice(invoiceId) {
      return engine.getAllSync(
        "SELECT * FROM retainer_applications WHERE invoice_id = ? ORDER BY applied_at ASC",
        invoiceId
      );
    },
    listByRetainer(retainerId) {
      return engine.getAllSync(
        "SELECT * FROM retainer_applications WHERE retainer_id = ? ORDER BY applied_at DESC",
        retainerId
      );
    },
    applyToInvoice(payload) {
      const ret = retainers.get(payload.retainer_id);
      if (!ret) throw new Error("Client deposit not found");
      const inv = invoices.get(payload.invoice_id);
      if (!inv) throw new Error("Invoice not found");
      const amt = Number(payload.amount_applied);
      if (amt <= 0) throw new Error("Client deposit apply amount must be positive");
      if (amt > Number(ret.balance) + 1e-9) throw new Error("Client deposit apply amount exceeds balance");
      const row = retainerApplications.insert({
        invoice_id: payload.invoice_id,
        retainer_id: payload.retainer_id,
        amount_applied: amt,
        applied_at: payload.applied_at,
      });
      retainers.update(
        payload.retainer_id,
        { balance: Number(ret.balance) - amt },
        { expectedUpdatedAt: ret.updated_at }
      );
      return row;
    },
    update() {
      throw new AppendOnlyError("RetainerApplication");
    },
    delete() {
      throw new AppendOnlyError("RetainerApplication");
    },
  };

  const notifications = {
    insert(input) {
      const id = input.id ?? newId();
      const t = input.updated_at ?? now();
      engine.runSync(
        "INSERT INTO notifications (id, task_id, worker_id, type, status, sent_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        input.task_id ?? null,
        input.worker_id ?? null,
        input.type,
        input.status ?? "pending",
        input.sent_at ?? null,
        t
      );
      const row = notifications.get(id);
      qUpsert("notifications", id, () => row);
      return row;
    },
    get(id) {
      return engine.getFirstSync("SELECT * FROM notifications WHERE id = ?", id);
    },
    listByTask(taskId) {
      return engine.getAllSync("SELECT * FROM notifications WHERE task_id = ? ORDER BY updated_at DESC", taskId);
    },
    /** @returns {boolean} */
    hasOverdueReminderSince(taskId, workerId, sinceTs) {
      const row = engine.getFirstSync(
        "SELECT id FROM notifications WHERE task_id = ? AND worker_id = ? AND type = ? AND COALESCE(sent_at, 0) >= ?",
        taskId,
        workerId,
        NOTIF_TYPE_TASK_OVERDUE_LOCAL,
        sinceTs
      );
      return Boolean(row);
    },
    recordOverdueReminder(taskId, workerId) {
      return notifications.insert({
        task_id: taskId,
        worker_id: workerId,
        type: NOTIF_TYPE_TASK_OVERDUE_LOCAL,
        status: "sent",
        sent_at: now(),
      });
    },
    update(id, patch, { expectedUpdatedAt }) {
      const row = notifications.get(id);
      if (!row) throw new LWWConflictError("Notification");
      const t = now();
      const res = engine.runSync(
        "UPDATE notifications SET task_id = ?, worker_id = ?, type = ?, status = ?, sent_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        patch.task_id !== undefined ? patch.task_id : row.task_id,
        patch.worker_id !== undefined ? patch.worker_id : row.worker_id,
        patch.type ?? row.type,
        patch.status ?? row.status,
        patch.sent_at !== undefined ? patch.sent_at : row.sent_at,
        t,
        id,
        expectedUpdatedAt
      );
      assertChanged(res, "Notification");
      const updated = notifications.get(id);
      qUpsert("notifications", id, () => updated);
      return updated;
    },
    delete(id) {
      qDel("notifications", id);
      engine.runSync("DELETE FROM notifications WHERE id = ?", id);
    },
  };

  const finance = {
    amountDue(invoiceId) {
      return invoiceAmountDue(invoiceId);
    },
    /** Net balance due on the project after unapplied retainer/deposit credit. */
    projectBalanceDueNet(projectId) {
      return computeProjectBalanceDueNet(projectId);
    },
    summary() {
      const invoicesRows = engine.getAllSync("SELECT * FROM invoices");
      const projectIds = new Set(invoicesRows.map((i) => i.project_id));
      let outstanding = 0;
      for (const pid of projectIds) {
        outstanding += computeProjectBalanceDueNet(pid);
      }
      const d = new Date();
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const payRows = engine.getAllSync(
        "SELECT amount FROM payments WHERE COALESCE(paid_at, created_at) >= ? AND COALESCE(paid_at, created_at) <= ?",
        monthStart,
        monthEnd
      );
      const monthlyCollected = payRows.reduce((a, r) => a + Number(r.amount), 0);
      let monthlyExpenses = 0;
      for (const e of expenses.list()) {
        const ts = Number(e.expense_date ?? e.updated_at ?? 0);
        if (ts >= monthStart && ts <= monthEnd) {
          monthlyExpenses += Number(e.amount);
        }
      }
      const monthlyNet = monthlyCollected - monthlyExpenses;
      return {
        outstanding: Math.max(0, outstanding),
        monthlyCollected,
        monthlyExpenses,
        monthlyNet,
        invoiceCount: invoicesRows.length,
      };
    },
    projectProfitRows() {
      const plist = engine.getAllSync(
        "SELECT * FROM projects WHERE archived = 0 ORDER BY name COLLATE NOCASE"
      );
      return plist.map((p) => finance.projectProfit(p.id)).filter(Boolean);
    },
    /** Cash collected (sum of payments on project invoices) minus sum of expenses. */
    projectProfit(projectId) {
      const p = projects.get(projectId);
      if (!p) return null;
      let collected = 0;
      for (const inv of invoices.listByProject(projectId)) {
        for (const pay of payments.listByInvoice(inv.id)) {
          collected += Number(pay.amount);
        }
      }
      const exlist = expenses.listByProject(projectId);
      const spent = exlist.reduce((a, e) => a + Number(e.amount), 0);
      return {
        projectId: p.id,
        projectName: p.name,
        collected,
        spent,
        profit: collected - spent,
      };
    },
    /**
     * Documents ERD: remaining balance should match total_amount − sum(retainer_applications.amount_applied).
     * `balanceStored` is the live column updated on apply; `impliedRemaining` recomputes from applications.
     */
    retainerLedger(retainerId) {
      const row = retainers.get(retainerId);
      if (!row) return null;
      const sumRow = engine.getFirstSync(
        "SELECT COALESCE(SUM(amount_applied), 0) AS s FROM retainer_applications WHERE retainer_id = ?",
        retainerId
      );
      const sumApplied = Number(sumRow?.s ?? sumRow?.S ?? 0);
      const total = Number(row.total_amount);
      const balanceStored = Number(row.balance);
      const impliedRemaining = Math.round((total - sumApplied) * 100) / 100;
      return {
        retainerId,
        totalAmount: total,
        sumApplied,
        balanceStored,
        impliedRemaining,
        balancesMatch: Math.abs(balanceStored - impliedRemaining) < 0.02,
      };
    },
  };

  const appSettings = {
    get(key) {
      const row = engine.getFirstSync("SELECT value FROM app_settings WHERE key = ?", key);
      if (row) {
        const raw = row?.value ?? row?.VALUE ?? row?.Value;
        return raw ?? "";
      }
      if (key === "default_include_vat") return "1";
      if (key === "currency") return DEFAULT_CURRENCY_CODE;
      return "";
    },
    set(key, value) {
      const t = now();
      engine.runSync(
        "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)",
        key,
        String(value ?? ""),
        t
      );
      // Device-local cache keys should not be synced to other devices/backends.
      if (key !== "company_logo_local_url") {
        qUpsert("app_settings", key, () => engine.getFirstSync("SELECT * FROM app_settings WHERE key = ?", key));
      }
    },
    getSnapshot() {
      const rows = engine.getAllSync("SELECT key, value FROM app_settings");
      const m = {};
      for (const r of rows) m[r.key] = r.value;
      return {
        company_name: m.company_name ?? "",
        company_tagline: m.company_tagline ?? "",
        company_logo_url: m.company_logo_url ?? "",
        company_logo_local_url: m.company_logo_local_url ?? "",
        company_address: m.company_address ?? "",
        company_phone: m.company_phone ?? "",
        default_include_vat: m.default_include_vat !== undefined ? m.default_include_vat : "1",
        default_invoice_due_days: m.default_invoice_due_days ?? "",
        currency: normalizeCurrencyCode(m.currency ?? DEFAULT_CURRENCY_CODE),
      };
    },
  };

  return {
    clients,
    suppliers,
    retainers,
    opportunities,
    quotations,
    quotationLineItems,
    projects,
    tasks,
    taskWorkers,
    invoices,
    invoiceLineItems,
    expenses,
    workers,
    payments,
    retainerApplications,
    receipts,
    notifications,
    finance,
    posts,
    syncOutbound,
    appSettings,
  };
}

module.exports = { createRepos, invoiceTotal };
