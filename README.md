# Luna BMS — Field Operations Platform

JavaScript **monorepo**: shared `@lunabms/core` plus **Expo (SDK 52)** app **@lunabms/fieldops** for **Android, iOS, and Web** from one codebase. **Windows, Linux, and macOS** use the same `npm` scripts for install, tests, and web export.

## Requirements

- **Node.js** ≥ 18.18 (CI uses 20)
- **npm** (workspaces)
- For **iOS** simulators or devices: **Xcode** (macOS only)
- For **Android** emulators or devices: **Android Studio** / SDK

## Setup (any OS)

```bash
git clone <repo-url> luna-bms
cd luna-bms
npm install
```

Path separators and line endings: use forward slashes in docs; `.gitattributes` keeps LF for text files on Windows clones.

## Run the app

```bash
# Dev server (choose platform in terminal UI)
npm run fieldops:start

# Or directly
npm run web -w @lunabms/fieldops
npm run android -w @lunabms/fieldops
npm run ios -w @lunabms/fieldops
```

## Dockerized Django API (multi-tenant sync backend)

Run backend + Postgres:

```bash
npm run backend:up
```

API base URL: `http://localhost:8000`

Endpoints:

- `POST /api/auth/register/` with `business_name`, `email`, `password`
- `POST /api/auth/login/` with `business_name`, `email`, `password`
- `POST /api/auth/token/refresh/` with `refresh`
- `POST /api/sync/push/` (JWT + tenant business_name)
- `GET /api/sync/pull/?business_name=...&cursor=...`

The backend keeps per-tenant incremental sync history and applies mutable entities using last-write-wins (`lww_ts`), while append-only entities (`posts`, `payments`, `retainer_applications`) remain append-only.

## Milestone 0 scope

- Bottom tabs: **Pipeline**, **Projects**, **Updates**, **Finance**
- Drawer: **Contacts**, **Suppliers**, **Team**, **Retainers**, **Reports**, **Settings**
- **Responsive drawer**: permanent sidebar at viewport width ≥ 900px (web/desktop)

## Milestone 1 — local data model

- **Single SQLite schema** in `@lunabms/core` (`src/sqlite/migrations.js`): `clients`, `opportunities`, `projects`, `tasks`, `invoices`, `payments`, `retainers`, `posts` (+ `schema_migrations`).
- **`PRAGMA foreign_keys = ON`** applied in `runMigrations` so cascades match the design.
- **Repositories** (`createRepos`): LWW updates via `expectedUpdatedAt` on mutable rows; **payments** and **posts** are **append-only** (updates throw `AppendOnlyError`).
- **Platform 1:** automated CRUD + relationship tests using **sql.js** (Node).
- **Platform 2:** **expo-sqlite** on **iOS / Android** — same migrations and repos; lists bind to **Pipeline / Projects / Finance / Updates / Retainers** screens (`DatabaseProvider` in `app/_layout.js`).
- **Web:** `expo-sqlite` has no web native module (`ExpoSQLite`). The app uses **`DatabaseContext.web.js`**: **sql.js** (WASM) + the same `runMigrations` / `createRepos` from `@lunabms/core`. WASM may load from the bundled asset or sql.js CDN depending on the build.

## Milestone 2 — navigation & IA

