const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runMigrations,
  createRepos,
  createSqlJsEngine,
  LWWConflictError,
  AppendOnlyError,
  computeInvoiceTotals,
} = require("../src/index.js");

async function openEngine() {
  const sqlJsModule = require("sql.js");
  const initSqlJs = sqlJsModule.default || sqlJsModule;
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const engine = createSqlJsEngine(raw);
  runMigrations(engine);
  return engine;
}

test("Milestone 1 — migrations + CRUD + relationships (sql.js / Node)", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);

  const client = r.clients.insert({ name: "Kampala Supplies", kind: "supplier" });
  assert.ok(client.id);
  const ret = r.retainers.insert({ client_id: client.id, total_amount: 1000, balance: 1000 });
  const opp = r.opportunities.insert({ name: "Roof job", status: "open", client_id: client.id });
  const proj = r.projects.insert({ name: "Project Alpha", budget: 5000, retainer_id: ret.id });
  const task = r.tasks.insert({ project_id: proj.id, status: "todo", due_date: Date.now() });
  const inv = r.invoices.insert({ project_id: proj.id, sub_total: 200, tax: 36 });
  const pay = r.payments.insert({ invoice_id: inv.id, amount: 236, method: "momo" });
  const post = r.posts.insert({ parent_type: "project", parent_id: proj.id, type: "text", body: "On site" });

  assert.equal(r.clients.list().length, 1);
  assert.equal(r.projects.listTasks(proj.id).length, 1);
  assert.equal(r.projects.listInvoices(proj.id).length, 1);
  assert.equal(r.payments.listByInvoice(inv.id).length, 1);
  const projThread = r.posts.listByParent("project", proj.id);
  assert.ok(projThread.some((x) => x.id === post.id && x.body === "On site"));
  assert.equal(
    projThread.filter((x) => x.type === "text").length,
    1
  );

  assert.equal(r.tasks.listByProject(proj.id)[0].id, task.id);
  assert.equal(r.payments.get(pay.id).amount, 236);
  assert.equal(r.posts.get(post.id).body, "On site");

  const updated = r.opportunities.update(opp.id, { status: "won" }, { expectedUpdatedAt: opp.updated_at });
  assert.equal(updated.status, "won");

  assert.throws(() => r.opportunities.update(opp.id, { status: "lost" }, { expectedUpdatedAt: opp.updated_at }), LWWConflictError);

  assert.throws(() => r.payments.update(), AppendOnlyError);
  assert.throws(() => r.posts.delete(), AppendOnlyError);
});

test("Milestone 1 — cascade: deleting project removes tasks, invoices, payments", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const c = r.clients.insert({ name: "C" });
  const p = r.projects.insert({ name: "P" });
  r.tasks.insert({ project_id: p.id, status: "todo" });
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 1, tax: 0 });
  r.payments.insert({ invoice_id: inv.id, amount: 1, method: "cash" });
  r.projects.delete(p.id);
  assert.equal(r.tasks.listByProject(p.id).length, 0);
  assert.equal(r.invoices.listByProject(p.id).length, 0);
  assert.equal(r.payments.listByInvoice(inv.id).length, 0);
  r.clients.delete(c.id);
});

test("Milestone 2 — opportunity value, expenses, workers, finance.summary", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const c = r.clients.insert({ name: "Buyer" });
  const p = r.projects.insert({ name: "Job" });
  const opp = r.opportunities.insert({ name: "Deal", status: "open", value: 1_500_000 });
  assert.equal(Number(opp.value), 1_500_000);
  r.expenses.insert({ project_id: p.id, amount: 100, supplier_name: "S", category: "wood" });
  assert.equal(r.expenses.listByProject(p.id).length, 1);
  r.workers.insert({ display_name: "Alex" });
  assert.equal(r.workers.list().length, 1);
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 500, tax: 90 });
  const s = r.finance.summary();
  assert.ok(typeof s.outstanding === "number");
  r.payments.insert({ invoice_id: inv.id, amount: 590, method: "cash" });
  const s2 = r.finance.summary();
  assert.equal(s2.outstanding, 0);
  r.opportunities.delete(opp.id);
  r.projects.delete(p.id);
  r.workers.list().forEach((w) => r.workers.delete(w.id));
  r.clients.delete(c.id);
});

test("Milestone 2 — cascade: deleting project removes expenses", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const p = r.projects.insert({ name: "P" });
  r.expenses.insert({ project_id: p.id, amount: 10, supplier_name: "x" });
  r.projects.delete(p.id);
  assert.equal(r.expenses.list().length, 0);
});

