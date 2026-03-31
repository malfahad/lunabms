import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { escapeHtml, formatMoney, invoiceTotal } from "@lunabms/core";
import { FinanceCard } from "../../components/FinanceCard";
import { ListEmptyState } from "../../components/ListEmptyState";
import { SimpleModal } from "../../components/SimpleModal";
import { loadImageAsDataUri } from "../../lib/pdfImageData";
import { sharePdfFromHtml } from "../../lib/sharePdf";
import { useRepos } from "../../context/DatabaseContext";
import { colors, fonts, radius, space } from "../../theme/tokens";

const REPORT_IDS = {
  cashflow: "cashflow",
  unpaid: "unpaid",
  salesWon: "sales_won",
  jobProfit: "job_profit",
};

const DATE_RANGE_OPTIONS = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_90_days", label: "Last 90 days" },
  { id: "all_time", label: "All time" },
];

const REPORT_DEFS = [
  {
    id: REPORT_IDS.cashflow,
    title: "Cash In vs Cash Out",
    subtitle: "Track money in, money out, and net cash by period.",
  },
  {
    id: REPORT_IDS.unpaid,
    title: "Unpaid Invoices",
    subtitle: "See outstanding balances and overdue invoices quickly.",
  },
  {
    id: REPORT_IDS.salesWon,
    title: "Sales Won",
    subtitle: "Accepted quotations and the value won.",
  },
  {
    id: REPORT_IDS.jobProfit,
    title: "Job Profit Summary",
    subtitle: "Compare project collections, expenses, and profit.",
  },
];

const DEFAULT_FILTERS = {
  dateRange: "this_month",
  projectId: "all",
  clientId: "all",
  overdueOnly: false,
  linkMode: "all",
  projectStatus: "all",
  profitState: "all",
};

