# Field Operations Platform — Full Design Plan

> A three-layer architecture for a mobile-first field operations app built for Ugandan small businesses. Designed to hide ERP/CRM complexity behind WhatsApp-level simplicity — action-oriented views, not admin screens.

**Repository & platforms:** The product ships from a **single monorepo**. Core domain logic, sync rules, API contracts, and UI semantics are shared across **Android**, **iOS**, **Web**, **Windows**, **Linux**, and **macOS**. Platform-specific code is limited to **adapters** (camera, microphone, filesystem paths, push notifications, windowing, share intents). The repo must **clone and build on Windows, Linux, and macOS** without path or script assumptions tied to one OS.

---

## Design Philosophy

To achieve "WhatsApp-level" simplicity for a complex ERP/CRM, structural complexity (the data model) must be hidden behind **Action-Oriented Views**.

The key principle: workers should never feel like they are using accounting software.

- **Bottom Navigation** — high-frequency daily "check-ins"
- **Left Drawer** — administrative setup and entity management, accessed only when needed

---

## 1. Navigation Structure

### Bottom Navigation — "The Daily Drivers"

| Tab | Scope | One-line purpose |
|-----|-------|-----------------|
| **Pipeline** | Opportunities & Quotations | Where money starts |
| **Projects** | Active Projects & Tasks | Where work happens |
| **Updates** | The Post Feed & Notifications | Where communication lives |
| **Finance** | Invoices, Expenses & Payments | Where money is tracked |

### Left Drawer — "The Business Setup"

| Item | Contains |
|------|----------|
| **Contacts** | Clients & Suppliers |
| **Team** | Workers & Assignments |
| **Retainers** | Pre-paid balances |
| **Reports** | Project Profitability |
| **Settings** | Tax/VAT, Company Profile |

> **Separation of concerns:** Workers live in *Projects* and *Updates*. Owners live in *Pipeline* and *Finance*. Neither group has to navigate the other's space.

---

## 2. Presentation Layer Plan (UI/UX)

### Core Screen Patterns

#### The "Post" Component — Chat-Bubble UI

Mimics the familiar WhatsApp/Telegram pattern so field workers feel at home entering data.

**Input bar (Quick-action bar):**

| Action | Behaviour |
|--------|-----------|
| 🎙 Voice Note | Hold to record; release to attach |
| 📷 Camera | Direct snap — no gallery picker detour |
| ✏️ Text | Standard keyboard input |

Each entry renders as a **chat bubble** in the Feed, timestamped and attributed to the posting worker. Bubbles are linked to an Opportunity or a Project.

#### The "Finance Card" — Colour-Coded Status Card

Not a spreadsheet — a scannable status card used throughout the Finance tab and embedded in Project Dashboards.

| Colour | Meaning |
|--------|---------|
| 🔴 Red text | Expenses |
| 🟢 Green text | Payments received |
| 🟡 Amber text | Overdue Invoices |

#### The "Project Dashboard" — Sticky Header

Every active project screen opens with a **sticky header** that never scrolls away:

```
┌─────────────────────────────────────────────────────┐
│  Retainer Balance: UGX 4,200,000  │  12 days left   │
└─────────────────────────────────────────────────────┘
```

Below the header: Tasks (Kanban), Feed (Posts), Invoices, Expenses — all scoped to the project.

---

### Screen Summary Table

| Screen | FAB Action | Key Data Visible |
|--------|-----------|-----------------|
| **Pipeline** | `+ New Opp` | Opportunity Name, Value, Status Tag |
| **Projects** | `+ New Project` | Progress Bar, Overdue Task count |
| **Updates** | `+ Post` | Chronological Voice Notes / Files |
| **Finance** | `+ Expense / Invoice` | Total Outstanding, Monthly Revenue |

---

### Why This Works for a Small Business

- **No "Admin" Fatigue** — putting *Posts* in the bottom nav makes the app feel like a messenger; workers actually log progress
- **Retainers as "Store Credit"** — kept in the Drawer, out of the way until the moment of invoicing; prevents UI clutter
- **Role separation baked into the navigation** — no need for permission screens for most use cases