test("Milestone 7 — line items, retainer apply, receipt on payment, invoice paid", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const c = r.clients.insert({ name: "Client" });
  const ret = r.retainers.insert({ client_id: c.id, total_amount: 500, balance: 500 });
  const p = r.projects.insert({ name: "Job", retainer_id: ret.id });
  const lines = [
    { quantity: 1, unit_price: 1000 },
    { quantity: 2, unit_price: 500 },
  ];
  const totals = computeInvoiceTotals(lines, { includeVat: true });
  assert.equal(totals.subTotal, 2000);
  assert.equal(totals.taxAmount, 360);
  assert.equal(totals.totalAmount, 2360);
  const inv = r.invoices.insert({
    project_id: p.id,
    sub_total: totals.subTotal,
    tax_amount: totals.taxAmount,
    tax: totals.taxAmount,
    tax_rate: totals.taxRate,
    total_amount: totals.totalAmount,
    status: "issued",
  });
  r.invoiceLineItems.replaceForInvoice(inv.id, [
    { description: "Labour", quantity: 1, unit_price: 1000 },
    { description: "Materials", quantity: 2, unit_price: 500 },
  ]);
  assert.equal(r.invoiceLineItems.listByInvoice(inv.id).length, 2);
  r.retainerApplications.applyToInvoice({
    invoice_id: inv.id,
    retainer_id: ret.id,
    amount_applied: 500,
  });
  assert.equal(Number(r.retainers.get(ret.id).balance), 0);
  const dueBefore = r.finance.amountDue(inv.id);
  assert.equal(dueBefore, 1860);
  const pay = r.payments.insert({
    invoice_id: inv.id,
    amount: dueBefore,
    method: "cash",
  });
  const rec = r.receipts.getByPaymentId(pay.id);
  assert.ok(rec && String(rec.pdf_url || "").includes("Payment receipt"));
  assert.equal(String(r.invoices.get(inv.id).status).toLowerCase(), "paid");
  assert.equal(r.finance.amountDue(inv.id), 0);
  r.projects.delete(p.id);
  r.clients.delete(c.id);
});

test("projectBalanceDueNet subtracts unapplied retainer from invoice balance due", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const c = r.clients.insert({ name: "C" });
  const ret = r.retainers.insert({ client_id: c.id, total_amount: 400, balance: 400 });
  const p = r.projects.insert({ name: "P", retainer_id: ret.id });
  const inv = r.invoices.insert({
    project_id: p.id,
    sub_total: 1000,
    tax: 0,
    tax_amount: 0,
    total_amount: 1000,
    status: "issued",
  });
  r.invoiceLineItems.replaceForInvoice(inv.id, [{ description: "Work", quantity: 1, unit_price: 1000 }]);
  assert.equal(r.finance.amountDue(inv.id), 1000);
  assert.equal(r.finance.projectBalanceDueNet(p.id), 600);
  r.retainerApplications.applyToInvoice({
    invoice_id: inv.id,
    retainer_id: ret.id,
    amount_applied: 400,
  });
  assert.equal(r.finance.amountDue(inv.id), 600);
  assert.equal(r.finance.projectBalanceDueNet(p.id), 600);
  r.projects.delete(p.id);
  r.clients.delete(c.id);
});

test("Milestone 10 — sync outbound queue coalesce, append flags, flush stub", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const { flushSyncOutboundQueueStub } = require("../src/syncFlushStub.js");
  const p = r.projects.insert({ name: "SyncP" });
  assert.equal(r.syncOutbound.countPending(), 2);
  const prow = r.projects.get(p.id);
  r.projects.update(p.id, { status: "on_hold" }, { expectedUpdatedAt: prow.updated_at });
  assert.equal(r.syncOutbound.countPending(), 3);
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 10, tax: 0 });
  assert.ok(r.syncOutbound.countPending() >= 2);
  r.payments.insert({ invoice_id: inv.id, amount: 10, method: "cash" });
  const pend = r.syncOutbound.listPending(50);
  assert.ok(pend.some((x) => x.op === "append" && x.entity === "payments"));
  const flags = pend.map((x) => JSON.parse(x.flags_json || "{}"));
  assert.ok(flags.some((f) => f.appendOnly === true));
  assert.ok(flags.some((f) => f.appendOnly === false));
  flushSyncOutboundQueueStub(r.syncOutbound);
  assert.equal(r.syncOutbound.countPending(), 0);
  r.projects.delete(p.id);
});

