/**
 * Single source of DDL for all platforms (Expo SQLite, sql.js tests, future WASM).
 * Apply via runMigrations(engine) — do not duplicate DDL per OS.
 */

/** @type {{ version: number, sql: string }[]} */
const MIGRATIONS = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'client',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS retainers (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  total_amount REAL NOT NULL,
  balance REAL NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  budget REAL,
  retainer_id TEXT REFERENCES retainers(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  due_date INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sub_total REAL NOT NULL,
  tax REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Append-only: repos forbid UPDATE/DELETE (see conflictPolicy + repos).
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Append-only: repos forbid UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY NOT NULL,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('opportunity','project')),
  parent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  media_url TEXT,
  body TEXT,
  author_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_retainers_client ON retainers(client_id);
`,
  },
  {
    version: 2,
    sql: `
ALTER TABLE opportunities ADD COLUMN value REAL;

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  supplier_name TEXT,
  category TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  notes TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
`,
  },
  {
    version: 3,
    sql: `
-- Client (ERD): phone, email, type — mirror legacy kind for NOT NULL kind column
ALTER TABLE clients ADD COLUMN phone TEXT;
ALTER TABLE clients ADD COLUMN email TEXT;
ALTER TABLE clients ADD COLUMN type TEXT;
UPDATE clients SET type = kind WHERE type IS NULL;

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  contact TEXT,
  updated_at INTEGER NOT NULL
);

-- Opportunity: estimated_value, expected_close (legacy value column retained)
ALTER TABLE opportunities ADD COLUMN estimated_value REAL;
ALTER TABLE opportunities ADD COLUMN expected_close INTEGER;
UPDATE opportunities SET estimated_value = value WHERE estimated_value IS NULL AND value IS NOT NULL;

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY NOT NULL,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  sub_total REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  issued_date INTEGER,
  expiry_date INTEGER,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE projects ADD COLUMN opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN status TEXT;
ALTER TABLE projects ADD COLUMN start_date INTEGER;
ALTER TABLE projects ADD COLUMN end_date INTEGER;

ALTER TABLE tasks ADD COLUMN title TEXT;
ALTER TABLE tasks ADD COLUMN priority TEXT;
UPDATE tasks SET title = 'Task' WHERE title IS NULL;

ALTER TABLE workers ADD COLUMN name TEXT;
ALTER TABLE workers ADD COLUMN role TEXT;
ALTER TABLE workers ADD COLUMN phone TEXT;
UPDATE workers SET name = display_name WHERE name IS NULL;

CREATE TABLE IF NOT EXISTS task_workers (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, worker_id)
);

ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'issued';
ALTER TABLE invoices ADD COLUMN tax_rate REAL;
ALTER TABLE invoices ADD COLUMN tax_amount REAL;
ALTER TABLE invoices ADD COLUMN total_amount REAL;
ALTER TABLE invoices ADD COLUMN issued_date INTEGER;
ALTER TABLE invoices ADD COLUMN due_date INTEGER;
UPDATE invoices SET tax_amount = tax WHERE tax_amount IS NULL;
UPDATE invoices SET total_amount = sub_total + COALESCE(tax, 0) WHERE total_amount IS NULL;

ALTER TABLE expenses ADD COLUMN supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN expense_date INTEGER;

ALTER TABLE payments ADD COLUMN paid_at INTEGER;
UPDATE payments SET paid_at = created_at WHERE paid_at IS NULL;

ALTER TABLE retainers ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE retainers ADD COLUMN start_date INTEGER;

CREATE TABLE IF NOT EXISTS retainer_applications (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  retainer_id TEXT NOT NULL REFERENCES retainers(id) ON DELETE CASCADE,
  amount_applied REAL NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  pdf_url TEXT,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  generated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at INTEGER,
  updated_at INTEGER NOT NULL
);

ALTER TABLE posts ADD COLUMN transcript TEXT;
UPDATE posts SET transcript = body WHERE transcript IS NULL AND body IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_opp ON quotations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotations_project ON quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_opportunity ON projects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_task_workers_worker ON task_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier ON expenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_retainer_app_invoice ON retainer_applications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_retainer_app_retainer ON retainer_applications(retainer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_worker ON notifications(worker_id);
`,
  },
  {
    version: 4,
    sql: `
ALTER TABLE opportunities ADD COLUMN location TEXT;
ALTER TABLE opportunities ADD COLUMN contact_name TEXT;
ALTER TABLE opportunities ADD COLUMN contact_phone TEXT;
ALTER TABLE opportunities ADD COLUMN contact_email TEXT;
ALTER TABLE opportunities ADD COLUMN captured_at INTEGER;
UPDATE opportunities SET captured_at = updated_at WHERE captured_at IS NULL;
`,
  },
  {
    version: 5,
    sql: `
ALTER TABLE clients ADD COLUMN notes TEXT;
`,
  },
  {
    version: 6,
    sql: `
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_line_items(invoice_id);
`,
  },
  {
    version: 7,
    sql: `
ALTER TABLE retainers ADD COLUMN opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_retainers_opportunity ON retainers(opportunity_id);
`,
  },
  {
    version: 8,
    sql: `
CREATE TABLE IF NOT EXISTS sync_outbound_queue (
  id TEXT PRIMARY KEY NOT NULL,
  op TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  flags_json TEXT,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_outbound_queue(status, created_at);
`,
  },
  {
    version: 9,
    sql: `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
`,
  },
  {
    version: 10,
    sql: `
CREATE TABLE IF NOT EXISTS quotation_line_items (
  id TEXT PRIMARY KEY NOT NULL,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotation_lines_quote ON quotation_line_items(quotation_id);
`,
  },
  {
    version: 11,
    sql: `
ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
UPDATE tasks SET status = 'todo' WHERE LOWER(TRIM(COALESCE(status, ''))) = 'open';
`,
  },
  {
    version: 12,
    sql: `
ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'posted';
UPDATE payments SET status = 'posted' WHERE status IS NULL OR TRIM(status) = '';
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
`,
  },
  {
    version: 13,
    sql: `
CREATE TABLE IF NOT EXISTS post_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_type TEXT NOT NULL CHECK (parent_type IN ('opportunity','project')),
  parent_id TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('image','video','document')),
  mime_type TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  storage_uri TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_attachments_post ON post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_attachments_parent ON post_attachments(parent_type, parent_id);
`,
  },
];

const CURRENT_SCHEMA_VERSION = MIGRATIONS.length ? MIGRATIONS[MIGRATIONS.length - 1].version : 0;

module.exports = { MIGRATIONS, CURRENT_SCHEMA_VERSION };