function formatReportNow() {
  return new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function shortRef(id) {
  if (!id) return "—";
  return `...${String(id).slice(0, 8)}`;
}

function isVoidedInvoice(inv) {
  return String(inv?.status || "").toLowerCase() === "voided";
}

function isVoidedPayment(payment) {
  return String(payment?.status || "").toLowerCase() === "voided";
}

function startOfDayTs(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getDateRangeBounds(rangeId) {
  const now = Date.now();
  const today = new Date(now);
  const startToday = startOfDayTs(now);
  if (rangeId === "all_time") {
    return { start: null, end: null };
  }
  if (rangeId === "last_90_days") {
    return { start: startToday - 89 * 24 * 60 * 60 * 1000, end: now };
  }
  if (rangeId === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
    const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999).getTime();
    return { start, end };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

function isInRange(ts, rangeId) {
  const { start, end } = getDateRangeBounds(rangeId);
  if (!Number.isFinite(ts) || ts <= 0) return rangeId === "all_time";
  if (start != null && ts < start) return false;
  if (end != null && ts > end) return false;
  return true;
}

function periodKeyFromTs(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

function periodLabelFromKey(k) {
  const [y, m] = k.split("-").map((x) => Number(x));
  if (!y || !m) return k;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function buildSimpleTableReportPdfHtml({
  title,
  companyName,
  companyTagline,
  companyLogoDataUri,
  generatedAt,
  currencyCode,
  filterSummary,
  columns,
  rows,
}) {
  const logoData = companyLogoDataUri && String(companyLogoDataUri).trim() !== "" ? String(companyLogoDataUri).trim() : "";
  const tagline = companyTagline && String(companyTagline).trim() !== "" ? String(companyTagline).trim() : "";
  const head = columns.map((c) => `<th class="${c.numeric ? "num" : ""}">${escapeHtml(c.label)}</th>`).join("");
  const body =
    rows.length === 0
      ? `<tr><td colspan="${columns.length}">No rows for selected filters.</td></tr>`
      : rows
          .map((r) => {
            const tds = columns
              .map((c) => `<td class="${c.numeric ? "num" : ""}">${escapeHtml(String(r[c.key] ?? "—"))}</td>`)
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; padding: 28px; max-width: 900px; margin: 0 auto; font-size: 13px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 4px; font-weight: 700; }
  .meta { color: #555; margin-bottom: 14px; }
  .meta div { margin: 3px 0; }
  .brand-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .brand-logo-wrap { width: 140px; height: 56px; display: flex; align-items: center; justify-content: flex-end; }
  .brand-logo { max-width: 140px; max-height: 56px; object-fit: contain; }
  .brand-meta { flex: 1 1 auto; min-width: 0; }
  .brand-name { font-size: 18px; font-weight: 800; line-height: 1.2; color: #16202a; }
  .brand-tagline { font-size: 12px; color: #52606f; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #666; padding: 9px 8px; border-bottom: 2px solid #ddd; }
  td { padding: 9px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .foot { margin-top: 24px; font-size: 11px; color: #777; }
</style>
</head>
<body>
  ${
    companyName || tagline || logoData
      ? `<div class="brand-head">
          <div class="brand-meta">
            ${companyName ? `<div class="brand-name">${escapeHtml(companyName)}</div>` : ""}
            ${tagline ? `<div class="brand-tagline">${escapeHtml(tagline)}</div>` : ""}
          </div>
          ${logoData ? `<div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(logoData)}" alt="Business logo"/></div>` : ""}
        </div>`
      : ""
  }
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    ${companyName ? `<div><strong>Business:</strong> ${escapeHtml(companyName)}</div>` : ""}
    <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
    <div><strong>Filters:</strong> ${escapeHtml(filterSummary)}</div>
    <div><strong>Currency:</strong> ${escapeHtml(currencyCode)}</div>
  </div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="foot">End of report.</div>
</body>
</html>`;
}

export default function ReportsScreen() {
  const repos = useRepos();
  const settings = repos.appSettings.getSnapshot();
  const currencyCode = settings.currency || "UGX";
  const ugx = (n) => formatMoney(n, currencyCode);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [reportId, setReportId] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [pickerKind, setPickerKind] = useState(null);

  const refresh = useCallback(() => {
    setProjects(repos.projects.list({ includeArchived: true }));
    setClients(repos.clients.list());
    setOpportunities(repos.opportunities.list());
    setInvoices(repos.invoices.list());
    setPayments(repos.payments.list());
    setExpenses(repos.expenses.list());
  }, [repos]);
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const opportunityById = useMemo(() => Object.fromEntries(opportunities.map((o) => [o.id, o])), [opportunities]);
  const invoiceById = useMemo(() => Object.fromEntries(invoices.map((i) => [i.id, i])), [invoices]);
  const invoicesByProject = useMemo(() => {
    const map = {};
    for (const inv of invoices) {
      if (isVoidedInvoice(inv)) continue;
      if (!map[inv.project_id]) map[inv.project_id] = [];
      map[inv.project_id].push(inv);
    }
    return map;
  }, [invoices]);
  const paymentsByInvoice = useMemo(() => {
    const map = {};
    for (const p of payments) {
      if (isVoidedPayment(p)) continue;
      if (!map[p.invoice_id]) map[p.invoice_id] = [];
      map[p.invoice_id].push(p);
    }
    return map;
  }, [payments]);
  const expensesByProject = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (!map[e.project_id]) map[e.project_id] = [];
      map[e.project_id].push(e);
    }
    return map;
  }, [expenses]);

  const selectedReport = useMemo(
    () => REPORT_DEFS.find((r) => r.id === reportId) ?? null,
    [reportId]
  );

  function paymentTs(p) {
    return Number(p.paid_at ?? p.created_at ?? 0);
  }
  function expenseTs(e) {
    return Number(e.expense_date ?? e.updated_at ?? 0);
  }
  function invoiceTs(inv) {
    return Number(inv.due_date ?? inv.issued_date ?? inv.updated_at ?? 0);
  }
  function quotationTs(q) {
    return Number(q.updated_at ?? q.issued_date ?? 0);
  }

  function projectClientId(projectId) {
    const proj = projectById[projectId];
    if (!proj?.opportunity_id) return null;
    return opportunityById[proj.opportunity_id]?.client_id ?? null;
  }

  function matchesProjectAndClient(projectId, flt) {
    if (!projectId) return false;
    if (flt.projectId !== "all" && projectId !== flt.projectId) return false;
    if (flt.clientId === "all") return true;
    return projectClientId(projectId) === flt.clientId;
  }

  const rowsAndColumns = useMemo(() => {
    if (!selectedReport) return { rows: [], columns: [] };
    const flt = appliedFilters;

    if (selectedReport.id === REPORT_IDS.cashflow) {
      const buckets = {};
      for (const p of payments) {
        if (isVoidedPayment(p)) continue;
        const inv = invoiceById[p.invoice_id];
        if (!inv || isVoidedInvoice(inv)) continue;
        const projectId = inv?.project_id;
        if (!projectId || !matchesProjectAndClient(projectId, flt)) continue;
        const ts = paymentTs(p);
        if (!isInRange(ts, flt.dateRange)) continue;
        const key = periodKeyFromTs(ts);
        if (!buckets[key]) buckets[key] = { period: periodLabelFromKey(key), cashIn: 0, cashOut: 0, net: 0 };
        buckets[key].cashIn += Number(p.amount);
      }
      for (const e of expenses) {
        const projectId = e.project_id;
        if (!projectId || !matchesProjectAndClient(projectId, flt)) continue;
        const ts = expenseTs(e);
        if (!isInRange(ts, flt.dateRange)) continue;
        const key = periodKeyFromTs(ts);
        if (!buckets[key]) buckets[key] = { period: periodLabelFromKey(key), cashIn: 0, cashOut: 0, net: 0 };
        buckets[key].cashOut += Number(e.amount);
      }
      const rows = Object.keys(buckets)
        .sort()
        .map((k) => ({
          ...buckets[k],
          net: buckets[k].cashIn - buckets[k].cashOut,
        }));
      return {
        rows,
        columns: [
          { key: "period", label: "Period" },
          { key: "cashIn", label: "Cash In", numeric: true },
          { key: "cashOut", label: "Cash Out", numeric: true },
          { key: "net", label: "Net Cash", numeric: true },
        ],
      };
    }

    if (selectedReport.id === REPORT_IDS.unpaid) {
      const now = Date.now();
      const rows = [];
      for (const inv of invoices) {
        if (isVoidedInvoice(inv)) continue;
        const project = projectById[inv.project_id];
        if (!project || !matchesProjectAndClient(project.id, flt)) continue;
        const refTs = invoiceTs(inv);
        if (!isInRange(refTs, flt.dateRange)) continue;
        const balanceDue = Math.max(0, repos.finance.amountDue(inv.id));
        if (balanceDue <= 0.009) continue;
        const total = invoiceTotal(inv);
        const amountPaid = Math.max(0, total - balanceDue);
        const dueTs = Number(inv.due_date ?? 0);
        const overdueDays = dueTs > 0 ? Math.max(0, Math.floor((startOfDayTs(now) - startOfDayTs(dueTs)) / (24 * 60 * 60 * 1000))) : 0;
        if (flt.overdueOnly && overdueDays <= 0) continue;
        const clientId = projectClientId(project.id);
        rows.push({
          invoiceNo: shortRef(inv.id),
          client: clientById[clientId]?.name ?? "—",
          project: project.name ?? "—",
          issueDate: formatDay(Number(inv.issued_date ?? inv.updated_at ?? 0)),
          dueDate: formatDay(dueTs),
          invoiceTotal: total,
          amountPaid,
          balanceDue,
          daysOverdue: overdueDays,
          status: overdueDays > 0 ? "Overdue" : amountPaid > 0 ? "Partially paid" : "Unpaid",
        });
      }
      rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balanceDue - a.balanceDue);
      return {
        rows,
        columns: [
          { key: "invoiceNo", label: "Invoice #" },
          { key: "client", label: "Client" },
          { key: "project", label: "Project" },
          { key: "issueDate", label: "Issue Date" },
          { key: "dueDate", label: "Due Date" },
          { key: "invoiceTotal", label: "Invoice Total", numeric: true },
          { key: "amountPaid", label: "Amount Paid", numeric: true },
          { key: "balanceDue", label: "Balance Due", numeric: true },
          { key: "daysOverdue", label: "Days Overdue", numeric: true },
          { key: "status", label: "Status" },
        ],
      };
    }

    if (selectedReport.id === REPORT_IDS.salesWon) {
      const rows = [];
      for (const opp of opportunities) {
        if (flt.clientId !== "all" && opp.client_id !== flt.clientId) continue;
        const quotes = repos.quotations.listByOpportunity(opp.id);
        for (const q of quotes) {
          if (String(q.status || "").toLowerCase() !== "accepted") continue;
          const projectId = q.project_id ?? null;
          if (flt.projectId !== "all" && projectId !== flt.projectId) continue;
          if (flt.linkMode === "linked" && !projectId) continue;
          if (flt.linkMode === "unlinked" && projectId) continue;
          const ts = quotationTs(q);
          if (!isInRange(ts, flt.dateRange)) continue;
          const projectName = projectId ? projectById[projectId]?.name ?? shortRef(projectId) : "No";
          rows.push({
            quotationNo: shortRef(q.id),
            client: clientById[opp.client_id]?.name ?? "—",
            service: opp.name ?? "—",
            issuedDate: formatDay(Number(q.issued_date ?? 0)),
            acceptedDate: formatDay(Number(q.updated_at ?? 0)),
            quotedTotal: Number(q.total_amount ?? 0),
            status: "Accepted",
            linkedProject: projectName,
          });
        }
      }
      rows.sort((a, b) => {
        const ta = Number(new Date(a.acceptedDate).getTime() || 0);
        const tb = Number(new Date(b.acceptedDate).getTime() || 0);
        return tb - ta;
      });
      return {
        rows,
        columns: [
          { key: "quotationNo", label: "Quotation #" },
          { key: "client", label: "Client" },
          { key: "service", label: "Service / Opportunity" },
          { key: "issuedDate", label: "Issued Date" },
          { key: "acceptedDate", label: "Accepted Date" },
          { key: "quotedTotal", label: "Quoted Total", numeric: true },
          { key: "status", label: "Status" },
          { key: "linkedProject", label: "Linked Project" },
        ],
      };
    }

    const rows = [];
    for (const p of projects) {
      const archived = Number(p.archived ?? 0) === 1;
      if (flt.projectStatus === "active" && archived) continue;
      if (flt.projectStatus === "archived" && !archived) continue;
      if (flt.projectId !== "all" && p.id !== flt.projectId) continue;
      if (flt.clientId !== "all" && projectClientId(p.id) !== flt.clientId) continue;

      let collected = 0;
      const projectInvoices = invoicesByProject[p.id] ?? [];
      for (const inv of projectInvoices) {
        const invPayments = paymentsByInvoice[inv.id] ?? [];
        for (const pay of invPayments) {
          const ts = paymentTs(pay);
          if (isInRange(ts, flt.dateRange)) collected += Number(pay.amount);
        }
      }
      let spent = 0;
      const projectExpenses = expensesByProject[p.id] ?? [];
      for (const ex of projectExpenses) {
        const ts = expenseTs(ex);
        if (isInRange(ts, flt.dateRange)) spent += Number(ex.amount);
      }
      const profit = collected - spent;
      if (flt.profitState === "positive" && profit <= 0) continue;
      if (flt.profitState === "negative" && profit >= 0) continue;
      if (Math.abs(collected) < 0.001 && Math.abs(spent) < 0.001) continue;
      const cid = projectClientId(p.id);
      rows.push({
        project: p.name ?? "—",
        client: clientById[cid]?.name ?? "—",
        collected,
        expenses: spent,
        profit,
      });
    }
    rows.sort((a, b) => b.profit - a.profit);
    return {
      rows,
      columns: [
        { key: "project", label: "Project" },
        { key: "client", label: "Client" },
        { key: "collected", label: "Payments Collected", numeric: true },
        { key: "expenses", label: "Expenses", numeric: true },
        { key: "profit", label: "Profit", numeric: true },
      ],
    };
  }, [
    appliedFilters,
    expenses,
    expensesByProject,
    invoiceById,
    invoices,
    invoicesByProject,
    opportunities,
    payments,
    paymentsByInvoice,
    projectById,
    projects,
    repos,
    selectedReport,
    clientById,
    opportunityById,
  ]);

  function openReport(id) {
    setReportId(id);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  function closeReport() {
    setReportId(null);
    setPickerKind(null);
  }

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyFilters() {
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  function filterSummaryText(flt = appliedFilters) {
    const dateLabel = DATE_RANGE_OPTIONS.find((x) => x.id === flt.dateRange)?.label ?? "Custom";
    const projectLabel = flt.projectId === "all" ? "All projects" : projectById[flt.projectId]?.name ?? "Selected project";
    const clientLabel = flt.clientId === "all" ? "All clients" : clientById[flt.clientId]?.name ?? "Selected client";
    const extras = [];
    if (reportId === REPORT_IDS.unpaid) extras.push(flt.overdueOnly ? "Overdue only" : "All unpaid");
    if (reportId === REPORT_IDS.salesWon) extras.push(`Link: ${flt.linkMode}`);
    if (reportId === REPORT_IDS.jobProfit) extras.push(`Status: ${flt.projectStatus}`, `Profit: ${flt.profitState}`);
    return [dateLabel, projectLabel, clientLabel, ...extras].join(" | ");
  }

  function detailedExportRowsAndColumns() {
    const flt = appliedFilters;
    if (!selectedReport) return { rows: [], columns: [] };

    if (selectedReport.id === REPORT_IDS.cashflow) {
      const rows = [];
      for (const p of payments) {
        if (isVoidedPayment(p)) continue;
        const inv = invoiceById[p.invoice_id];
        if (!inv || isVoidedInvoice(inv)) continue;
        const projectId = inv.project_id;
        if (!projectId || !matchesProjectAndClient(projectId, flt)) continue;
        const ts = paymentTs(p);
        if (!isInRange(ts, flt.dateRange)) continue;
        rows.push({
          sortTs: ts,
          date: formatDay(ts),
          entryType: "Payment",
          project: projectById[projectId]?.name ?? "—",
          client: clientById[projectClientId(projectId)]?.name ?? "—",
          reference: shortRef(p.id),
          detail: p.method || "—",
          cashIn: Number(p.amount),
          cashOut: 0,
          net: Number(p.amount),
        });
      }
      for (const e of expenses) {
        const projectId = e.project_id;
        if (!projectId || !matchesProjectAndClient(projectId, flt)) continue;
        const ts = expenseTs(e);
        if (!isInRange(ts, flt.dateRange)) continue;
        rows.push({
          sortTs: ts,
          date: formatDay(ts),
          entryType: "Expense",
          project: projectById[projectId]?.name ?? "—",
          client: clientById[projectClientId(projectId)]?.name ?? "—",
          reference: shortRef(e.id),
          detail: e.category || e.supplier_name || "—",
          cashIn: 0,
          cashOut: Number(e.amount),
          net: -Number(e.amount),
        });
      }
      rows.sort((a, b) => Number(b.sortTs || 0) - Number(a.sortTs || 0));
      return {
        rows,
        columns: [
          { key: "date", label: "Date" },
          { key: "entryType", label: "Type" },
          { key: "project", label: "Project" },
          { key: "client", label: "Client" },
          { key: "reference", label: "Ref" },
          { key: "detail", label: "Detail" },
          { key: "cashIn", label: "Cash In", numeric: true },
          { key: "cashOut", label: "Cash Out", numeric: true },
          { key: "net", label: "Net", numeric: true },
        ],
      };
    }

    if (selectedReport.id === REPORT_IDS.jobProfit) {
      const rows = [];
      for (const p of payments) {
        if (isVoidedPayment(p)) continue;
        const inv = invoiceById[p.invoice_id];
        if (!inv || isVoidedInvoice(inv)) continue;
        const projectId = inv.project_id;
        const project = projectById[projectId];
        if (!project) continue;
        const archived = Number(project.archived ?? 0) === 1;
        if (flt.projectStatus === "active" && archived) continue;
        if (flt.projectStatus === "archived" && !archived) continue;
        if (flt.projectId !== "all" && projectId !== flt.projectId) continue;
        const clientId = projectClientId(projectId);
        if (flt.clientId !== "all" && clientId !== flt.clientId) continue;
        const ts = paymentTs(p);
        if (!isInRange(ts, flt.dateRange)) continue;
        rows.push({
          sortTs: ts,
          date: formatDay(ts),
          project: project.name ?? "—",
          client: clientById[clientId]?.name ?? "—",
          entryType: "Payment",
          reference: shortRef(p.id),
          detail: p.method || "—",
          cashIn: Number(p.amount),
          cashOut: 0,
          profitImpact: Number(p.amount),
        });
      }
      for (const e of expenses) {
        const projectId = e.project_id;
        const project = projectById[projectId];
        if (!project) continue;
        const archived = Number(project.archived ?? 0) === 1;
        if (flt.projectStatus === "active" && archived) continue;
        if (flt.projectStatus === "archived" && !archived) continue;
        if (flt.projectId !== "all" && projectId !== flt.projectId) continue;
        const clientId = projectClientId(projectId);
        if (flt.clientId !== "all" && clientId !== flt.clientId) continue;
        const ts = expenseTs(e);
        if (!isInRange(ts, flt.dateRange)) continue;
        rows.push({
          sortTs: ts,
          date: formatDay(ts),
          project: project.name ?? "—",
          client: clientById[clientId]?.name ?? "—",
          entryType: "Expense",
          reference: shortRef(e.id),
          detail: e.category || e.supplier_name || "—",
          cashIn: 0,
          cashOut: Number(e.amount),
          profitImpact: -Number(e.amount),
        });
      }
      rows.sort((a, b) => Number(b.sortTs || 0) - Number(a.sortTs || 0));
      if (flt.profitState === "positive") {
        return { rows: rows.filter((r) => Number(r.profitImpact) > 0), columns: [
          { key: "date", label: "Date" },
          { key: "project", label: "Project" },
          { key: "client", label: "Client" },
          { key: "entryType", label: "Type" },
          { key: "reference", label: "Ref" },
          { key: "detail", label: "Detail" },
          { key: "cashIn", label: "Cash In", numeric: true },
          { key: "cashOut", label: "Cash Out", numeric: true },
          { key: "profitImpact", label: "Profit Impact", numeric: true },
        ] };
      }
      if (flt.profitState === "negative") {
        return { rows: rows.filter((r) => Number(r.profitImpact) < 0), columns: [
          { key: "date", label: "Date" },
          { key: "project", label: "Project" },
          { key: "client", label: "Client" },
          { key: "entryType", label: "Type" },
          { key: "reference", label: "Ref" },
          { key: "detail", label: "Detail" },
          { key: "cashIn", label: "Cash In", numeric: true },
          { key: "cashOut", label: "Cash Out", numeric: true },
          { key: "profitImpact", label: "Profit Impact", numeric: true },
        ] };
      }
      return {
        rows,
        columns: [
          { key: "date", label: "Date" },
          { key: "project", label: "Project" },
          { key: "client", label: "Client" },
          { key: "entryType", label: "Type" },
          { key: "reference", label: "Ref" },
          { key: "detail", label: "Detail" },
          { key: "cashIn", label: "Cash In", numeric: true },
          { key: "cashOut", label: "Cash Out", numeric: true },
          { key: "profitImpact", label: "Profit Impact", numeric: true },
        ],
      };
    }

    // Unpaid invoices and Sales Won are already itemized datasets.
    return rowsAndColumns;
  }

  async function exportReportPdf() {
    if (!selectedReport) return;
    const detail = detailedExportRowsAndColumns();
    const rows = detail.rows;
    const columns = detail.columns;
    if (rows.length === 0) return;
    const pdfRows = rows.map((r) => {
      const out = {};
      for (const c of columns) {
        const v = r[c.key];
        out[c.key] = c.numeric ? ugx(Number(v ?? 0)) : String(v ?? "—");
      }
      return out;
    });
    const logoDataUri = await loadImageAsDataUri(settings.company_logo_local_url || settings.company_logo_url || null);
    const html = buildSimpleTableReportPdfHtml({
      title: selectedReport.title,
      companyName: settings.company_name || null,
      companyTagline: settings.company_tagline || null,
      companyLogoDataUri: logoDataUri,
      generatedAt: formatReportNow(),
      currencyCode,
      filterSummary: filterSummaryText(appliedFilters),
      columns,
      rows: pdfRows,
    });
    await sharePdfFromHtml(html, `report-${selectedReport.id}-${Date.now()}`);
  }

  function renderListRow(item) {
    if (reportId === REPORT_IDS.cashflow) {
      return (
        <FinanceCard
          title={item.period}
          subtitle="Cash movement"
          amount={ugx(item.net)}
          amountTone={item.net < 0 ? "expense" : item.net > 0 ? "payment" : "default"}
          detail={`In ${ugx(item.cashIn)} · Out ${ugx(item.cashOut)}`}
          borderAccent={item.net < 0 ? colors.financeExpense : colors.financePayment}
        />
      );
    }
    if (reportId === REPORT_IDS.unpaid) {
      return (
        <FinanceCard
          title={`${item.invoiceNo} · ${item.client}`}
          subtitle={`${item.project} · Due ${item.dueDate}`}
          amount={ugx(item.balanceDue)}
          amountTone="expense"
          detail={`${item.status} · ${item.daysOverdue} day(s) overdue`}
          borderAccent={colors.financeExpense}
        />
      );
    }
    if (reportId === REPORT_IDS.salesWon) {
      return (
        <FinanceCard
          title={`${item.quotationNo} · ${item.client}`}
          subtitle={`${item.service} · Accepted ${item.acceptedDate}`}
          amount={ugx(item.quotedTotal)}
          amountTone="payment"
          detail={`Linked project: ${item.linkedProject}`}
          borderAccent={colors.financePayment}
        />
      );
    }
    return (
      <FinanceCard
        title={`${item.project} · ${item.client}`}
        subtitle="Payments collected − expenses"
        amount={ugx(item.profit)}
        amountTone={item.profit < 0 ? "expense" : item.profit > 0 ? "payment" : "default"}
        detail={`In ${ugx(item.collected)} · Out ${ugx(item.expenses)}`}
        borderAccent={item.profit < 0 ? colors.financeExpense : colors.financePayment}
      />
    );
  }

  const reportListHeader = (
    <View style={styles.intro}>
      <Text style={styles.introTag}>Reports</Text>
      <Text style={styles.introTitle}>Simple reports</Text>
      <Text style={styles.introSub}>Open a report, apply filters, then export as PDF.</Text>
    </View>
  );

  const detailHeader = (
    <View style={styles.intro}>
      <View style={styles.introTop}>
        <View style={styles.introTextBlock}>
          <Text style={styles.introTag}>Reports</Text>
          <Text style={styles.introTitle}>{selectedReport?.title || "Report"}</Text>
          <Text style={styles.introSub}>{selectedReport?.subtitle || ""}</Text>
        </View>
        <Pressable onPress={closeReport} style={styles.ghostBtn} accessibilityRole="button">
          <Text style={styles.ghostBtnText}>Back</Text>
        </Pressable>
      </View>
      <View style={styles.filtersWrap}>
        <Text style={styles.filterLabel}>Date range</Text>
        <View style={styles.chipRow}>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setFilter("dateRange", opt.id)}
              style={[styles.chip, filters.dateRange === opt.id && styles.chipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, filters.dateRange === opt.id && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filterRow}>
          <Pressable style={styles.selectorBtn} onPress={() => setPickerKind("project")} accessibilityRole="button">
            <Text style={styles.selectorLabel}>
              Project: {filters.projectId === "all" ? "All projects" : projectById[filters.projectId]?.name ?? "Selected"}
            </Text>
          </Pressable>
          <Pressable style={styles.selectorBtn} onPress={() => setPickerKind("client")} accessibilityRole="button">
            <Text style={styles.selectorLabel}>
              Client: {filters.clientId === "all" ? "All clients" : clientById[filters.clientId]?.name ?? "Selected"}
            </Text>
          </Pressable>
        </View>
        {reportId === REPORT_IDS.unpaid ? (
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setFilter("overdueOnly", !filters.overdueOnly)}
              style={[styles.chip, filters.overdueOnly && styles.chipActive]}
            >
              <Text style={[styles.chipText, filters.overdueOnly && styles.chipTextActive]}>
                {filters.overdueOnly ? "Overdue only" : "All unpaid"}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {reportId === REPORT_IDS.salesWon ? (
          <View style={styles.chipRow}>
            {["all", "linked", "unlinked"].map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setFilter("linkMode", mode)}
                style={[styles.chip, filters.linkMode === mode && styles.chipActive]}
              >
                <Text style={[styles.chipText, filters.linkMode === mode && styles.chipTextActive]}>
                  {mode === "all" ? "All links" : mode === "linked" ? "Linked only" : "Unlinked only"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {reportId === REPORT_IDS.jobProfit ? (
          <View style={styles.chipRow}>
            {["all", "active", "archived"].map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setFilter("projectStatus", mode)}
                style={[styles.chip, filters.projectStatus === mode && styles.chipActive]}
              >
                <Text style={[styles.chipText, filters.projectStatus === mode && styles.chipTextActive]}>
                  {mode === "all" ? "All status" : mode}
                </Text>
              </Pressable>
            ))}
            {["all", "positive", "negative"].map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setFilter("profitState", mode)}
                style={[styles.chip, filters.profitState === mode && styles.chipActive]}
              >
                <Text style={[styles.chipText, filters.profitState === mode && styles.chipTextActive]}>
                  {mode === "all" ? "All profit" : mode}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.actionsRow}>
          <Pressable style={styles.ghostBtn} onPress={resetFilters} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Reset</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={applyFilters} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Apply filters</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, rowsAndColumns.rows.length === 0 && styles.exportPdfBtnDisabled]}
            onPress={exportReportPdf}
            disabled={rowsAndColumns.rows.length === 0}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Export PDF</Text>
          </Pressable>
        </View>
        <Text style={styles.filterSummary}>Applied: {filterSummaryText(appliedFilters)}</Text>
      </View>
    </View>
  );

  const pickerOptions =
    pickerKind === "project"
      ? [{ id: "all", label: "All projects" }, ...projects.map((p) => ({ id: p.id, label: p.name || shortRef(p.id) }))]
      : pickerKind === "client"
        ? [{ id: "all", label: "All clients" }, ...clients.map((c) => ({ id: c.id, label: c.name || shortRef(c.id) }))]
        : [];

  const emptyTitle = selectedReport ? `No rows for ${selectedReport.title.toLowerCase()}` : "No reports";
  const emptyMessage =
    selectedReport
      ? "Try widening your filters (date range, project, or client), then apply again."
      : "Choose a report to continue.";

  return (
    <View style={styles.wrap}>
      {reportId == null ? (
        <FlatList
          data={REPORT_DEFS}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={reportListHeader}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => openReport(item.id)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>{item.title}</Text>
                <Text style={styles.reportSub}>{item.subtitle}</Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={rowsAndColumns.rows}
          keyExtractor={(item, idx) => `${reportId}-${idx}`}
          ListHeaderComponent={detailHeader}
          contentContainerStyle={rowsAndColumns.rows.length === 0 ? styles.listEmpty : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <ListEmptyState
                variant="reports"
                title={emptyTitle}
                message={emptyMessage}
                ctaLabel="Reset filters"
                onCta={resetFilters}
              />
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.itemWrap}>
              {renderListRow(item)}
            </View>
          )}
        />
      )}
      <SimpleModal visible={pickerKind != null} title={pickerKind === "project" ? "Select project" : "Select client"} onClose={() => setPickerKind(null)}>
        {pickerOptions.map((opt) => (
          <Pressable
            key={opt.id}
            style={styles.optionRow}
            onPress={() => {
              if (pickerKind === "project") setFilter("projectId", opt.id);
              if (pickerKind === "client") setFilter("clientId", opt.id);
              setPickerKind(null);
            }}
          >
            <Text style={styles.optionRowText}>{opt.label}</Text>
          </Pressable>
        ))}
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: 120 },
  listEmpty: { flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 280, paddingHorizontal: space.safe },
  intro: { paddingHorizontal: space.safe, paddingTop: space.md, paddingBottom: space.md },
  introTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: 8,
  },
  introTextBlock: { flex: 1, minWidth: 0 },
  exportPdfBtnDisabled: { opacity: 0.45 },
  introTag: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  introTitle: { fontSize: 20, fontFamily: fonts.displayBold, color: colors.onBackground },
  introSub: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 6 },
  reportCard: {
    marginHorizontal: space.safe,
    marginBottom: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  reportTitle: { fontSize: 16, fontFamily: fonts.bodySemi, color: colors.onBackground, marginBottom: 4 },
  reportSub: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  filtersWrap: {
    marginTop: 6,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    padding: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    gap: 10,
  },
  filterLabel: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  chipActive: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  chipTextActive: { color: colors.primary, fontFamily: fonts.bodySemi },
  filterRow: { flexDirection: "row", gap: 8 },
  selectorBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  selectorLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.onBackground },
  actionsRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  ghostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  ghostBtnText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.onBackground },
  primaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.onPrimary },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
  },
  secondaryBtnText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.primary },
  filterSummary: { fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  itemWrap: { paddingHorizontal: space.safe },
  optionRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  optionRowText: { fontSize: 14, fontFamily: fonts.body, color: colors.onBackground },
});