---

## 3. User Flows

### Flow A — Lead to Project (The Sales Loop)

Converts a conversation into a working project.

```
Pipeline Tab
    │
    ▼
New Opportunity
    │
    ├──[Add Quote?]──► Draft Quotation
    │                       │
    │               Accept Quotation
    │                       │
    │               Auto-Create Project
    │                       │
    └───────────────────────► Projects Tab
```

### Flow B — Task to Payment (The Execution Loop)

Handles the work and getting paid for it.

```
Projects Tab
    │
    ▼
Select Project ──► Tasks List ──► Complete Task
                                       │
                               Generate Invoice
                                       │
                            ┌──[Retainer found?]──┐
                            │                     │
                    Apply Retainer Credit   Generate Final Total
                            │                     │
                            └──────────┬──────────┘
                                       │
                               Send via WhatsApp / Email
                                       │
                               Record Payment
                                       │
                               Auto-Generate Receipt
```

### Flow C — The "Post" System (The WhatsApp Logic)

Replaces complex activity logs with a chat-style feed.

```
Updates Tab
    │
    ▼
Select Project / Opportunity
    │
    ▼
Feed View
    │
    ▼
Voice Note / Photo / Text
    │
    ▼
Notify Workers / Client
```

---

## 4. Finance Tab — Deep Dive

To keep the Finance Tab at WhatsApp-level simplicity, complexity is hidden behind **three clear pillars**: Money In (Invoices), Money Out (Expenses), and Stored Value (Retainers).

### Finance Tab Navigation Logic

```
┌────────────────────────────────────────────────────┐
│  Header: Total Revenue vs. Expenses (Net Profit)   │
│                    — This Month —                  │
├────────────────────────────────────────────────────┤
│  Sub-Tabs:  [ Invoices ]  [ Expenses ]  [ Payments ]│
└────────────────────────────────────────────────────┘
                        FAB: [ + New ]
                              │
                   ┌──────────┼──────────┐
               Invoice    Expense    Payment
```

### Finance Screen — "WhatsApp-Simple" Status Card View

| View | Primary Metric | Example Row |
|------|---------------|-------------|
| **Invoices** | UGX X,XXX,XXX Unpaid | Inv #102 — Project Alpha — UGX 1,200,000 — **Overdue** |
| **Expenses** | UGX X,XXX,XXX This Month | Timber — Kampala Supplies Ltd — UGX 400,000 — Project Alpha |
| **Payments** | UGX X,XXX,XXX Collected | Payment Recv — Client Name — UGX 1,200,000 — Receipt #45 |

---

### Finance Flow A — Invoicing & Collection Loop

Handles the Project → Invoice → Payment chain.

```
Finance Tab
    │
    ▼
Invoices Sub-tab ──► + New Invoice
                           │
                   Select Project / Client
                           │
                   Add Line Items / Tasks
                           │
                  ┌──[Retainer balance?]──┐
                  │                       │
          Apply Retainer Credit    No balance found
                  │                       │
                  └──────────┬────────────┘
                             │
                    Generate Final Total
                    (with 18% VAT toggle)
                             │
                    Send Link via WhatsApp / Email
                             │
                    Mark as Paid ──► Auto-Generate Receipt
```

### Finance Flow B — Expense & Supplier Loop

Tracks project costs and supplier relationships.

```
Finance Tab
    │
    ▼
Expenses Sub-tab ──► + New Expense
                           │
                  Capture Receipt Photo (OCR)
                           │
                   Link to Project
                           │
                  Select Supplier / Category
                           │
                   Enter Amount / Qty
                           │
                  Auto-Deduct from Project Profit
```

### Finance Flow C — Retainer / Deposit Loop

Handles upfront money before work begins.

```
Left Drawer: Retainers
    │
    ▼
New Retainer ──► Link to Opportunity / Project
                           │
                   Record Initial Payment
                           │
                   Status: Active Balance
                           │
                   Available at Invoicing stage
```

---

### Smart Logic Shortcuts

These automations do the heavy lifting so workers stay mobile:

