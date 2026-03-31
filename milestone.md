# Field Operations Platform — Milestones

> Phased delivery derived from the [Full Design Plan](app_design.md). Each milestone should be shippable; later milestones assume earlier ones are stable.

**Cross-platform rule:** All milestones assume a **single monorepo** and progress toward **Android, iOS, Web, Windows, Linux, and macOS**. Where a capability is mobile-only (e.g. hold-to-record), **web and desktop must degrade gracefully** (click-to-record, file picker, or explicit “not available” with text/OCR path) — never block core CRUD on a platform.

---

## Progress snapshot

**Shipped today (covers M0–M12 settings & invoice reminders, M11 automations, M10 sync queue & media compression, M9 retainers depth, M8 expenses & suppliers, M7 invoicing, M6 Finance cards, M5 Updates, M4 projects/tasks, M3 Flow A, plus M1–M2 breadth):**

- **Monorepo & platforms:** `@lunabms/core` + Expo FieldOps; **expo-sqlite** on native; **sql.js** on web (`DatabaseContext.web.js`); same migrations and `createRepos` everywhere; `PRAGMA foreign_keys = ON`; Node tests via sql.js.
- **Schema:** SQLite migrations **through v9** — [ERD §6](app_design.md#6-data-layer-plan-schema--persistence) (v3–v8 as before); **v9** **`app_settings`** (company profile + invoice defaults). **`appSettings`** repo; **`buildInvoiceReminderMessage`** for WhatsApp overdue flows.
- **IA (M2):** Bottom tabs and drawer routes with FABs; **responsive / collapsible drawer** at wide viewports; **empty lists** use **SVG illustrations**, supporting copy, and a **primary CTA** (not plain “No … yet” only).
- **Pipeline & Flow A (M3):** Stack **`pipeline/index`** + **`pipeline/[id]`**; quotations and **Accept → project**; alert can **deep-link to `projects/[id]`** for the new project.
- **Projects & tasks (M4):** Stack **`projects/index`** + **`projects/[id]`**. List rows open detail. **Shell header** (fixed above scroll): status, budget, linked **opportunity** name, **retainer balance** when `retainer_id` is set, **days left / past** from **`end_date`**, **task progress** bar. **SectionList** groups **To do** vs **Done** (sticky section headers). **Done** marks task **`done`** (LWW). **+ Add task** modal (title, optional due in N days, priority). Core: **`tasks.insert` defaults `status` to `open`**.
- **Updates / Flow C (M5):** **Scoped feed** — **All**, **by project**, or **by opportunity** (filters + parent chips). **`PostBubble`**: initial, **author** (worker or Unattributed), **timestamp**, body/transcript, **parent** pill. Compose: optional **`author_id`**. Chronological list; posts remain **append-only** in core.
- **Contacts:** **Phone**, **email**, **notes** (optional) on create; richer list preview.
- **Finance (M6–M7):** **This month** / **Outstanding** / sub-tabs as in M6. **New invoice:** multi-**line items**, **Include 18% VAT** toggle (`computeInvoiceTotals` / `UGANDA_VAT_RATE` in core), optional **due in N days**, **retainer credit** when project has `retainer_id` (`retainerApplications.applyToInvoice` updates **balance**). **Outstanding / balance** use **`finance.amountDue`** (invoice total − payments − retainer applications). **Payment:** auto **`receipts`** row with **plain-text stub** (`buildReceiptStubText`); **Share** + **WhatsApp** (`wa.me`) from alert; invoice **`paid`** when amount due reaches zero. **Projects → Done task:** **Invoice** jumps to Finance with **prefilled line** (task title). **Not in M7:** real PDF binary, dedicated email composer, post-save invoice line edit.
- **Expenses & suppliers (M8):** Drawer **Suppliers** (`suppliers.js`): list + **FAB** (name, category, contact). **New expense:** project, **Informal** vs **linked supplier** (chips + **+ New** inline modal), category, amount, optional **receipt photo** (**camera** or **library** via `expo-image-picker`; native **resize + JPEG** via **`expo-image-manipulator`** then copy to **`documentDirectory/expense-receipts/`**, **web** stores picker URI). **`FinanceCard`** optional **receipt thumbnail**. **Profit:** **`finance.projectProfit(projectId)`** and **`projectProfitRows()`** (payments in − expenses out); **Reports** uses **cards** + **navigate to project**; **project shell** shows **Est. profit** line. **M8.1 / gaps:** OCR, expense VAT toggle, durable web receipt blobs.
- **Retainers (M9):** Drawer **stack** **`retainers/index`** + **`retainers/[id]`**. **New retainer:** client, optional **opportunity** (same client), optional **project link** (unlinked projects only) via **`assignRetainer`**. **Detail:** balance / total / status, **`finance.retainerLedger`** (Σ applied vs implied remaining vs stored balance), linked **opportunity** & **projects**, **application history**, **link/unlink project** modal, **status** edit. **M7 invoice apply** unchanged; **M9 test** covers ledger + apply end-to-end.
- **Automations (M11):** Core **`tasks.listOverdueWithWorkers`**, **`notifications.hasOverdueReminderSince`** / **`recordOverdueReminder`** (type **`task_overdue_local`**, deduped per calendar day). **`buildPaymentShareMessage`** appends optional client thank-you when **`opportunity → client`** exists. **FieldOps:** **`expo-notifications`** local alerts on **iOS/Android** when the app opens or resumes (assigned workers only); **web** skips OS alerts (documented in **Settings**). **Finance:** payment modal toggle for thank-you line.
- **Drawer depth & polish (M12):** **`app_settings`** + **Settings** screen: company name/address/phone, default **Include VAT** and **due in days** for new invoices. **Finance** overdue invoice rows: **WhatsApp reminder** (`buildInvoiceReminderMessage` + client phone when known). **Project detail:** **Assign** worker per task (**`task_workers`**) for M11 reminders. **PDF** on reminders: placeholder text until document generation exists.

**Gaps vs milestone definitions (honest):**

- **M3 refinements:** No separate **quotation PDF / email** flow; no multi-line **quote line items**; conversion is **per quotation** (multiple projects per opportunity allowed by schema).
- **M4 refinements:** No **Kanban columns** (only **To do / Done** sections); **start_date** not surfaced in header; **Assign** on project detail links **`task_workers`** (workers from **Team**); **reopen** task not in UI.
- **M5 refinements:** No **voice/camera** (M5.1); no inverted **newest-at-bottom** thread; no signed-in **current user** for auto-attribution.
- **M10.1 / gaps:** No live **PostgreSQL** push or object-storage upload; web receipt still not a compressed blob in app storage.
- **M11.1 / gaps:** No **FCM/APNs** remote push or **web push**; overdue reminders are **local** on native only; no OCR on expenses.
- **M12.1 / gaps:** No **invoice PDF binary** or hosted PDF link on reminders; company **logo** not stored; expense-level VAT toggle still deferred.

### Recommended next milestone

Further product milestones beyond M12 — e.g. **invoice PDF generation**, **server sync**, **OCR** — as separate epics.

---

## Milestone 0 — Project skeleton

**Goal:** **Single-repo** layout, **multi-platform** CI, and a thin vertical slice on **at least one mobile target plus web** (other platforms stubbed or compiling).

- **Monorepo:** shared packages for domain types, sync DTOs, validation, and (where applicable) UI primitives; thin **platform shells** only for embedding, permissions, and OS APIs.
- **Developer OS parity:** documented setup so **Windows, Linux, and macOS** can install deps and run the same scripts (no hardcoded drive letters or mac-only paths in shared automation).
- App shell: bottom navigation placeholders, left drawer scaffold (empty or stub items) — **responsive** on web/desktop per [design system](designsystem.md).
- **CI matrix:** build or compile checks for **Android · iOS · Web · Windows · Linux · macOS** (iOS/macOS runners as required by stack); fail fast on shared package breakage.
- Build pipeline, environments (dev/stage/prod), basic analytics/crash hooks if applicable.
- Chosen stack wired for **offline-first** direction (local DB client ready even if sync is stubbed) on **mobile and desktop**; web uses the agreed offline strategy (e.g. persisted local DB or explicit MVP “online-first” with ticket to parity).

**Exit criteria:** Installable or runnable artifacts for the **agreed MVP subset of platforms** (minimum: one mobile + web); remaining platforms compile or are explicitly gated with issues; navigate between four bottom tabs and open the drawer without crashes on each delivered target.

---

## Milestone 1 — Data model & local persistence

**Goal:** Core entities exist locally with relationships aligned to the schema plan.

- Implement entities: `Opportunity`, `Project`, `Task`, `Invoice`, `Payment`, `Retainer`, `Post` (minimal fields first).
- **SQLite** with migrations via **one shared schema definition** consumed by all platforms (platform-specific drivers only — not duplicate DDL per OS).
- **Conflict strategy documented in code:** last-write-wins for simple fields; append-only for `Posts`, `Payments`, and `RetainerApplication` (even if sync is not live yet).
- **Schema:** Migrations **v3–v9** on top of the ERD in [app_design.md §6](app_design.md#6-data-layer-plan-schema--persistence): **v3–v8** as listed in prior milestones; **v9** (**`app_settings`** key-value store).

**Exit criteria:** CRUD smoke tests for each entity on **at least two platforms** (e.g. Android + web or iOS + desktop); relationships queryable (e.g. project → tasks, project → invoices).

---

## Milestone 2 — Navigation & role-oriented IA

**Goal:** Information architecture matches the design — daily drivers vs. setup.

- **Bottom nav:** Pipeline, Projects, Updates, Finance — each lands on a real list/empty state.
- **Drawer:** Contacts, Team, Retainers, Reports, Settings — list screens or placeholders with correct labels.
- Screen summary behaviours: correct **FAB** labels per tab (`+ New Opp`, `+ New Project`, `+ Post`, `+ Expense / Invoice` pattern).
- **Empty states:** illustration + headline + body copy + **CTA** aligned to the screen’s primary action (see [Progress snapshot](#progress-snapshot)).

**Exit criteria:** No dead tabs; FAB present and labeled per [Screen Summary Table](app_design.md#screen-summary-table) on **phone and tablet/web widths** (drawer accessible via pattern appropriate to form factor — see [design system](designsystem.md)); empty lists meet the illustration + message + CTA bar above.

---

## Milestone 3 — Pipeline: Lead → Project (Flow A)

**Goal:** Sales loop from opportunity to project creation.

- Create and list opportunities; status and client link.
- **Shipped:** Pipeline tab is a **stack** (`pipeline/index` + `pipeline/[id]`). **Opportunity detail:** summary + **quotations** list. **New quotation** (draft: sub-total, tax, total preview). **Mark sent** / **Reject** / **Accept → create project** (`project.opportunity_id`, `quotation.project_id`, `accepted`). **Handoff:** alert with **View project** → **`/projects/[id]`** (or stay on opportunity).
- **Optional later:** quote line items, PDF, email/WhatsApp send, enforce single-won project per opportunity.

**Exit criteria:** User can complete [Flow A — Lead to Project](app_design.md#flow-a--lead-to-project-the-sales-loop) on **a primary field device** (online acceptable if sync not ready); **web/desktop** can complete the same flow with keyboard/mouse (no mobile-only gate).

---

## Milestone 4 — Projects: tasks & project shell

**Goal:** Where work happens — project detail and task execution surface.

- **Shipped:** **Projects** tab is a **stack** (`projects/index` + `projects/[id]`). List keeps **progress + overdue** on each row; **tap** opens detail. **Shell header** (fixed, not scrolling with tasks): **status**, **budget**, **opportunity** link line, **retainer balance** (when linked), **schedule hint** from **`end_date`**, **task progress** bar. **Tasks:** **SectionList** **To do** / **Done**, sticky section titles; **Done** button → `status: done`; **+ Add task** FAB. Repos default **`tasks.status`** to **`open`** when omitted.
- **Optional later:** true Kanban columns, task **assignees**, edit/reopen task, edit project **dates** from UI.

**Exit criteria:** Open project → see header + tasks; mark task complete.

---

## Milestone 5 — Updates: Post feed (Flow C)

**Goal:** WhatsApp-style progress capture linked to work.

- **Shipped:** Feed **scoped** with **All / Project / Opportunity**; thread uses **`listByParent`** when filtered. **`PostBubble`** UI (avatar, author, time, body, parent tag). **Optional `author_id`** from **Team** list in compose modal. Text posts only; **append-only** unchanged.
- **Deferred (M5.1):** **Voice** and **camera** post types; true **newest-at-bottom** inverted thread; “me vs them” bubble alignment.

**Exit criteria:** [Flow C — The Post System](app_design.md#flow-c--the-post-system-the-whatsapp-logic) works for at least text posts; feed survives app restart.

---

## Milestone 6 — Finance tab: structure & status cards

**Goal:** Finance pillar UI and navigation.

- **Shipped:** **This month** header (**Collected | Expenses | Net**) from **`finance.summary()`**; **Outstanding** strip; **Invoices / Expenses / Payments** sub-tabs with **`FinanceCard`** list rows (`financeExpense` / `financePayment` tokens + **amber** for overdue). Invoice rows: balance vs total, paid/overdue tone, status badge. Expense and payment rows with project/context lines. Modals and FAB chooser unchanged.
- Header: revenue vs expenses (net) for **this month** (real aggregates in core for current calendar month).
- Sub-tabs: Invoices, Expenses, Payments with **Finance Card** pattern and colour semantics (red / green / amber).
- FAB routes to create invoice, expense, or payment per context.

**Exit criteria:** [Finance Tab Navigation Logic](app_design.md#finance-tab-navigation-logic) reflected in UI; scannable rows match the design intent.

---

## Milestone 7 — Invoicing & collection (Finance Flow A + Task loop)

**Goal:** Money in — from project/task context where applicable.

- **Shipped:** **`invoice_line_items`** + **`invoiceLineItems.replaceForInvoice`**. **New invoice** UI: line items (description, qty, unit UGX), live **net / VAT / total** preview, **18% VAT** on/off, optional **due date** (days ahead), **apply retainer** capped by balance and invoice total. **`finance.amountDue`** and **`finance.summary().outstanding`** subtract **payments + retainer applications**. **`payments.insert`** creates **`receipts`** with **text stub** and sets invoice **`paid`** when due is cleared. **Project detail:** completed tasks show **Invoice** → Finance with **params** `invoiceProjectId` / `invoiceTaskTitle`. Core exports **`computeInvoiceTotals`**, **`UGANDA_VAT_RATE`**, **`buildReceiptStubText`**.
- Create invoice: project/client, line items, **18% VAT toggle** with client-side net calculation.
- Retainer application at invoice time when balance exists.
- Mark paid → **receipt** generation (plain-text stub + share; **PDF file deferred**); **WhatsApp** opens `wa.me` with prefilled text.
- Tie-in: invoice from **completed task** row ([Flow B](app_design.md#flow-b--task-to-payment-the-execution-loop) handoff).

**Exit criteria:** [Finance Flow A](app_design.md#finance-flow-a--invoicing--collection-loop) and payment → paid transition with receipt artifact.

---

## Milestone 8 — Expenses & suppliers (Finance Flow B)

**Goal:** Money out — project-linked costs.

- **Shipped:** Drawer **Suppliers** screen; expense form with **`supplier_id`** or **informal** name, **category**, **receipt photo** (optional; no OCR). **`persistExpenseReceiptImage`** for native persistence. **Reports** profitability **cards** + deep link to **project**; **`finance.projectProfit`** on **project detail** shell. Core test for **profit vs expenses** with **supplier_id**.
- Create expense: amount, supplier, category, project link.
- **Receipt photo** capture; OCR pipeline optional in M8.1 — manual entry must work without OCR.
- Expense affects **project profit** calculation client-side.

**Exit criteria:** [Finance Flow B](app_design.md#finance-flow-b--expense--supplier-loop) complete without OCR if OCR is deferred.

---

## Milestone 9 — Retainers (Finance Flow C)

**Goal:** Stored value and application at invoicing.

- **Shipped:** **v7** optional **`retainers.opportunity_id`**. **Drawer stack** list + **detail** (`assignRetainer`, **`listByRetainer`**). **Create:** initial deposit = **total** & **balance**, optional **opportunity** + **project** link. **Detail:** **`finance.retainerLedger`** documents **total − Σ(applications) = implied remaining** vs **`balance`** column; applications list; link/unlink project; **status** LWW. **Core test** exercises **applyToInvoice** + ledger consistency.
- Drawer: Retainers list and detail.
- Create retainer linked to opportunity/project; record initial payment; show active balance.
- Integration with invoice flow (apply credit) already in M7 — verify end-to-end.

**Exit criteria:** [Finance Flow C](app_design.md#finance-flow-c--retainer--deposit-loop) + remaining balance formula documented and tested.

---

## Milestone 10 — Sync, media, and offline hardening

**Goal:** Production-shaped data path for field use.

- Background **sync queue**: local writes immediate, push to PostgreSQL when online.
- **Media:** compress images on device; upload to object storage on Wi-Fi / strong mobile as policy allows.
- Reconcile conflict rules with server.

**Shipped in this repo:**

- **`sync_outbound_queue`** (migration **v8**), **`createSyncOutboundQueue`** / repo hooks in **`repos.js`**, **`flushSyncOutboundQueueStub`**. **Settings** shows **pending/failed** counts and **Simulate sync push** (stub).
- **`SYNC_RECONCILIATION`** + IndexedDB note for web in **`conflictPolicy.js`** / Settings copy.
- **Expense receipts (native):** **`expo-image-manipulator`** resize (max width 1600) + JPEG quality ~0.82 before **`documentDirectory/expense-receipts/`** copy.

**Exit criteria:** Offline create/edit for non-append-only entities queues correctly; posts/payments never silently overwritten on **every platform that claims offline-first** (document any web exception).

**Web exception:** SQLite persists via **IndexedDB** in `DatabaseContext.web.js` (session-surviving, not ephemeral); object-storage upload and true multi-tab sync are still out of scope.

---

## Milestone 11 — Automations & notifications

**Goal:** Invisible assistant — within human-confirm rules.

- Overdue task notifications to assigned workers (**FCM/APNs** on mobile; **web push** or in-app-only on web as agreed; **desktop** OS notifications where supported).
- Payment recorded → receipt + optional thank-you template to client (share via **platform share sheet** or download on web/desktop).

**Shipped in this repo (MVP):**

| Design trigger | Delivered |
|----------------|-----------|
| Overdue task → assigned worker | **Local** notifications on **iOS/Android** when app is opened or returns to foreground; **`task_workers`** required; deduped via **`notifications`** + **`NOTIF_TYPE_TASK_OVERDUE_LOCAL`**. **Web:** no OS alerts (see Settings). **Remote FCM/APNs** deferred. |
| Payment → receipt + thank-you | **`buildPaymentShareMessage`** + Finance toggle; share sheet unchanged. |

**Exit criteria:** [Automations table](app_design.md#automations--the-invisible-assistant) implemented or explicitly deferred with tickets; no silent financial writes; notification path documented **per platform** (including “none on web MVP” if scoped).

---

## Milestone 12 — Drawer depth & polish

**Goal:** Owner workflows and reporting.

- Contacts (clients & suppliers), Team (workers & assignments), Reports (project profitability), Settings (tax/VAT defaults, company profile).
- **One-tap overdue reminder** (WhatsApp pre-fill + PDF link) for invoices.
- UX pass: mobile-first performance, empty states, error states.

**Shipped in this repo:**

- **Settings:** persisted **`app_settings`** — company name, address, phone; **default Include 18% VAT**; **default due in (days)** for new invoices. **Finance** reads defaults when opening **New invoice** (including deep link from project).
- **Overdue invoices:** **WhatsApp reminder** button on **Finance → Invoices** when status is overdue and balance &gt; 0; **prefilled** `buildInvoiceReminderMessage` (company name from settings; client from **opportunity → client**; **PDF** line is placeholder until PDF generation exists). Uses **`wa.me`** with client phone when **digits ≥ 8**, else generic compose.
- **Tasks:** **Assign** on project detail links **`task_workers`** (workers from **Team**).

**Exit criteria:** [Smart Logic Shortcuts](app_design.md#smart-logic-shortcuts) and drawer items usable for pilot businesses.

---

## Suggested sequencing note

Milestones **3–5** can partially overlap with **6–9** if staffed in parallel, but **Finance** depends on **Projects** (and **Retainers** on **Invoices**). **M10** should start early as **spikes** but lands hard after core CRUD is stable.

**Platform matrix:** Do not leave **Windows / Linux / macOS / Web** to the end; keep them **compiling in CI from M0** and widen functional tests each milestone so adapter drift does not accumulate.

---

*Aligned with app design document v2.1. Progress snapshot reflects codebase as of implementation through SQLite **v9**, FieldOps UI through **M12**, as described above.*