- **Bottom tabs** show real **lists + empty states** and **FABs** aligned with the [screen summary](app_design.md#screen-summary-table): **+ New Opp**, **+ New Project**, **+ Post**, **+ Invoice / Expense** (opens **Invoice / Expense / Payment** chooser).
- **Pipeline:** name, **value (UGX)**, status, optional client; **Projects:** progress bar + overdue task count + budget; **Finance:** **Outstanding** + **collected this month**, sub-segments **Invoices / Expenses / Payments**; **Updates:** post linked to opportunity or project.
- **Drawer:** **Contacts** & **Suppliers** & **Team** & **Retainers** support **add** via FAB; **Reports** lists **per-project profit** (payments − expenses); **Settings** includes **M10** outbound sync counts + stub flush; tax/company profile remains **M12**.
- **Schema v2** (`migrations.js`): `opportunities.value`, **`expenses`**, **`workers`**; **`repos.finance.summary()`** and **`projectProfitRows()`**.

## Milestone 3 — Flow A (lead → project)

- **Pipeline** tab uses a **stack**: list at `pipeline/index`, **opportunity detail** at `pipeline/[id]` (tap a row).
- **Quotations** on an opportunity: **draft** (sub-total + tax), optional **Mark sent**, **Reject**, or **Accept** — creates a **`project`** with `opportunity_id`, sets **`quotations.project_id`**, then optional **View project** → **`projects/[id]`**.
- See [milestone.md](milestone.md) for full criteria and gaps (e.g. no quote PDF yet).

## Milestone 4 — Project shell & tasks

- **Projects** tab is a **stack**: `projects/index` (list) and **`projects/[id]`** (detail).
- **Detail:** fixed **summary** (budget, opportunity, retainer balance, **days to/past end_date**, task progress), **To do / Done** sections, **mark Done**, **+ Add task** (title, due in N days, priority).
- **`tasks.insert`** in core defaults **`status`** to **`open`** if omitted.

## Milestone 5 — Updates feed (Flow C)

- **Updates** tab: **All** recent posts or filter by **project** / **opportunity** (pick parent chips).
- **`PostBubble`**: editorial-style bubble with **initial**, **author** (worker or unattributed), **timestamp**, **message**, **parent** pill.
- **New post:** link to project or opportunity, optional **posted by** (sets `author_id`); text only for now.

## Milestone 6 — Finance structure & status cards

- **Finance** tab: **This month** — **Collected**, **Expenses**, **Net**; **Outstanding**; sub-tabs **Invoices / Expenses / Payments** with **`FinanceCard`** rows and **red / green / amber** semantics; FAB opens **Invoice / Expense / Payment** chooser.
- Core: **`finance.summary()`** includes **`monthlyExpenses`** and **`monthlyNet`** (calendar month, aligned with collected).

## Milestone 7 — Invoicing & collection

- **Schema v6:** **`invoice_line_items`**; **`invoiceLineItems`** repo; **`finance.amountDue(invoiceId)`** (total − payments − retainer credits).
- **Invoice compose:** line items, **18% VAT** toggle (`computeInvoiceTotals`, **`UGANDA_VAT_RATE`**), optional due-in-days, **`retainerApplications.applyToInvoice`** (reduces **retainer.balance**).
- **Payment:** **`receipts`** auto-created with **text stub** (`buildReceiptStubText`); **Share** / **WhatsApp** stub in-app; invoice **`paid`** when fully settled.
- **Flow B tie-in:** **Done** tasks on **`projects/[id]`** offer **Invoice** → Finance with prefilled first line.

## Milestone 8 — Expenses & suppliers (Finance Flow B)

- **Drawer → Suppliers:** list + **FAB** (`repos.suppliers`).
- **Finance → New expense:** **Informal** or linked **supplier**, category, amount; optional **receipt** via **`expo-image-picker`** (camera/library); **`expo-file-system`** copies images under **`documentDirectory/expense-receipts/`** on native; **web** keeps the picker URI (best-effort).
- **`finance.projectProfit(projectId)`** / **`projectProfitRows()`**; **Reports** screen shows profit **cards** (tap → project); **project detail** shows **Est. profit**.

## Milestone 9 — Retainers (Finance Flow C)

- **Schema v7:** **`retainers.opportunity_id`** (optional FK to **opportunities**).
- **Drawer → Retainers:** stack **`retainers/index`** (list + **FAB**: client, deposit, optional **opportunity** / **project** link) and **`retainers/[id]`** (balance, **`finance.retainerLedger`**, applications, link/unlink **project** via **`projects.assignRetainer`**).
- **`projects.listByRetainer`** / **`assignRetainer`** (one project per retainer in UI by clearing others).

## Milestone 10 — Sync queue & receipt compression

- **Schema v8:** **`sync_outbound_queue`**; LWW upserts coalesce to one pending row per entity+id; **append** rows for **posts**, **payments**, **retainer applications** with **`flags_json.appendOnly`**. **`flushSyncOutboundQueueStub`** (exported from **`@lunabms/core`**) processes pending rows until a real server sync exists.
- **FieldOps → Settings:** outbound **pending/failed** counts and **Simulate sync push**. **`SYNC_RECONCILIATION`** in core documents server-side LWW vs append-only rules; **web** SQLite is **IndexedDB**-backed (see `DatabaseContext.web.js`).
- **Native expense receipts:** **`expo-image-manipulator`** (resize + JPEG) before copy to **`expense-receipts/`**; **web** unchanged (picker URI).

## Milestone 11 — Automations & notifications

- **Overdue tasks:** **`tasks.listOverdueWithWorkers`** + **`notifications.hasOverdueReminderSince`** / **`recordOverdueReminder`** (`NOTIF_TYPE_TASK_OVERDUE_LOCAL`). **FieldOps** uses **`expo-notifications`** (local only) when the app opens or resumes on **iOS/Android**; **web** has no OS task alerts (documented in **Settings**). Remote **FCM/APNs** not wired.
- **Payments:** **`buildPaymentShareMessage`** extends the receipt stub with an optional **client thank-you** line when the invoice’s project → opportunity → **client** chain exists; **Finance → Record payment** toggle.

## Milestone 12 — Settings & invoice reminders

- **Schema v9:** **`app_settings`**; **`repos.appSettings`** (`get` / `set` / **`getSnapshot`**). **Settings** screen: company profile + default **Include VAT** + **due in days** for new invoices.
- **Finance:** **WhatsApp reminder** on **overdue** unpaid invoice cards; **`buildInvoiceReminderMessage`** from **`@lunabms/core`**; PDF line is a placeholder until invoice PDFs exist.
- **Projects:** **Assign** links a **Team** worker to a task (`task_workers`) for overdue local notifications.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm test` | Workspace tests (`@lunabms/core`, SQLite / milestone regression tests) |
| `npm run ci` | Tests + static web export |
| `npm run fieldops:export-web` | Production-shaped web bundle → `apps/fieldops/dist` |

## Native Android / iOS builds

This repo does not run full native compile in CI by default (SDK weight). Use **Expo Go** for development, or **EAS Build** / local `expo prebuild` for store binaries. Web export validates the shared JS graph on every OS runner.

## Packages

- `packages/core` — env, sync queue stub, **SQLite migrations + repos**, conflict errors
- `apps/fieldops` — Expo Router app (drawer + tabs) + **expo-sqlite**