test("Milestone 11 — overdue tasks, notification dedupe, payment share message", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const { buildPaymentShareMessage, NOTIF_TYPE_TASK_OVERDUE_LOCAL } = require("../src/invoicing.js");
  const p = r.projects.insert({ name: "P11" });
  const past = Date.now() - 86400000;
  const t = r.tasks.insert({ project_id: p.id, title: "Late task", due_date: past, status: "todo" });
  const w = r.workers.insert({ name: "W1" });
  r.taskWorkers.assign(t.id, w.id);
  const ov = r.tasks.listOverdueWithWorkers();
  assert.equal(ov.length, 1);
  assert.equal(ov[0].task.id, t.id);
  assert.equal(ov[0].workers.length, 1);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  assert.equal(r.notifications.hasOverdueReminderSince(t.id, w.id, dayStart.getTime()), false);
  const n = r.notifications.recordOverdueReminder(t.id, w.id);
  assert.equal(n.type, NOTIF_TYPE_TASK_OVERDUE_LOCAL);
  assert.equal(r.notifications.hasOverdueReminderSince(t.id, w.id, dayStart.getTime()), true);
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 100, tax: 0 });
  const pay = r.payments.insert({ invoice_id: inv.id, amount: 100, method: "cash" });
  const msg = buildPaymentShareMessage(
    r.payments.get(pay.id),
    r.invoices.get(inv.id),
    r.projects.get(p.id),
    { name: "Acme Ltd" },
    { includeThankYou: true }
  );
  assert.ok(msg.includes("Acme Ltd"));
  assert.ok(msg.includes("Suggested message to client"));
});

test("Milestone 12 — app_settings + invoice reminder message", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const { buildInvoiceReminderMessage } = require("../src/invoicing.js");
  r.appSettings.set("company_name", "Acme Co");
  assert.equal(r.appSettings.get("company_name"), "Acme Co");
  const snap = r.appSettings.getSnapshot();
  assert.equal(snap.default_include_vat, "1");
  const msg = buildInvoiceReminderMessage({ id: "inv-test-1" }, "Roof job", { name: "Jane" }, "Acme Co", 50000, {});
  assert.ok(msg.includes("50000") || msg.includes("50,000"));
  assert.ok(msg.includes("Acme Co"));
  assert.ok(msg.includes("Jane"));
});

test("Milestone 9 — retainer ledger, assignRetainer, opportunity_id, apply to invoice", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const c = r.clients.insert({ name: "Client R" });
  const opp = r.opportunities.insert({ name: "Deal R", status: "open", client_id: c.id });
  const proj = r.projects.insert({ name: "Job R", opportunity_id: opp.id });
  const ret = r.retainers.insert({
    client_id: c.id,
    total_amount: 1000,
    balance: 1000,
    opportunity_id: opp.id,
  });
  assert.equal(r.retainers.get(ret.id).opportunity_id, opp.id);
  r.projects.assignRetainer(proj.id, ret.id);
  assert.equal(r.projects.get(proj.id).retainer_id, ret.id);
  let led = r.finance.retainerLedger(ret.id);
  assert.ok(led.balancesMatch);
  assert.equal(led.sumApplied, 0);
  const inv = r.invoices.insert({
    project_id: proj.id,
    sub_total: 100,
    tax: 0,
    status: "issued",
  });
  r.retainerApplications.applyToInvoice({
    invoice_id: inv.id,
    retainer_id: ret.id,
    amount_applied: 200,
  });
  led = r.finance.retainerLedger(ret.id);
  assert.ok(led.balancesMatch);
  assert.equal(led.sumApplied, 200);
  assert.equal(led.balanceStored, 800);
  r.projects.delete(proj.id);
  r.retainers.delete(ret.id);
  r.opportunities.delete(opp.id);
  r.clients.delete(c.id);
});

test("Milestone 8 — projectProfit and expenses with supplier_id", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const sup = r.suppliers.insert({ name: "Vendor", category: "timber" });
  const p = r.projects.insert({ name: "Site" });
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 800, tax: 0 });
  r.payments.insert({ invoice_id: inv.id, amount: 800, method: "cash" });
  let row = r.finance.projectProfit(p.id);
  assert.equal(row.profit, 800);
  r.expenses.insert({
    project_id: p.id,
    supplier_id: sup.id,
    amount: 250,
    category: "boards",
  });
  row = r.finance.projectProfit(p.id);
  assert.equal(row.spent, 250);
  assert.equal(row.profit, 550);
  const rows = r.finance.projectProfitRows();
  assert.ok(rows.some((x) => x.projectId === p.id && x.profit === 550));
  r.projects.delete(p.id);
  r.suppliers.delete(sup.id);
});