| Feature | Trigger | Action |
|---------|---------|--------|
| **Auto-Tax** | "Include VAT" toggle on Invoice / Expense | Auto-calculates 18% Uganda VAT on `totalAmount` |
| **One-Tap Reminder** | Overdue Invoice → Remind button | Pre-fills WhatsApp message with polite text + PDF link |
| **OCR for Expenses** | Camera icon on Expense screen | Extracts `total`, `supplier`, and `date` from receipt photo |

---

## 5. Logic Layer Plan (Business Rules)

The logic layer acts as the **"Traffic Controller"** — enforcing financial integrity and automating communication.

### State Management & Transitions

**Conversion Logic:**

```
Opportunity  ──[Quotation.status == 'Accepted']──►  Project
Invoice      ──[Sum(Payments) >= Invoice.totalAmount]──►  Paid
```

**Financial Calculators:**

| Formula | Expression |
|---------|-----------|
| **Net Total** | `(Qty × Price) + (VAT 18%)` |
| **Remaining Retainer** | `Retainer.totalAmount − Sum(InvoicesApplied)` |
| **Project Profit** | `Sum(Invoices.Paid) − Sum(Expenses.Total)` |

All calculations execute client-side first, then sync to the server — figures remain accurate offline.

### Automations — The "Invisible Assistant"

| Trigger | Action |
|---------|--------|
| `Task.deadline < CurrentDate` AND `Task.status != 'Done'` | Push Notification → Assigned Worker |
| Payment recorded | Generate Receipt PDF + WhatsApp "Thank You" template → Client |
| Voice note contains intent (e.g. "task completed") | Propose status update → Worker confirms with one tap |

> Voice-to-data is always **human-confirmed** — the app proposes, the worker approves. Silent automation is never used for financial or status records.

---

## 6. Data Layer Plan (Schema & Persistence)

A relational structure designed for **local SQLite on every client** (using each platform’s supported bindings — e.g. mobile SDKs, desktop SQLite, WASM or IndexedDB-backed strategies on web if SQLite is not native) and **cloud PostgreSQL** synchronisation. Schema migrations and conflict rules are **identical across platforms**; only the storage driver and background task APIs differ.

### Entity Relationship Mapping

| Entity | Key Attributes | Relationships |
|--------|---------------|---------------|
| **Client** | `id`, `name`, `phone`, `email`, `notes`, `type` | 1:N Opportunities, 1:N Retainers |
| **Supplier** | `id`, `name`, `category`, `contact` | 1:N Expenses |
| **Opportunity** | `id`, `client_id`, `name`, `location`, `contact_name`, `contact_phone`, `contact_email`, `status` (pipeline: Prospecting → Closing), `estimated_value`, `expected_close`, `captured_at` | 1:N Quotations, 1:N Posts |
| **Quotation** | `id`, `opportunity_id`, `status`, `sub_total`, `tax_amount`, `total_amount`, `issued_date`, `expiry_date` | 1:1 Project (on acceptance) |
| **Project** | `id`, `opportunity_id`, `retainer_id`, `name`, `status`, `budget`, `start_date`, `end_date` | 1:N Tasks, 1:N Invoices, 1:N Expenses, 1:N Posts |
| **Task** | `id`, `project_id`, `title`, `status`, `due_date`, `priority` | M:N Workers, 1:N Notifications |
| **Worker** | `id`, `name`, `role`, `phone` | M:N Tasks |
| **Invoice** | `id`, `project_id`, `status`, `sub_total`, `tax_rate`, `tax_amount`, `total_amount`, `issued_date`, `due_date` | 1:N Payments, 1:1 RetainerApplication |
| **Expense** | `id`, `project_id`, `supplier_id`, `category`, `amount`, `receipt_url`, `date` | N:1 Supplier, N:1 Project |
| **Payment** | `id`, `invoice_id`, `amount`, `method`, `paid_at` | 1:1 Receipt |
| **Retainer** | `id`, `client_id`, `total_amount`, `balance`, `status`, `start_date` | 1:N RetainerApplications |
| **RetainerApplication** | `id`, `invoice_id`, `retainer_id`, `amount_applied`, `applied_at` | Links Invoice ↔ Retainer |
| **Receipt** | `id`, `payment_id`, `pdf_url`, `whatsapp_sent`, `generated_at` | 1:1 Payment |
| **Notification** | `id`, `task_id`, `worker_id`, `type`, `status`, `sent_at` | N:1 Task, N:1 Worker |
| **Post** | `id`, `parent_id`, `parent_type`, `type`, `media_url`, `transcript`, `author_id`, `created_at` | Polymorphic: belongs to Opportunity or Project |

