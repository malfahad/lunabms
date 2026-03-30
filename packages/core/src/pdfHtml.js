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
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; padding: 28px; max-width: 720px; margin: 0 auto; font-size: 14px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 6px; font-weight: 700; }
  .company { font-size: 13px; color: #444; margin-bottom: 16px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 18px; }
  .meta div { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; padding: 10px 8px; border-bottom: 2px solid #ddd; }
  td { padding: 10px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 20px; text-align: right; }
  .totals-row { margin: 4px 0; font-size: 14px; }
  .grand { font-size: 17px; font-weight: 700; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ccc; }
  .foot { margin-top: 32px; font-size: 11px; color: #888; }
  .profit-pos { color: #0d6b3e; font-weight: 600; }
  .profit-neg { color: #a61b1b; font-weight: 600; }
  .intro { font-size: 13px; color: #444; margin-bottom: 18px; line-height: 1.5; }
  .two-col { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .two-col td.col { width: 50%; vertical-align: top; padding: 0 12px 0 0; }
  .two-col td.col:last-child { padding: 0 0 0 12px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; font-weight: 700; margin: 0 0 8px; }
  .block { font-size: 13px; color: #222; line-height: 1.55; }
  .block .line { margin: 3px 0; }
  .section { margin-bottom: 18px; }
  .kv { margin: 5px 0; font-size: 13px; }
  .kv .k { color: #555; font-weight: 600; }
  .kv .k::after { content: " "; }
  .kv .v { color: #1a1a1a; }
  .ref-full { font-size: 11px; color: #666; word-break: break-all; margin-top: 4px; }
  .payment-highlight { background: #f3f7ff; border: 1px solid #d8e4ff; border-radius: 10px; padding: 14px; margin: 14px 0 18px; }
  .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: #3d5da8; font-weight: 700; margin-bottom: 4px; }
  .amount-emphasis { font-size: 29px; line-height: 1.2; font-weight: 800; color: #12337a; margin: 0 0 10px; }
  .divider { border-top: 1px solid #ddd; margin: 10px 0; }
  .muted { color: #555; }
  .quote-highlight { background: #f8fafc; border: 1px solid #dbe4ef; border-radius: 10px; padding: 14px; margin: 12px 0 16px; }
  .quote-tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: #3f556b; font-weight: 700; margin-bottom: 4px; }
  .quote-service { font-size: 20px; line-height: 1.3; font-weight: 700; margin: 0 0 8px; color: #16202a; }
  .quote-total { font-size: 26px; line-height: 1.2; font-weight: 800; color: #0f2f71; margin: 0; }
  .scope-list { margin: 0; padding-left: 18px; }
  .scope-list li { margin: 5px 0; }
  .acceptance-lines { margin-top: 8px; }
  .acceptance-lines .line { margin: 10px 0; white-space: pre; }
  .brand-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 0 0 16px; padding: 0 0 10px; border-bottom: 1px solid #e6e6e6; }
  .brand-logo-wrap { width: 140px; height: 56px; display: flex; align-items: center; justify-content: flex-end; flex: 0 0 auto; }
  .brand-logo { max-width: 140px; max-height: 56px; object-fit: contain; }
  .brand-meta { flex: 1 1 auto; min-width: 0; }
  .brand-name { font-size: 18px; font-weight: 800; color: #122132; line-height: 1.2; }
  .brand-tagline { font-size: 12px; color: #52606f; margin-top: 3px; line-height: 1.4; }
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
  <h1>QUOTATION</h1>
  ${quoteSummary}
  ${fromBlock}${clientBlock}
  ${valueSection}
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

  const inner = `
  ${buildBrandHeaderHtml(business.companyName, business.companyTagline, business.companyLogoDataUri)}
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
  <div class="section" style="margin-top:18px;border:1px solid #ddd;border-radius:10px;padding:12px;">
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

  const inner = `
  ${buildBrandHeaderHtml(business?.companyName, business?.companyTagline, business?.companyLogoDataUri)}
  <h1>RECEIPT</h1>
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
  const bodyRows = rows
    .map((r) => {
      const cls = r.profit < 0 ? "profit-neg" : r.profit > 0 ? "profit-pos" : "";
      return `<tr>
      <td>${escapeHtml(r.projectName)}</td>
      <td class="num">${formatMoneyWithCurrency(r.collected, cc)}</td>
      <td class="num">${formatMoneyWithCurrency(r.spent, cc)}</td>
      <td class="num ${cls}">${formatMoneyWithCurrency(r.profit, cc)}</td>
    </tr>`;
    })
    .join("");

  const inner = `
  ${buildBrandHeaderHtml(companyName, companyTagline, companyLogoDataUri)}
  <h1>Project profitability</h1>
  ${companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ""}
  <div class="meta"><div><strong>Report date:</strong> ${escapeHtml(generatedAtStr)}</div>
  <div>Cash collected on invoices minus project expenses.</div></div>
  <table>
    <thead><tr>
      <th>Project</th><th class="num">Collected</th><th class="num">Expenses</th><th class="num">Profit</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="foot">Generated by ServOps</div>
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
