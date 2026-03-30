/** Uganda VAT rate used when “Include VAT” is enabled on invoices. */
const UGANDA_VAT_RATE = 0.18;
const { formatMoney, normalizeCurrencyCode, DEFAULT_CURRENCY_CODE } = require("./money.js");

/**
 * @param {{ quantity?: number, unit_price: number }} line
 * @returns {number}
 */
function lineNetAmount(line) {
  const q = line.quantity != null && line.quantity !== "" ? Number(line.quantity) : 1;
  const u = Number(line.unit_price);
  if (Number.isNaN(q) || Number.isNaN(u)) return 0;
  return Math.round(q * u * 100) / 100;
}

/**
 * @param {Array<{ quantity?: number, unit_price: number }>} lines
 * @param {{ includeVat?: boolean }} opts
 * @returns {{ subTotal: number, taxRate: number | null, taxAmount: number, totalAmount: number }}
 */
function computeInvoiceTotals(lines, opts = {}) {
  const includeVat = Boolean(opts.includeVat);
  const subTotal = lines.reduce((sum, ln) => sum + lineNetAmount(ln), 0);
  const roundedSub = Math.round(subTotal * 100) / 100;
  const taxRate = includeVat ? UGANDA_VAT_RATE : null;
  const taxAmount = includeVat ? Math.round(roundedSub * UGANDA_VAT_RATE * 100) / 100 : 0;
  const totalAmount = Math.round((roundedSub + taxAmount) * 100) / 100;
  return {
    subTotal: roundedSub,
    taxRate,
    taxAmount,
    totalAmount,
  };
}

/**
 * Plain-text receipt stub for sharing (PDF deferred).
 * @param {{ id: string, amount: number, method: string, paid_at?: number, created_at?: number }} payment
 * @param {{ id: string, total_amount?: number, sub_total?: number } | null} invoice
 * @param {{ name?: string } | null} project
 */
function buildReceiptStubText(payment, invoice, project, currencyCode = DEFAULT_CURRENCY_CODE) {
  const amt = Number(payment.amount);
  const when = new Date(Number(payment.paid_at ?? payment.created_at ?? Date.now())).toISOString().slice(0, 10);
  const invBit = invoice ? `Invoice …${String(invoice.id).slice(0, 8)}\n` : "";
  const projBit = project?.name ? `Project: ${project.name}\n` : "";
  return (
    `ServOps — Payment receipt\n` +
    `Receipt ref: …${String(payment.id).slice(0, 8)}\n` +
    invBit +
    projBit +
    `Amount: ${formatMoney(amt, normalizeCurrencyCode(currencyCode))}\n` +
    `Method: ${payment.method}\n` +
    `Date: ${when}\n\n` +
    `Thank you for your payment.`
  );
}

const NOTIF_TYPE_TASK_OVERDUE_LOCAL = "task_overdue_local";

/**
 * Receipt stub plus optional client-facing thank-you line for WhatsApp / share (human-edited before send).
 * @param {{ id: string, amount: number, method: string, paid_at?: number, created_at?: number }} payment
 * @param {{ id: string } | null} invoice
 * @param {{ name?: string } | null} project
 * @param {{ name?: string, phone?: string } | null} client
 * @param {{ includeThankYou?: boolean }} opts
 */
function buildPaymentShareMessage(payment, invoice, project, client, opts = {}) {
  const currencyCode = opts.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const stub = buildReceiptStubText(payment, invoice, project, currencyCode);
  const includeThankYou = opts.includeThankYou !== false;
  if (!includeThankYou || !client?.name) return stub;
  const amt = Number(payment.amount);
  const name = String(client.name).trim();
  return (
    stub +
    `\n\n---\nSuggested message to client:\n${name}, thank you — we received ${formatMoney(
      amt,
      normalizeCurrencyCode(currencyCode)
    )}. ` +
    `We appreciate your business.`
  );
}

/**
 * Polite overdue-invoice reminder for WhatsApp / SMS (PDF URL optional until generation ships).
 * @param {{ id: string }} invoice
 * @param {string | null} projectName
 * @param {{ name?: string } | null} client
 * @param {string | null} companyName
 * @param {number} balanceAmount
 * @param {{ pdfUrl?: string | null }} opts
 */
function buildInvoiceReminderMessage(invoice, projectName, client, companyName, balanceAmount, opts = {}) {
  const currencyCode = opts.currencyCode ?? DEFAULT_CURRENCY_CODE;
  const shortId = String(invoice.id).slice(0, 8);
  const greet = client?.name ? ` ${String(client.name).trim()}` : "";
  const balance = formatMoney(balanceAmount, normalizeCurrencyCode(currencyCode));
  const proj = projectName?.trim() || "your project";
  let body =
    `Hello${greet},\n\n` +
    `Friendly reminder: invoice …${shortId} for ${proj} has an outstanding balance of ${balance}.`;
  if (opts.pdfUrl) {
    body += `\n\nInvoice PDF: ${opts.pdfUrl}`;
  } else {
    body += `\n\n(PDF link can be added when invoice PDFs are generated.)`;
  }
  if (companyName?.trim()) body += `\n\n— ${companyName.trim()}`;
  return body;
}

module.exports = {
  UGANDA_VAT_RATE,
  lineNetAmount,
  computeInvoiceTotals,
  buildReceiptStubText,
  buildPaymentShareMessage,
  NOTIF_TYPE_TASK_OVERDUE_LOCAL,
  buildInvoiceReminderMessage,
};