test("Milestone 6 — finance.summary monthly expenses and net", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const p = r.projects.insert({ name: "Job" });
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 200, tax: 0 });
  r.payments.insert({ invoice_id: inv.id, amount: 200, method: "cash" });
  r.expenses.insert({ project_id: p.id, amount: 50, category: "fuel" });
  const s = r.finance.summary();
  assert.ok(typeof s.monthlyExpenses === "number");
  assert.ok(typeof s.monthlyNet === "number");
  assert.ok(s.monthlyExpenses >= 50);
  assert.ok(s.monthlyCollected >= 200);
  r.projects.delete(p.id);
});

test("Milestone 5 — post with author_id and listByParent", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const p = r.projects.insert({ name: "Site" });
  const w = r.workers.insert({ name: "Alex" });
  const post = r.posts.insert({
    parent_type: "project",
    parent_id: p.id,
    type: "text",
    body: "On site",
    author_id: w.id,
  });
  assert.equal(r.posts.get(post.id).author_id, w.id);
  const thread = r.posts.listByParent("project", p.id);
  assert.equal(thread.length, 2);
  assert.ok(thread.some((x) => x.body === "On site" && x.type === "text"));
  assert.ok(thread.some((x) => String(x.type || "").startsWith("implicit_")));
  r.projects.delete(p.id);
  r.workers.delete(w.id);
});

test("Milestone 4 — task insert defaults status todo", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const p = r.projects.insert({ name: "P" });
  const t = r.tasks.insert({ project_id: p.id });
  assert.equal(t.status, "todo");
  const row = r.tasks.get(t.id);
  r.tasks.update(t.id, { status: "done" }, { expectedUpdatedAt: row.updated_at });
  assert.equal(r.tasks.get(t.id).status, "done");
  r.projects.delete(p.id);
});

test("Quotation line items — replace and list", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const opp = r.opportunities.insert({ name: "Quote lines", status: "Prospecting" });
  const q = r.quotations.insert({
    opportunity_id: opp.id,
    status: "draft",
    sub_total: 150,
    tax_amount: 27,
    total_amount: 177,
  });
  r.quotationLineItems.replaceForQuotation(q.id, [
    { description: "Widget", quantity: 2, unit_price: 75 },
  ]);
  const lines = r.quotationLineItems.listByQuotation(q.id);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].description, "Widget");
  assert.equal(Number(lines[0].quantity), 2);
  assert.equal(Number(lines[0].unit_price), 75);
  r.opportunities.delete(opp.id);
});

test("Milestone 3 — accept quotation links project", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const opp = r.opportunities.insert({ name: "Roof", status: "Prospecting" });
  const q = r.quotations.insert({
    opportunity_id: opp.id,
    status: "draft",
    sub_total: 1000,
    tax_amount: 180,
    total_amount: 1180,
  });
  const proj = r.projects.insert({
    name: "Roof",
    opportunity_id: opp.id,
    budget: 1180,
    status: "active",
  });
  const row = r.quotations.get(q.id);
  const updated = r.quotations.update(
    q.id,
    { status: "accepted", project_id: proj.id },
    { expectedUpdatedAt: row.updated_at }
  );
  assert.equal(updated.status, "accepted");
  assert.equal(updated.project_id, proj.id);
  assert.equal(r.projects.get(proj.id).opportunity_id, opp.id);
});

test("Milestone 3 — retainer_applications are append-only", async () => {
  const engine = await openEngine();
  const r = createRepos(engine);
  const c = r.clients.insert({ name: "C" });
  const ret = r.retainers.insert({ client_id: c.id, total_amount: 100, balance: 100 });
  const p = r.projects.insert({ name: "P" });
  const inv = r.invoices.insert({ project_id: p.id, sub_total: 50, tax: 0 });
  r.retainerApplications.insert({ invoice_id: inv.id, retainer_id: ret.id, amount_applied: 10 });
  assert.throws(() => r.retainerApplications.update(), AppendOnlyError);
  assert.throws(() => r.retainerApplications.delete(), AppendOnlyError);
  r.projects.delete(p.id);
  r.retainers.delete(ret.id);
  r.clients.delete(c.id);
});