### Key design decisions (schema)

- **`Quotation` is separate from `Project`** — the quotation is a negotiation artifact (revised, rejected, re-sent); only an accepted quotation triggers project creation, preserving full sales history.
- **`RetainerApplication` is a join table** — a retainer can be partially applied across multiple invoices; a single `retainer_id` on `Invoice` would not support partial draws.
- **`Post.parent_type`** is a polymorphic discriminator (`"opportunity"` \| `"project"`) so one `posts` table serves both feeds; `parent_id` is interpreted with `parent_type`.
- **`Expense.supplier_id`** is nullable — petty cash and informal spend may have no supplier row; when set, it powers supplier ledger views.
- **`Receipt` is its own entity** — PDF generation and WhatsApp delivery status have a lifecycle independent of the payment row.

### Sync & Storage Strategy

**Offline-First Architecture:**

```
Field Worker Device                         Cloud Server
───────────────────                         ────────────
Write → SQLite (immediate)
         │
         └── Sync Queue (background service)
                    │
                    └──[4G / Wi-Fi confirmed]──► PostgreSQL
```

**Conflict Resolution Policy:**

| Data Type | Strategy | Rationale |
|-----------|----------|-----------|
| Simple fields (names, statuses) | Last-Write-Wins | Low-stakes; recency is the best signal |
| `Posts` | Append-Only | Chat history must never be overwritten |
| `Payments` | Append-Only | Financial records must never be silently replaced |
| `RetainerApplication` | Append-Only | Application rows are immutable facts once recorded |

**Media Storage — Compress Before Upload:**

1. Images resized and recompressed on-device before queuing
2. Held in the Sync Queue until connectivity is confirmed
3. Uploaded to S3 / Cloud Storage on Wi-Fi or strong 4G only

> **Ugandan mobile data context:** Compression before upload is a first-class product feature, not an optimisation afterthought. Every unnecessary megabyte is a real cost to field workers.

---

## 7. Full Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│              PLATFORM SHELLS (single repo, shared core)    │
│   Android · iOS · Web · Windows · Linux · macOS              │
│   Adapters: camera, mic, FS, push, share, windowing         │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────┐
│                    PRESENTATION LAYER                      │
│                                                            │
│  Bottom Nav: Pipeline · Projects · Updates · Finance       │
│  Left Drawer: Contacts · Team · Retainers · Reports        │
│  Patterns: Chat Bubbles · Finance Cards · Sticky Headers   │
│  (+ responsive layout for web/desktop — see design system) │
└────────────────────────┬───────────────────────────────────┘
                         │ User actions / events
┌────────────────────────▼───────────────────────────────────┐
│                      LOGIC LAYER                           │
│                                                            │
│  State Machine (Opportunity→Project, Invoice→Paid)         │
│  Financial Calculators (VAT, Retainer, Profit)             │
│  Notification Engine · Voice-to-Data · OCR · WhatsApp API  │
└────────────────────────┬───────────────────────────────────┘
                         │ Reads / writes
┌────────────────────────▼───────────────────────────────────┐
│                       DATA LAYER                           │
│                                                            │
│  SQLite (local, immediate) ◄── Sync Queue ──► PostgreSQL   │
│  Conflict: Last-Write-Wins (fields) · Append-Only (Finance)│
│  Media: Compress locally → S3 / Cloud Storage              │
└────────────────────────────────────────────────────────────┘
```

---

*Document version 2.1 — adds single-repo, cross-platform scope (Android, iOS, Web, Windows, Linux, macOS) and platform-neutral local persistence wording.*