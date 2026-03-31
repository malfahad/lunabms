const { UGANDA_VAT_RATE } = require("./invoicing.js");
const { formatMoney, normalizeCurrencyCode, DEFAULT_CURRENCY_CODE } = require("./money.js");

/**
 * @param {unknown} s
 * @returns {string}
 */
function escapeHtml(s) {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escape and preserve line breaks for address blocks.
 * @param {unknown} s
 * @returns {string}
 */
function escapeHtmlMultiline(s) {
  if (s == null || s === "") return "";
  return String(s)
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br/>");
}

/** Present stored status strings in readable Title Case for client-facing PDFs. */
function formatClientStatusLabel(s) {
  if (s == null || s === "") return "—";
  const raw = String(s).trim();
  const t = raw.toLowerCase().replace(/\s+/g, "_");
  const map = {
    active: "Active",
    on_hold: "On hold",
    archived: "Archived",
    issued: "Issued",
    draft: "Draft",
    paid: "Paid",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
  };
  if (map[t]) return map[t];
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMoneyWithCurrency(amount, currencyCode) {
  return formatMoney(amount, normalizeCurrencyCode(currencyCode ?? DEFAULT_CURRENCY_CODE));
}

function buildBrandHeaderHtml(companyName, companyTagline, companyLogoDataUri) {
  const name = companyName && String(companyName).trim() !== "" ? String(companyName).trim() : "";
  const tagline = companyTagline && String(companyTagline).trim() !== "" ? String(companyTagline).trim() : "";
  const logoSrc =
    companyLogoDataUri && String(companyLogoDataUri).trim() !== "" ? String(companyLogoDataUri).trim() : "";
  if (!name && !tagline && !logoSrc) return "";
  return `<div class="brand-head">
    ${logoSrc ? `<div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(logoSrc)}" alt="Business logo"/></div>` : ""}
    <div class="brand-meta">
      ${name ? `<div class="brand-name">${escapeHtml(name)}</div>` : ""}
      ${tagline ? `<div class="brand-tagline">${escapeHtml(tagline)}</div>` : ""}
    </div>
  </div>`;
}

/**
 * @param {string} title
 * @param {string | null | undefined} subtitle
 * @param {string[]} rightLines
 */
function buildDocumentHeaderHtml(title, subtitle, rightLines = []) {
  const safeLines = (rightLines || []).filter((x) => x != null && String(x).trim() !== "");
  return `<div class="report-head">
    <div class="report-head-main">
      <div class="report-title">${escapeHtml(title || "Report")}</div>
      ${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ""}
    </div>
    <div class="report-head-side">
      ${safeLines.length ? safeLines.map((line) => `<div>${escapeHtml(String(line))}</div>`).join("") : "<div>—</div>"}
    </div>
  </div>`;
}

/**
 * @param {string} title
 * @param {string} innerBody
 */
function docShell(title, innerBody) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Arial", "Helvetica Neue", Helvetica, sans-serif; color: #101828; padding: 20px 18px; margin: 0 auto; max-width: 980px; font-size: 12px; line-height: 1.32; }
  h1 { font-size: 18px; margin: 0 0 6px; font-weight: 700; letter-spacing: 0.01em; }
  .company { font-size: 11px; color: #43536b; margin-bottom: 10px; }
  .meta { font-size: 10px; color: #556378; margin-bottom: 10px; }
  .meta div { margin: 2px 0; }
  .report-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 10px; border: 1px solid #a9b7c9; background: #edf4ff; padding: 8px 10px; }
  .report-head-main { flex: 1; min-width: 0; }
  .report-head-side { text-align: right; font-size: 10px; color: #344054; line-height: 1.35; min-width: 150px; }
  .report-title { font-size: 21px; font-weight: 800; color: #10213d; line-height: 1.1; }
  .report-subtitle { font-size: 11px; color: #344054; margin-top: 2px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #1f2a37; padding: 6px 6px; border-top: 2px solid #7b8796; border-bottom: 2px solid #7b8796; background: #d9e6f5; }
  td { padding: 5px 6px; border-bottom: 1px solid #e4e7ec; vertical-align: top; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 10px; text-align: right; }
  .totals-row { margin: 2px 0; font-size: 11px; }
  .grand { font-size: 14px; font-weight: 800; margin-top: 5px; padding-top: 6px; border-top: 2px solid #7b8796; }
  .foot { margin-top: 16px; font-size: 10px; color: #667085; }
  .profit-pos { color: #0d6b3e; font-weight: 600; }
  .profit-neg { color: #a61b1b; font-weight: 600; }
  .intro { font-size: 11px; color: #475467; margin-bottom: 10px; line-height: 1.45; }
  .two-col { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .two-col td.col { width: 50%; vertical-align: top; padding: 0 8px 0 0; }
  .two-col td.col:last-child { padding: 0 0 0 8px; }
  .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #475467; font-weight: 700; margin: 0 0 5px; }
  .block { font-size: 11px; color: #111827; line-height: 1.4; }
  .block .line { margin: 2px 0; }
  .section { margin-bottom: 10px; }
  .kv { margin: 3px 0; font-size: 11px; }
  .kv .k { color: #555; font-weight: 600; }
  .kv .k::after { content: " "; }
  .kv .v { color: #101828; }
  .ref-full { font-size: 10px; color: #667085; word-break: break-all; margin-top: 3px; }
  .payment-highlight { background: #f5f8ff; border: 1px solid #cfdaf0; border-radius: 6px; padding: 8px; margin: 8px 0 10px; }
  .amount-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #214a9c; font-weight: 700; margin-bottom: 2px; }
  .amount-emphasis { font-size: 20px; line-height: 1.15; font-weight: 800; color: #102b60; margin: 0 0 6px; }
  .divider { border-top: 1px solid #d0d5dd; margin: 6px 0; }
  .muted { color: #555; }
  .num-mono { font-family: "Courier New", "Lucida Console", monospace; font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
  .report-table { table-layout: fixed; }
  .report-table tfoot td { border-top: 2px solid #7b8796; border-bottom: 2px solid #7b8796; background: #f2f5f9; font-weight: 700; }
  .report-table .sum-label { text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; color: #1f2a37; }
  .compact-row td { padding-top: 4px; padding-bottom: 4px; }
  .quote-highlight { background: #f7fafc; border: 1px solid #d0d5dd; border-radius: 6px; padding: 8px; margin: 8px 0 10px; }
  .quote-tag { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #475467; font-weight: 700; margin-bottom: 2px; }
  .quote-service { font-size: 14px; line-height: 1.25; font-weight: 700; margin: 0 0 4px; color: #16202a; }
  .quote-total { font-size: 18px; line-height: 1.15; font-weight: 800; color: #0f2f71; margin: 0; }
  .scope-list { margin: 0; padding-left: 18px; }
  .scope-list li { margin: 3px 0; }
  .acceptance-lines { margin-top: 6px; }
  .acceptance-lines .line { margin: 7px 0; white-space: pre; }
  .watermark-wrap { position: relative; }
  .watermark { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font-size: 72px; font-weight: 800; letter-spacing: 0.08em; color: rgba(160, 0, 0, 0.16); text-transform: uppercase; pointer-events: none; z-index: 1; white-space: nowrap; }
  .watermark-wrap > *:not(.watermark) { position: relative; z-index: 2; }
  .brand-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; padding: 0 0 6px; border-bottom: 1px solid #d0d5dd; }
  .brand-logo-wrap { width: 120px; height: 40px; display: flex; align-items: center; justify-content: flex-end; flex: 0 0 auto; }
  .brand-logo { max-width: 120px; max-height: 40px; object-fit: contain; }
  .brand-meta { flex: 1 1 auto; min-width: 0; }
  .brand-name { font-size: 14px; font-weight: 800; color: #122132; line-height: 1.2; }
  .brand-tagline { font-size: 10px; color: #52606f; margin-top: 2px; line-height: 1.3; }
</style>
</head>
<body>
${innerBody}
</body>
</html>`;
}

/**
 * @param {{
 *   companyName?: string | null,
 *   companyTagline?: string | null,
 *   companyLogoDataUri?: string | null,
 *   companyAddress?: string | null,
 *   companyPhone?: string | null,
 *   opportunityName?: string | null,
 *   projectProspectName?: string | null,
 *   clientName?: string | null,
 *   client?: { name?: string | null, phone?: string | null, email?: string | null, typeLabel?: string | null, notes?: string | null } | null,
 *   workLocation?: string | null,
 *   siteContactName?: string | null,
 *   siteContactPhone?: string | null,
 *   siteContactEmail?: string | null,
 *   expectedCloseStr?: string | null,
 *   quotationRef: string,
 *   status?: string | null,
 *   createdAtStr?: string | null,
 *   issuedDateStr?: string | null,
 *   expiryDateStr?: string | null,
 *   lastUpdatedStr?: string | null,
 *   linkedProjectId?: string | null,
 *   lines: Array<{ description?: string | null, quantity?: number | null, unit_price?: number | null }>,
 *   subTotal: number,
 *   taxAmount: number,
 *   totalAmount: number,
 *   includeVat?: boolean,
 *   currencyCode?: string | null,
 * }} opts
 */
function buildQuotationPdfHtml(opts) {
  const {
    companyName,
    companyTagline,
    companyLogoDataUri,
    companyAddress,
    companyPhone,
    opportunityName,
    projectProspectName,
    clientName,
    client,
    workLocation,
    quotationRef,
    createdAtStr,
    issuedDateStr,
    expiryDateStr,
    lines,
    subTotal,
    taxAmount,
    totalAmount,
    includeVat: includeVatOpt,
    currencyCode,
  } = opts;
  const includeVat = includeVatOpt !== false;
  const vatPercent = Math.round(UGANDA_VAT_RATE * 100);
  const shortRef = String(quotationRef).slice(0, 8);
  const cc = normalizeCurrencyCode(currencyCode ?? DEFAULT_CURRENCY_CODE);

  const prospectTitle =
    (projectProspectName != null && String(projectProspectName).trim() !== "")
      ? projectProspectName
      : opportunityName != null && String(opportunityName).trim() !== ""
        ? opportunityName
        : null;

  const issuedDisplay = issuedDateStr ?? createdAtStr ?? null;

  /** @type {string[]} */
  const fromLines = [];
  if (companyName) fromLines.push(`<div class="line">${escapeHtml(companyName)}</div>`);
  if (companyAddress && String(companyAddress).trim() !== "") {
    fromLines.push(`<div class="line">${escapeHtmlMultiline(companyAddress)}</div>`);
  }
  if (companyPhone && String(companyPhone).trim() !== "") {
    fromLines.push(`<div class="line"><span class="kv"><span class="k">Phone</span> ${escapeHtml(companyPhone)}</span></div>`);
  }
  const fromBlock =
    fromLines.length > 0
      ? `<table class="two-col"><tr><td class="col"><div class="section-title">From</div><div class="block">${fromLines.join("")}</div></td>`
      : `<table class="two-col"><tr><td class="col"><div class="section-title">From</div><div class="block"><div class="line">—</div></div></td>`;

  /** @type {string[]} */
  const clientLines = [];
  const cName = client?.name ?? clientName;
  if (cName && String(cName).trim() !== "") {
    clientLines.push(`<div class="line">${escapeHtml(String(cName))}</div>`);
  }
  if (client?.phone && String(client.phone).trim() !== "") {
    clientLines.push(
      `<div class="line"><span class="kv"><span class="k">Phone</span> ${escapeHtml(client.phone)}</span></div>`
    );
  }
  if (client?.email && String(client.email).trim() !== "") {
    clientLines.push(
      `<div class="line"><span class="kv"><span class="k">Email</span> ${escapeHtml(client.email)}</span></div>`
    );
  }
  if (client?.notes && String(client.notes).trim() !== "") {
    clientLines.push(
      `<div class="line"><span class="k">Notes</span><br/>${escapeHtmlMultiline(client.notes)}</div>`
    );
  }
  if (!client && clientName && clientLines.length === 0) {
    clientLines.push(`<div class="line">${escapeHtml(String(clientName))}</div>`);
  }
  if (clientLines.length === 0) {
    clientLines.push(`<div class="line muted">Client details to be confirmed</div>`);
  }
  const clientBlock =
    clientLines.length > 0
      ? `<td class="col"><div class="section-title">Prepared for</div><div class="block">${clientLines.join("")}</div></td></tr></table>`
      : `<td class="col"><div class="section-title">Prepared for</div><div class="block"><div class="line">—</div></td></tr></table>`;

  /** @type {string[]} */
  const quoteMeta = [];
  quoteMeta.push(
    `<div class="kv"><span class="k">Quotation #</span><span class="v">…${escapeHtml(shortRef)}</span></div>`
  );
  if (issuedDisplay) {
    quoteMeta.push(
      `<div class="kv"><span class="k">Issued</span><span class="v">${escapeHtml(issuedDisplay)}</span></div>`
    );
  }
  const validUntil =
    expiryDateStr && String(expiryDateStr).trim() !== "" ? String(expiryDateStr) : "Not specified";
  quoteMeta.push(`<div class="kv"><span class="k">Quotation valid until</span><span class="v">${escapeHtml(validUntil)}</span></div>`);
  const quoteDetailsSection = `<div class="section"><div class="section-title">Quotation details</div>${quoteMeta.join("")}</div>`;

  const lineRows =
    lines && lines.length > 0
      ? lines
          .map((ln) => {
            const qty = ln.quantity != null && ln.quantity !== "" ? Number(ln.quantity) : 1;
            const unit = Number(ln.unit_price);
            const net = Math.round(qty * (Number.isNaN(unit) ? 0 : unit) * 100) / 100;
            return `<tr>
        <td>${escapeHtml(ln.description || "—")}</td>
        <td class="num">${formatMoneyWithCurrency(Number.isNaN(unit) ? 0 : unit, cc)}</td>
        <td class="num">${escapeHtml(String(qty))}</td>
        <td class="num">${formatMoneyWithCurrency(net, cc)}</td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="4">No line items (totals from summary)</td></tr>`;

  const serviceLabel = prospectTitle && String(prospectTitle).trim() !== "" ? String(prospectTitle) : "Service quotation";
  const summaryLocation = workLocation && String(workLocation).trim() !== "" ? ` - ${String(workLocation).trim()}` : "";
  const quoteSummary = `<div class="quote-highlight">
    <div class="quote-tag">Service offer</div>
    <div class="quote-service">${escapeHtml(serviceLabel + summaryLocation)}</div>
    <div class="quote-tag">Total cost</div>
    <div class="quote-total">${formatMoneyWithCurrency(totalAmount, cc)}</div>
  </div>`;

  const valueSection = `<div class="section">
    <div class="section-title">Value note</div>
    <div class="block">This quotation includes the labor, materials, and transport required to complete the work efficiently and safely.</div>
  </div>`;

  const acceptanceSection = `<div class="section">
    <div class="section-title">Terms and acceptance</div>
    <div class="block">
      To proceed, sign below or reply <strong>Approved</strong> to this quotation reference.
      <div class="acceptance-lines">
        <div class="line">Client name: ____________________________</div>
        <div class="line">Signature: ______________________________</div>
        <div class="line">Date: __________________________________</div>
      </div>
    </div>
  </div>`;

  const inner = `
  ${buildBrandHeaderHtml(companyName, companyTagline, companyLogoDataUri)}
  ${buildDocumentHeaderHtml("Quotation", prospectTitle || "Service quote", [issuedDisplay ? `Issued: ${issuedDisplay}` : "", `Ref: …${shortRef}`])}
  ${quoteSummary}
  ${fromBlock}${clientBlock}
  ${quoteDetailsSection}
  <table>
    <thead><tr>
      <th>Description</th><th class="num">Unit (${cc})</th><th class="num">Qty</th><th class="num">Line total</th>
    </tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row">Sub-total: ${formatMoneyWithCurrency(subTotal, cc)}</div>
    ${
      includeVat
        ? `<div class="totals-row">VAT (${vatPercent}%): ${formatMoneyWithCurrency(taxAmount, cc)}</div>`
        : ""
    }
    <div class="grand">TOTAL: ${formatMoneyWithCurrency(totalAmount, cc)}</div>
  </div>
  ${valueSection}
  ${acceptanceSection}
  <div class="foot">All amounts are in ${escapeHtml(cc)}. Thank you for the opportunity to serve you.</div>
  `;
  return docShell(`Quotation ${shortRef}`, inner);
}

/**
 * @param {{
 *   business?: { companyName?: string | null, companyTagline?: string | null, companyLogoDataUri?: string | null, companyAddress?: string | null, companyPhone?: string | null } | null,
 *   client?: { name?: string | null, phone?: string | null, email?: string | null, typeLabel?: string | null, notes?: string | null } | null,
 *   project?: {
 *     name?: string | null,
 *     status?: string | null,
 *     budgetLabel?: string | null,
 *     startDateStr?: string | null,
 *     endDateStr?: string | null,
 *     opportunityName?: string | null,
 *     opportunityLocation?: string | null,
 *     opportunityValueLabel?: string | null,
 *     opportunityContactName?: string | null,
 *     opportunityContactPhone?: string | null,
 *     opportunityContactEmail?: string | null,
 *     retainerSummary?: string | null,
 *     archivedLabel?: string | null,
 *   } | null,
 *   invoiceRef: string,
 *   invoiceStatus?: string | null,
 *   issuedDateStr?: string | null,
 *   dueDateStr?: string | null,
 *   updatedAtStr?: string | null,
 *   taxRateLabel?: string | null,
 *   amountPaidStr?: string | null,
 *   balanceDueStr?: string | null,
 *   paymentsCount?: number | null,
 *   lines: Array<{ description?: string | null, quantity?: number | null, unit_price?: number | null }>,
 *   subTotal: number,
 *   taxAmount: number,
 *   totalAmount: number,
 *   includeVat: boolean,
 *   currencyCode?: string | null,
 *   companyName?: string | null,
 *   projectName?: string | null,
 *   clientName?: string | null,
 *   status?: string | null,
 * }} opts
 */
function buildInvoicePdfHtml(opts) {
  const business = { ...(opts.business ?? {}) };
  if (opts.companyName != null && opts.companyName !== "" && business.companyName == null) {
    business.companyName = opts.companyName;
  }

  let client = opts.client ?? null;
  if (!client && opts.clientName) {
    client = { name: opts.clientName };
  }

  let project = opts.project ?? null;
  if (!project && opts.projectName) {
    project = { name: opts.projectName };
  }

  const {
    invoiceRef,
    issuedDateStr,
    dueDateStr,
    updatedAtStr,
    taxRateLabel,
    amountPaidStr,
    balanceDueStr,
    paymentsCount,
    lines,
    subTotal,
    taxAmount,
    totalAmount,
    includeVat,
    currencyCode,
  } = opts;
  const invoiceStatus = opts.invoiceStatus ?? opts.status ?? null;
  const isVoided = String(invoiceStatus || "").toLowerCase() === "voided";

  const vatPercent = Math.round(UGANDA_VAT_RATE * 100);
  const fullRef = String(invoiceRef);
  const shortRef = fullRef.slice(0, 8);
  const cc = normalizeCurrencyCode(currencyCode ?? DEFAULT_CURRENCY_CODE);

  /** @type {string[]} */
  const companyLines = [];
  if (business.companyName && String(business.companyName).trim() !== "") {
    companyLines.push(`<div class="line"><strong>${escapeHtml(String(business.companyName))}</strong></div>`);
  }
  if (business.companyAddress && String(business.companyAddress).trim() !== "") {
    companyLines.push(`<div class="line">${escapeHtmlMultiline(business.companyAddress)}</div>`);
  }
  if (business.companyPhone && String(business.companyPhone).trim() !== "") {
    companyLines.push(`<div class="line">Phone: ${escapeHtml(String(business.companyPhone))}</div>`);
  }
  const companyBlock =
    companyLines.length > 0 ? companyLines.join("") : `<div class="line">Business details not set</div>`;

  /** @type {string[]} */
  const invMeta = [];
  invMeta.push(`<div class="line"><strong>Invoice #${escapeHtml(shortRef)}</strong></div>`);
  if (issuedDateStr && String(issuedDateStr).trim() !== "") {
    invMeta.push(`<div class="line">Issued: ${escapeHtml(String(issuedDateStr))}</div>`);
  }
  if (dueDateStr && String(dueDateStr).trim() !== "") {
    invMeta.push(`<div class="line">Due: ${escapeHtml(String(dueDateStr))}</div>`);
  }
  invMeta.push(`<div class="line">Status: ${escapeHtml(formatClientStatusLabel(invoiceStatus))}</div>`);
  const headerMeta = invMeta.join("");

  /** @type {string[]} */
  const clientLines = [];
  const cName = client?.name;
  if (cName && String(cName).trim() !== "") {
    clientLines.push(`<div class="line"><strong>${escapeHtml(String(cName))}</strong></div>`);
  }
  if (client?.phone && String(client.phone).trim() !== "") {
    clientLines.push(`<div class="line">Phone: ${escapeHtml(String(client.phone))}</div>`);
  }
  if (client?.email && String(client.email).trim() !== "") {
    clientLines.push(`<div class="line">Email: ${escapeHtml(String(client.email))}</div>`);
  }
  if (clientLines.length === 0) {
    clientLines.push(`<div class="line"><strong>Client details pending</strong></div>`);
  }
  const billToBlock = clientLines.join("");

  /** @type {string[]} */
  const billingLines = [];
  if (project?.name && String(project.name).trim() !== "") {
    billingLines.push(`<div class="line">Project: ${escapeHtml(String(project.name))}</div>`);
  }
  if (updatedAtStr && String(updatedAtStr).trim() !== "") {
    billingLines.push(`<div class="line">Last revised: ${escapeHtml(String(updatedAtStr))}</div>`);
  }
  if (paymentsCount != null) {
    billingLines.push(`<div class="line">Payments recorded: ${escapeHtml(String(paymentsCount))}</div>`);
  }
  if (billingLines.length === 0) {
    billingLines.push(`<div class="line">Payment terms: due by invoice due date.</div>`);
  }
  const billingBlock = billingLines.join("");

  const lineRows =
    lines && lines.length > 0
      ? lines
          .map((ln) => {
            const qty = ln.quantity != null && ln.quantity !== "" ? Number(ln.quantity) : 1;
            const unit = Number(ln.unit_price);
            const net = Math.round(qty * (Number.isNaN(unit) ? 0 : unit) * 100) / 100;
            return `<tr>
        <td>${escapeHtml(ln.description || "—")}</td>
        <td class="num">${formatMoneyWithCurrency(Number.isNaN(unit) ? 0 : unit, cc)}</td>
        <td class="num">${escapeHtml(String(qty))}</td>
        <td class="num">${formatMoneyWithCurrency(net, cc)}</td>
      </tr>`;
          })
          .join("")
      : `<tr><td colspan="4">No line items</td></tr>`;

  const vatBracketLabel =
    taxRateLabel && String(taxRateLabel).trim() !== ""
      ? escapeHtml(String(taxRateLabel))
      : `${vatPercent}%`;

  const amountPaidDisplay =
    amountPaidStr && String(amountPaidStr).trim() !== ""
      ? escapeHtml(String(amountPaidStr))
      : formatMoneyWithCurrency(0, cc);
  const balanceDueDisplay =
    balanceDueStr && String(balanceDueStr).trim() !== ""
      ? escapeHtml(String(balanceDueStr))
      : formatMoneyWithCurrency(totalAmount, cc);

  const invoiceBody = `
  ${buildBrandHeaderHtml(business.companyName, business.companyTagline, business.companyLogoDataUri)}
  ${buildDocumentHeaderHtml("Invoice", project?.name || null, [issuedDateStr ? `Issued: ${issuedDateStr}` : "", dueDateStr ? `Due: ${dueDateStr}` : "", `Ref: …${shortRef}`])}
  <table class="two-col">
    <tr>
      <td class="col">
        <div class="section-title">Header</div>
        <div class="block">${companyBlock}</div>
      </td>
      <td class="col">
        <div class="section-title">Invoice</div>
        <div class="block">${headerMeta}</div>
      </td>
    </tr>
  </table>
  <table class="two-col">
    <tr>
      <td class="col">
        <div class="section-title">Bill to</div>
        <div class="block">${billToBlock}</div>
      </td>
      <td class="col">
        <div class="section-title">Billing details</div>
        <div class="block">${billingBlock}</div>
      </td>
    </tr>
  </table>
  <table>
    <thead><tr>
      <th>Description</th><th class="num">Unit price</th><th class="num">Qty</th><th class="num">Total</th>
    </tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <div class="section" style="margin-top:8px;border:1px solid #d0d5dd;border-radius:6px;padding:8px;">
    <div class="section-title">Payment summary</div>
    <div class="kv"><span class="k">Subtotal</span><span class="v">${formatMoneyWithCurrency(subTotal, cc)}</span></div>
    ${
      includeVat
        ? `<div class="kv"><span class="k">VAT (${vatBracketLabel})</span><span class="v">${formatMoneyWithCurrency(taxAmount, cc)}</span></div>`
        : ""
    }
    <div class="kv"><span class="k">Total</span><span class="v">${formatMoneyWithCurrency(totalAmount, cc)}</span></div>
    <div class="kv"><span class="k">Amount paid</span><span class="v">${amountPaidDisplay}</span></div>
    <div class="grand">Balance due: ${balanceDueDisplay}</div>
  </div>
  <div class="foot">Payment due within agreed terms. Thank you for your business.</div>
  `;
  const inner = isVoided
    ? `<div class="watermark-wrap"><div class="watermark">Voided</div>${invoiceBody}</div>`
    : invoiceBody;
  return docShell(`Invoice ${shortRef}`, inner);
}

/**
 * @param {{
 *   business?: { companyName?: string | null, companyTagline?: string | null, companyLogoDataUri?: string | null, companyAddress?: string | null, companyPhone?: string | null } | null,
 *   client?: { name?: string | null, phone?: string | null, email?: string | null, typeLabel?: string | null, notes?: string | null } | null,
 *   project?: {
 *     name?: string | null,
 *     status?: string | null,
 *     opportunityName?: string | null,
 *     opportunityLocation?: string | null,
 *     opportunityContactName?: string | null,
 *     opportunityContactPhone?: string | null,
 *     opportunityContactEmail?: string | null,
 *   } | null,
 *   receiptRef: string,
 *   paymentRef?: string | null,
 *   invoiceRef?: string | null,
 *   invoiceStatus?: string | null,
 *   receiptDateStr?: string | null,
 *   paymentDateStr?: string | null,
 *   paymentMethod?: string | null,
 *   paymentStatus?: string | null,
 *   paymentAmount: number,
 *   invoiceTotalStr?: string | null,
 *   outstandingInvoiceStr?: string | null,
 *   outstandingOverallStr?: string | null,
 *   thankYouNote?: string | null,
 *   currencyCode?: string | null,
 * }} opts
 */
function buildPaymentReceiptPdfHtml(opts) {
  const business = opts.business ?? null;
  const client = opts.client ?? null;
  const project = opts.project ?? null;
  const cc = normalizeCurrencyCode(opts.currencyCode ?? DEFAULT_CURRENCY_CODE);
  const fullRef = String(opts.receiptRef);
  const shortRef = fullRef.slice(0, 8);

  /** @type {string[]} */
  const businessLines = [];
  if (business?.companyName && String(business.companyName).trim() !== "") {
    businessLines.push(`<div class="line">${escapeHtml(String(business.companyName))}</div>`);
  }
  if (business?.companyAddress && String(business.companyAddress).trim() !== "") {
    businessLines.push(`<div class="line">${escapeHtmlMultiline(business.companyAddress)}</div>`);
  }
  if (business?.companyPhone && String(business.companyPhone).trim() !== "") {
    businessLines.push(`<div class="line">Phone: ${escapeHtml(String(business.companyPhone))}</div>`);
  }
  const businessBlock =
    businessLines.length > 0
      ? `<table class="two-col"><tr><td class="col"><div class="section-title">Business</div><div class="block">${businessLines.join("")}</div></td>`
      : `<table class="two-col"><tr><td class="col"><div class="section-title">Business</div><div class="block"><div class="line">—</div></div></td>`;

  /** @type {string[]} */
  const clientLines = [];
  if (client?.name && String(client.name).trim() !== "") {
    clientLines.push(`<div class="line">${escapeHtml(String(client.name))}</div>`);
  }
  if (client?.phone && String(client.phone).trim() !== "") {
    clientLines.push(`<div class="line">Phone: ${escapeHtml(String(client.phone))}</div>`);
  }
  if (client?.email && String(client.email).trim() !== "") {
    clientLines.push(`<div class="line">Email: ${escapeHtml(String(client.email))}</div>`);
  }
  if (clientLines.length === 0) {
    clientLines.push(`<div class="line muted">Client details not provided</div>`);
  }
  const clientBlock =
    clientLines.length > 0
      ? `<td class="col"><div class="section-title">Client</div><div class="block">${clientLines.join("")}</div></td></tr></table>`
      : `<td class="col"><div class="section-title">Client</div><div class="block"><div class="line">—</div></div></td></tr></table>`;

  const projectName = project?.name && String(project.name).trim() !== "" ? String(project.name).trim() : "";
  const opportunityName =
    project?.opportunityName && String(project.opportunityName).trim() !== "" ? String(project.opportunityName).trim() : "";
  const workLocation =
    project?.opportunityLocation && String(project.opportunityLocation).trim() !== ""
      ? String(project.opportunityLocation).trim()
      : "";
  const baseDescription = projectName || opportunityName;
  const descriptionValue = baseDescription
    ? workLocation
      ? `${baseDescription} - ${workLocation}`
      : baseDescription
    : "";
  const descriptionSection = descriptionValue
    ? `<div class="section"><div class="section-title">Description</div><div class="block">${escapeHtml(descriptionValue)}</div></div>`
    : "";

  /** @type {string[]} */
  const referenceLines = [];
  referenceLines.push(`<div class="kv"><span class="k">Receipt #</span><span class="v">…${escapeHtml(shortRef)}</span></div>`);
  if (opts.invoiceRef && String(opts.invoiceRef).trim() !== "") {
    const invoiceRef = String(opts.invoiceRef);
    referenceLines.push(
      `<div class="kv"><span class="k">Invoice #</span><span class="v">…${escapeHtml(invoiceRef.slice(0, 8))}</span></div>`
    );
  }
  const referenceSection = `<div class="section"><div class="section-title">References</div>${referenceLines.join("")}</div>`;

  const paymentDate = opts.paymentDateStr || opts.receiptDateStr || null;
  const paymentMethod = opts.paymentMethod && String(opts.paymentMethod).trim() !== "" ? String(opts.paymentMethod) : "—";
  const paymentStatus = opts.paymentStatus && String(opts.paymentStatus).trim() !== "" ? String(opts.paymentStatus) : "posted";
  const isVoidedPayment = paymentStatus.toLowerCase() === "voided";
  const amountReceived = formatMoneyWithCurrency(opts.paymentAmount, cc);
  const paymentSummarySection = `<div class="payment-highlight">
    <div class="amount-label">Amount Received</div>
    <div class="amount-emphasis">${amountReceived}</div>
    <div class="kv"><span class="k">Payment date</span><span class="v">${escapeHtml(paymentDate || "—")}</span></div>
    <div class="kv"><span class="k">Payment method</span><span class="v">${escapeHtml(paymentMethod)}</span></div>
  </div>`;

  /** @type {string[]} */
  const balanceLines = [];
  if (opts.invoiceTotalStr && String(opts.invoiceTotalStr).trim() !== "") {
    balanceLines.push(
      `<div class="kv"><span class="k">Invoice total</span><span class="v">${escapeHtml(String(opts.invoiceTotalStr))}</span></div>`
    );
  }
  balanceLines.push(`<div class="kv"><span class="k">Amount paid</span><span class="v">${amountReceived}</span></div>`);
  if (opts.outstandingInvoiceStr && String(opts.outstandingInvoiceStr).trim() !== "") {
    balanceLines.push(
      `<div class="divider"></div><div class="kv"><span class="k">Balance remaining</span><span class="v">${escapeHtml(String(
        opts.outstandingInvoiceStr
      ))}</span></div>`
    );
  } else {
    balanceLines.push(`<div class="divider"></div><div class="kv"><span class="k">Balance remaining</span><span class="v">—</span></div>`);
  }
  if (opts.outstandingOverallStr && String(opts.outstandingOverallStr).trim() !== "") {
    balanceLines.push(
      `<div class="kv"><span class="k">Total outstanding (all invoices)</span><span class="v">${escapeHtml(String(
        opts.outstandingOverallStr
      ))}</span></div>`
    );
  }
  const balanceSection =
    balanceLines.length > 0
      ? `<div class="section"><div class="section-title">Balance summary</div>${balanceLines.join("")}</div>`
      : "";

  const thankYouText =
    opts.thankYouNote && String(opts.thankYouNote).trim() !== ""
      ? String(opts.thankYouNote)
      : "Thank you for your payment. We appreciate your business.";

  const receiptBody = `
  ${buildBrandHeaderHtml(business?.companyName, business?.companyTagline, business?.companyLogoDataUri)}
  ${buildDocumentHeaderHtml("Payment Receipt", projectName || opportunityName || null, [paymentDate ? `Paid: ${paymentDate}` : "", `Ref: …${shortRef}`])}
  ${paymentSummarySection}
  ${businessBlock}${clientBlock}
  ${descriptionSection}
  ${referenceSection}
  ${balanceSection}
  <div class="section">
    <div class="section-title">Acknowledgment</div>
    <div class="block">${escapeHtmlMultiline(thankYouText)}</div>
  </div>
  <div class="foot">Payment received with thanks.</div>
  `;
  const inner = isVoidedPayment
    ? `<div class="watermark-wrap"><div class="watermark">Voided</div>${receiptBody}</div>`
    : receiptBody;
  return docShell(`Receipt ${shortRef}`, inner);
}

/**
 * @param {{
 *   companyName?: string | null,
 *   companyTagline?: string | null,
 *   companyLogoDataUri?: string | null,
 *   generatedAtStr: string,
 *   rows: Array<{ projectName: string, collected: number, spent: number, profit: number }>,
 * }} opts
 */
function buildProjectProfitReportPdfHtml(opts) {
  const { companyName, companyTagline, companyLogoDataUri, generatedAtStr, rows, currencyCode } = opts;
  const cc = normalizeCurrencyCode(currencyCode ?? DEFAULT_CURRENCY_CODE);
  const totals = rows.reduce(
    (acc, r) => {
      acc.collected += Number(r.collected) || 0;
      acc.spent += Number(r.spent) || 0;
      acc.profit += Number(r.profit) || 0;
      return acc;
    },
    { collected: 0, spent: 0, profit: 0 }
  );
  const bodyRows = rows.length
    ? rows
        .map((r) => {
          const cls = r.profit < 0 ? "profit-neg" : r.profit > 0 ? "profit-pos" : "";
          return `<tr class="compact-row">
      <td>${escapeHtml(r.projectName)}</td>
      <td class="num num-mono">${formatMoneyWithCurrency(r.collected, cc)}</td>
      <td class="num num-mono">${formatMoneyWithCurrency(r.spent, cc)}</td>
      <td class="num num-mono ${cls}">${formatMoneyWithCurrency(r.profit, cc)}</td>
    </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="muted">No project finance rows for this period.</td></tr>`;
  const totalProfitCls = totals.profit < 0 ? "profit-neg" : totals.profit > 0 ? "profit-pos" : "";

  const inner = `
  ${buildBrandHeaderHtml(companyName, companyTagline, companyLogoDataUri)}
  ${buildDocumentHeaderHtml("Project Profitability Report", "Cash collected minus project expenses", [generatedAtStr, "Page 1 / 1"])}
  <table class="report-table">
    <colgroup>
      <col style="width:46%" />
      <col style="width:18%" />
      <col style="width:18%" />
      <col style="width:18%" />
    </colgroup>
    <thead><tr>
      <th>Project</th><th class="num">Collected</th><th class="num">Expenses</th><th class="num">Profit</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td class="sum-label">Total</td>
        <td class="num num-mono">${formatMoneyWithCurrency(totals.collected, cc)}</td>
        <td class="num num-mono">${formatMoneyWithCurrency(totals.spent, cc)}</td>
        <td class="num num-mono ${totalProfitCls}">${formatMoneyWithCurrency(totals.profit, cc)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="foot">Generated by Luna BMS</div>
  `;
  return docShell("Project profitability", inner);
}

module.exports = {
  escapeHtml,
  buildQuotationPdfHtml,
  buildInvoicePdfHtml,
  buildPaymentReceiptPdfHtml,
  buildProjectProfitReportPdfHtml,
};
