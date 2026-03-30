const { getAppEnv, ENV_KEYS } = require("./env.js");
const { createLocalDbStub, SYNC_QUEUE_STUB_VERSION } = require("./localDb.js");
const { CONFLICT_POLICY, APPEND_ONLY_ENTITIES, SYNC_RECONCILIATION } = require("./conflictPolicy.js");
const { runMigrations } = require("./sqlite/runMigrations.js");
const { MIGRATIONS, CURRENT_SCHEMA_VERSION } = require("./sqlite/migrations.js");
const { createRepos, invoiceTotal } = require("./sqlite/repos.js");
const {
  UGANDA_VAT_RATE,
  lineNetAmount,
  computeInvoiceTotals,
  buildReceiptStubText,
  buildPaymentShareMessage,
  NOTIF_TYPE_TASK_OVERDUE_LOCAL,
  buildInvoiceReminderMessage,
} = require("./invoicing.js");
const { formatMoney, normalizeCurrencyCode, DEFAULT_CURRENCY_CODE } = require("./money.js");
const { createSqlJsEngine } = require("./sqlite/sqlJsEngine.js");
const { createSyncInboundApplier } = require("./sqlite/syncInboundApply.js");
const { LWWConflictError, AppendOnlyError } = require("./errors.js");
const { newId } = require("./util/id.js");
const { flushSyncOutboundQueueStub } = require("./syncFlushStub.js");
const {
  escapeHtml,
  buildQuotationPdfHtml,
  buildInvoicePdfHtml,
  buildPaymentReceiptPdfHtml,
  buildProjectProfitReportPdfHtml,
} = require("./pdfHtml.js");

module.exports = {
  getAppEnv,
  ENV_KEYS,
  createLocalDbStub,
  SYNC_QUEUE_STUB_VERSION,
  CONFLICT_POLICY,
  APPEND_ONLY_ENTITIES,
  SYNC_RECONCILIATION,
  flushSyncOutboundQueueStub,
  runMigrations,
  MIGRATIONS,
  CURRENT_SCHEMA_VERSION,
  createRepos,
  invoiceTotal,
  UGANDA_VAT_RATE,
  lineNetAmount,
  computeInvoiceTotals,
  buildReceiptStubText,
  buildPaymentShareMessage,
  NOTIF_TYPE_TASK_OVERDUE_LOCAL,
  buildInvoiceReminderMessage,
  formatMoney,
  normalizeCurrencyCode,
  DEFAULT_CURRENCY_CODE,
  createSqlJsEngine,
  createSyncInboundApplier,
  LWWConflictError,
  AppendOnlyError,
  newId,
  escapeHtml,
  buildQuotationPdfHtml,
  buildInvoicePdfHtml,
  buildPaymentReceiptPdfHtml,
  buildProjectProfitReportPdfHtml,
};
