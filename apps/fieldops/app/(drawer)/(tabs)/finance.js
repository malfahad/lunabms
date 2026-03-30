import { useCallback, useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, FlatList, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FinanceCard } from "../../../components/FinanceCard";
import { FinanceNewMenu } from "../../../components/FinanceNewMenu";
import { FormField } from "../../../components/FormField";
import { ListEmptyState } from "../../../components/ListEmptyState";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenFab } from "../../../components/ScreenFab";
import { SimpleModal } from "../../../components/SimpleModal";
import {
  buildInvoicePdfHtml,
  buildInvoiceReminderMessage,
  buildPaymentReceiptPdfHtml,
  buildPaymentShareMessage,
  computeInvoiceTotals,
  invoiceTotal,
  UGANDA_VAT_RATE,
  formatMoney,
} from "@servops/core";
import { sharePdfFromHtml } from "../../../lib/sharePdf";
import { useRepos } from "../../../context/DatabaseContext";
import { persistExpenseReceiptImage } from "../../../lib/persistReceipt";
import { loadImageAsDataUri } from "../../../lib/pdfImageData";
import { QUOTATION_STATUS } from "../../../constants/quotation";
import { sharedStyles } from "../../../theme/styles";
import { colors, fonts, radius, space } from "../../../theme/tokens";

function formatShort(ts) {
  if (ts == null || ts === "") return null;
  try {
    return new Date(Number(ts)).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function newLineKey() {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Line items for the invoice form from the opportunity's accepted quotation for this project, or null if none. */
function invoiceLinesFromAcceptedQuotation(repos, projectId) {
  const proj = repos.projects.get(projectId);
  if (!proj?.opportunity_id) return null;
  const quotes = repos.quotations.listByOpportunity(proj.opportunity_id);
  const accepted = quotes.find(
    (q) =>
      String(q.status || "").toLowerCase() === QUOTATION_STATUS.accepted &&
      String(q.project_id || "") === String(projectId)
  );
  if (!accepted) return null;
  const rows = repos.quotationLineItems.listByQuotation(accepted.id);
  if (!rows.length) return null;
  return rows.map((r) => ({
    key: newLineKey(),
    description: String(r.description ?? ""),
    quantity: String(r.quantity != null && r.quantity !== "" ? r.quantity : 1),
    unitPrice: String(r.unit_price ?? ""),
  }));
}

export default function FinanceScreen() {
  const repos = useRepos();
  const router = useRouter();
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  // Shadow the legacy `ugx()` formatter so we can reuse existing JSX without changing every call site.
  const ugx = (n) => formatMoney(n, currencyCode);
  const { invoiceProjectId, invoiceTaskTitle } = useLocalSearchParams();
  const [tab, setTab] = useState("invoices");
  const [summary, setSummary] = useState({
    outstanding: 0,
    monthlyCollected: 0,
    monthlyExpenses: 0,
    monthlyNet: 0,
    invoiceCount: 0,
  });
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [menu, setMenu] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);

  const [projId, setProjId] = useState(null);
  const [lineItems, setLineItems] = useState([{ key: newLineKey(), description: "", quantity: "1", unitPrice: "" }]);
  const [includeVat, setIncludeVat] = useState(true);
  const [retainerApply, setRetainerApply] = useState("");
  const [dueInDays, setDueInDays] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [expenseSupplierId, setExpenseSupplierId] = useState(null);
  const [informalSupplierName, setInformalSupplierName] = useState("");
  const [expenseReceiptUri, setExpenseReceiptUri] = useState(null);
  const [supplierModal, setSupplierModal] = useState(false);
  const [newSupName, setNewSupName] = useState("");
  const [newSupCategory, setNewSupCategory] = useState("");
  const [newSupContact, setNewSupContact] = useState("");
  const [category, setCategory] = useState("");
  const [payInvId, setPayInvId] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payIncludeThankYou, setPayIncludeThankYou] = useState(true);
  const [projects, setProjects] = useState([]);

  const applyInvoiceDefaults = useCallback(() => {
    const s = repos.appSettings.getSnapshot();
    setIncludeVat(s.default_include_vat === "1");
    setDueInDays(s.default_invoice_due_days || "");
  }, [repos]);

  const refresh = useCallback(() => {
    setSummary(repos.finance.summary());
    setInvoices(repos.invoices.list());
    setExpenses(repos.expenses.list());
    setPayments(repos.payments.list());
    setProjects(repos.projects.list());
    setSuppliers(repos.suppliers.list());
  }, [repos]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  useEffect(() => {
    const pid = Array.isArray(invoiceProjectId) ? invoiceProjectId[0] : invoiceProjectId;
    const taskTitle = Array.isArray(invoiceTaskTitle) ? invoiceTaskTitle[0] : invoiceTaskTitle;
    if (!pid) return;
    setProjId(pid);
    const fromQuote = invoiceLinesFromAcceptedQuotation(repos, pid);
    if (fromQuote) setLineItems(fromQuote);
    else
      setLineItems([
        { key: newLineKey(), description: (taskTitle && String(taskTitle)) || "Services", quantity: "1", unitPrice: "" },
      ]);
    applyInvoiceDefaults();
    setRetainerApply("");
    setInvoiceModal(true);
    setTab("invoices");
    router.setParams({ invoiceProjectId: undefined, invoiceTaskTitle: undefined });
  }, [invoiceProjectId, invoiceTaskTitle, router, applyInvoiceDefaults, repos]);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);
  const invoiceById = useMemo(() => Object.fromEntries(invoices.map((i) => [i.id, i])), [invoices]);

  const vatEnabled = repos.appSettings.getSnapshot().default_include_vat === "1";
  const invoiceIncludeVat = vatEnabled && includeVat;

  const paidByInvoice = useMemo(() => {
    const m = {};
    for (const p of payments) {
      const id = p.invoice_id;
      m[id] = (m[id] || 0) + Number(p.amount);
    }
    return m;
  }, [payments]);

  const paymentInvoiceRows = useMemo(() => {
    return invoices.map((inv) => {
      const proj = projectById[inv.project_id];
      let clientName = null;
      if (proj?.opportunity_id) {
        const opp = repos.opportunities.get(proj.opportunity_id);
        if (opp?.client_id) {
          const c = repos.clients.get(opp.client_id);
          clientName = c?.name || null;
        }
      }
      return {
        inv,
        proj,
        clientName,
        due: repos.finance.amountDue(inv.id),
        total: invoiceTotal(inv),
      };
    });
  }, [invoices, projectById, repos]);

  async function exportInvoicePdf(inv) {
    const snap = repos.appSettings.getSnapshot();
    const cc = snap.currency || "UGX";
    const logoDataUri = await loadImageAsDataUri(snap.company_logo_local_url || snap.company_logo_url || null);
    const proj = repos.projects.get(inv.project_id) ?? projectById[inv.project_id];
    let opp = null;
    let clientRow = null;
    if (proj?.opportunity_id) {
      opp = repos.opportunities.get(proj.opportunity_id);
      if (opp?.client_id) {
        clientRow = repos.clients.get(opp.client_id);
      }
    }
    const lines = repos.invoiceLineItems.listByInvoice(inv.id);
    const total = invoiceTotal(inv);
    const due = repos.finance.amountDue(inv.id);
    const paid = Math.max(0, total - due);
    const tr = inv.tax_rate != null ? Number(inv.tax_rate) : null;
    const taxRateLabel = tr != null && !Number.isNaN(tr) ? `${Math.round(tr * 100)}%` : null;

    let retainerSummary = null;
    if (proj?.retainer_id) {
      const r = repos.retainers.get(proj.retainer_id);
      if (r) {
        retainerSummary = `${formatMoney(r.balance, cc)} balance · ${formatMoney(r.total_amount, cc)} total`;
      }
    }

    const paymentRows = repos.payments.listByInvoice(inv.id);

    const html = buildInvoicePdfHtml({
      business: {
        companyName: snap.company_name || null,
        companyTagline: snap.company_tagline || null,
        companyLogoDataUri: logoDataUri,
        companyAddress: snap.company_address || null,
        companyPhone: snap.company_phone || null,
      },
      client: clientRow
        ? {
            name: clientRow.name || null,
            phone: clientRow.phone || null,
            email: clientRow.email || null,
            typeLabel: clientRow.type || clientRow.kind || null,
            notes: clientRow.notes || null,
          }
        : null,
      project: proj
        ? {
            name: proj.name || null,
            status: proj.status || null,
            budgetLabel:
              proj.budget != null && proj.budget !== "" ? formatMoney(Number(proj.budget), cc) : null,
            startDateStr: formatShort(proj.start_date),
            endDateStr: formatShort(proj.end_date),
            opportunityName: opp?.name || null,
            opportunityLocation: opp?.location || null,
            opportunityValueLabel: (() => {
              if (!opp) return null;
              if (opp.estimated_value != null && opp.estimated_value !== "")
                return formatMoney(Number(opp.estimated_value), cc);
              if (opp.value != null && opp.value !== "") return formatMoney(Number(opp.value), cc);
              return null;
            })(),
            opportunityContactName: opp?.contact_name || null,
            opportunityContactPhone: opp?.contact_phone || null,
            opportunityContactEmail: opp?.contact_email || null,
            retainerSummary,
            archivedLabel: Number(proj.archived) === 1 ? "Archived" : null,
          }
        : null,
      invoiceRef: inv.id,
      invoiceStatus: inv.status,
      issuedDateStr: formatShort(inv.issued_date),
      dueDateStr: formatShort(inv.due_date),
      updatedAtStr: formatShort(inv.updated_at),
      taxRateLabel,
      amountPaidStr: formatMoney(paid, cc),
      balanceDueStr: formatMoney(due, cc),
      paymentsCount: paymentRows.length,
      lines,
      subTotal: Number(inv.sub_total),
      taxAmount: Number(inv.tax_amount ?? inv.tax ?? 0),
      totalAmount: total,
      includeVat:
        snap.default_include_vat === "1" && Number(inv.tax_amount ?? inv.tax ?? 0) > 0.001,
      currencyCode: cc,
    });
    await sharePdfFromHtml(html, `invoice-${String(inv.id).slice(0, 8)}`);
  }

  async function exportPaymentReceiptPdf(payment, receiptRow = null) {
    const snap = repos.appSettings.getSnapshot();
    const cc = snap.currency || "UGX";
    const logoDataUri = await loadImageAsDataUri(snap.company_logo_local_url || snap.company_logo_url || null);
    const inv = repos.invoices.get(payment.invoice_id) ?? invoiceById[payment.invoice_id] ?? null;
    const proj = inv ? repos.projects.get(inv.project_id) ?? projectById[inv.project_id] ?? null : null;
    let opp = null;
    let clientRow = null;
    if (proj?.opportunity_id) {
      opp = repos.opportunities.get(proj.opportunity_id);
      if (opp?.client_id) {
        clientRow = repos.clients.get(opp.client_id);
      }
    }

    const rec = receiptRow ?? repos.receipts.getByPaymentId(payment.id);
    const invoiceTotalAmount = inv ? invoiceTotal(inv) : null;
    const invoiceOutstanding = inv ? Math.max(0, repos.finance.amountDue(inv.id)) : null;
    const globalOutstanding = Math.max(0, repos.finance.summary().outstanding);
    const companyName = snap.company_name || null;
    const clientName = clientRow?.name ? String(clientRow.name).trim() : "";
    const thankYou =
      clientName !== ""
        ? `Thank you ${clientName} for your payment. ${companyName ? `${companyName} appreciates your continued trust.` : "We appreciate your continued trust."}`
        : companyName
          ? `Thank you for your payment. ${companyName} appreciates your continued trust.`
          : "Thank you for your payment. We appreciate your continued trust.";

    const html = buildPaymentReceiptPdfHtml({
      business: {
        companyName,
        companyTagline: snap.company_tagline || null,
        companyLogoDataUri: logoDataUri,
        companyAddress: snap.company_address || null,
        companyPhone: snap.company_phone || null,
      },
      client: clientRow
        ? {
            name: clientRow.name || null,
            phone: clientRow.phone || null,
            email: clientRow.email || null,
            typeLabel: clientRow.type || clientRow.kind || null,
            notes: clientRow.notes || null,
          }
        : null,
      project: proj
        ? {
            name: proj.name || null,
            status: proj.status || null,
            opportunityName: opp?.name || null,
            opportunityLocation: opp?.location || null,
            opportunityContactName: opp?.contact_name || null,
            opportunityContactPhone: opp?.contact_phone || null,
            opportunityContactEmail: opp?.contact_email || null,
          }
        : null,
      receiptRef: rec?.id || payment.id,
      paymentRef: payment.id,
      invoiceRef: inv?.id || null,
      invoiceStatus: inv?.status || null,
      receiptDateStr: formatShort(rec?.generated_at ?? payment.paid_at ?? payment.created_at),
      paymentDateStr: formatShort(payment.paid_at ?? payment.created_at),
      paymentMethod: payment.method || null,
      paymentAmount: Number(payment.amount),
      invoiceTotalStr: invoiceTotalAmount != null ? formatMoney(invoiceTotalAmount, cc) : null,
      outstandingInvoiceStr: invoiceOutstanding != null ? formatMoney(invoiceOutstanding, cc) : null,
      outstandingOverallStr: formatMoney(globalOutstanding, cc),
      thankYouNote: thankYou,
      currencyCode: cc,
    });

    await sharePdfFromHtml(html, `receipt-${String(rec?.id || payment.id).slice(0, 8)}`);
  }

  function openInvoiceReminder(inv) {
    const balance = repos.finance.amountDue(inv.id);
    const proj = projectById[inv.project_id];
    let client = null;
    if (proj?.opportunity_id) {
      const opp = repos.opportunities.get(proj.opportunity_id);
      if (opp?.client_id) client = repos.clients.get(opp.client_id);
    }
    const snap = repos.appSettings.getSnapshot();
    const msg = buildInvoiceReminderMessage(
      inv,
      proj?.name ?? null,
      client,
      snap.company_name || null,
      balance,
      { currencyCode }
    );
    const digits = client?.phone ? String(client.phone).replace(/\D/g, "") : "";
    const url =
      digits.length >= 8
        ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open link", "Install WhatsApp or try again.");
    });
  }

  function pick(kind) {
    refresh();
    setProjects(repos.projects.list());
    if (kind === "invoice") {
      setProjId(null);
      setLineItems([{ key: newLineKey(), description: "", quantity: "1", unitPrice: "" }]);
      applyInvoiceDefaults();
      setRetainerApply("");
      setInvoiceModal(true);
    } else if (kind === "expense") {
      setProjId(null);
      setExpAmount("");
      setExpenseSupplierId(null);
      setInformalSupplierName("");
      setExpenseReceiptUri(null);
      setCategory("");
      setSuppliers(repos.suppliers.list());
      setExpenseModal(true);
    } else {
      setPayInvId(null);
      setPayAmount("");
      setPayMethod("cash");
      setPayIncludeThankYou(true);
      setPaymentModal(true);
    }
  }

  const parsedLinesForTotals = useMemo(() => {
    return lineItems
      .map((ln) => ({
        quantity: Number(String(ln.quantity).replace(/,/g, "")) || 1,
        unit_price: Number(String(ln.unitPrice).replace(/,/g, "")),
      }))
      .filter((ln) => !Number.isNaN(ln.unit_price));
  }, [lineItems]);

  const invoiceTotalsPreview = useMemo(
    () => computeInvoiceTotals(parsedLinesForTotals, { includeVat: invoiceIncludeVat }),
    [parsedLinesForTotals, invoiceIncludeVat]
  );

  const selectedRetainer = useMemo(() => {
    const p = projId ? projectById[projId] : null;
    if (!p?.retainer_id) return null;
    return repos.retainers.get(p.retainer_id);
  }, [projId, projectById, repos]);

  function saveInvoice() {
    if (!projId) return;
    const lines = lineItems
      .map((ln) => ({
        description: ln.description.trim(),
        quantity: Number(String(ln.quantity).replace(/,/g, "")) || 1,
        unit_price: Number(String(ln.unitPrice).replace(/,/g, "")),
      }))
      .filter((ln) => !Number.isNaN(ln.unit_price));
    if (lines.length === 0) return;
    const totals = computeInvoiceTotals(lines, { includeVat: invoiceIncludeVat });
    let due = null;
    const rawDue = dueInDays.trim();
    if (rawDue !== "" && !Number.isNaN(Number(rawDue))) {
      due = Date.now() + Number(rawDue) * 86400000;
    }
    const inv = repos.invoices.insert({
      project_id: projId,
      sub_total: totals.subTotal,
      tax: totals.taxAmount,
      tax_amount: totals.taxAmount,
      tax_rate: totals.taxRate,
      total_amount: totals.totalAmount,
      status: "issued",
      due_date: due,
    });
    repos.invoiceLineItems.replaceForInvoice(
      inv.id,
      lines.map((ln) => ({
        description: ln.description || "Line",
        quantity: ln.quantity,
        unit_price: ln.unit_price,
      }))
    );
    let applyAmt = 0;
    if (selectedRetainer && retainerApply.trim() !== "") {
      applyAmt = Number(retainerApply.replace(/,/g, ""));
      if (!Number.isNaN(applyAmt)) {
        applyAmt = Math.max(
          0,
          Math.min(applyAmt, Number(selectedRetainer.balance), totals.totalAmount)
        );
        if (applyAmt > 0) {
          try {
            repos.retainerApplications.applyToInvoice({
              invoice_id: inv.id,
              retainer_id: selectedRetainer.id,
              amount_applied: applyAmt,
            });
          } catch (e) {
            Alert.alert("Client deposit", e instanceof Error ? e.message : "Could not apply client deposit credit.");
          }
        }
      }
    }
    setInvoiceModal(false);
    refresh();
    setTab("invoices");
  }

  async function captureReceiptFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera", "Camera permission is needed to photograph receipts.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (r.canceled) return;
    const uri = r.assets[0]?.uri;
    if (!uri) return;
    try {
      const stored = await persistExpenseReceiptImage(uri);
      setExpenseReceiptUri(stored);
    } catch {
      Alert.alert("Receipt", "Could not save the photo.");
    }
  }

  async function pickReceiptFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Photo library access lets you attach receipt images.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });
    if (r.canceled) return;
    const uri = r.assets[0]?.uri;
    if (!uri) return;
    try {
      const stored = await persistExpenseReceiptImage(uri);
      setExpenseReceiptUri(stored);
    } catch {
      Alert.alert("Receipt", "Could not save the image.");
    }
  }

  function receiptAttachMenu() {
    const buttons = [
      { text: "Take photo", onPress: () => void captureReceiptFromCamera() },
      { text: "Choose from library", onPress: () => void pickReceiptFromLibrary() },
    ];
    if (expenseReceiptUri) {
      buttons.push({ text: "Remove attachment", style: "destructive", onPress: () => setExpenseReceiptUri(null) });
    }
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Receipt photo", "Optional — manual amount entry always works without a photo.", buttons);
  }

  function saveNewSupplier() {
    if (!newSupName.trim()) return;
    const s = repos.suppliers.insert({
      name: newSupName.trim(),
      category: newSupCategory.trim() || null,
      contact: newSupContact.trim() || null,
    });
    setSupplierModal(false);
    setNewSupName("");
    setNewSupCategory("");
    setNewSupContact("");
    refresh();
    setExpenseSupplierId(s.id);
  }

  function saveExpense() {
    if (!projId || !expAmount.trim()) return;
    const supRow = expenseSupplierId ? repos.suppliers.get(expenseSupplierId) : null;
    repos.expenses.insert({
      project_id: projId,
      amount: Number(expAmount.replace(/,/g, "")),
      supplier_id: expenseSupplierId,
      supplier_name: supRow?.name ?? (informalSupplierName.trim() || null),
      category: category.trim() || null,
      receipt_url: expenseReceiptUri,
    });
    setExpenseModal(false);
    setExpenseReceiptUri(null);
    refresh();
    setTab("expenses");
  }

  function updateLine(key, field, value) {
    setLineItems((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addInvoiceLine() {
    setLineItems((rows) => [...rows, { key: newLineKey(), description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeInvoiceLine(key) {
    setLineItems((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  function savePayment() {
    if (!payInvId || !payAmount.trim()) return;
    const pay = repos.payments.insert({
      invoice_id: payInvId,
      amount: Number(payAmount.replace(/,/g, "")),
      method: payMethod.trim() || "cash",
    });
    const invRow = repos.invoices.get(payInvId);
    const projRow = invRow ? repos.projects.get(invRow.project_id) : null;
    let clientRow = null;
    if (projRow?.opportunity_id) {
      const opp = repos.opportunities.get(projRow.opportunity_id);
      if (opp?.client_id) clientRow = repos.clients.get(opp.client_id);
    }
    const body = buildPaymentShareMessage(pay, invRow, projRow, clientRow, { includeThankYou: payIncludeThankYou, currencyCode });
    setPaymentModal(false);
    refresh();
    setTab("payments");
    Alert.alert("Payment recorded", "A receipt message is ready to share.", [
      {
        text: "Share…",
        onPress: () => {
          Share.share({ message: body, title: "Receipt" }).catch(() => {});
        },
      },
      {
        text: "WhatsApp",
        onPress: () => {
          const url = `https://wa.me/?text=${encodeURIComponent(body)}`;
          Linking.openURL(url).catch(() => {});
        },
      },
      { text: "OK", style: "cancel" },
    ]);
  }

  const listData = tab === "invoices" ? invoices : tab === "expenses" ? expenses : payments;

  const listEmpty =
    tab === "invoices"
      ? {
          variant: "finance",
          title: "No invoices yet",
          message:
            "Create invoices from a project. Tax and totals update as you edit, even when you are offline.",
          ctaLabel: "New invoice",
          onCta: () => pick("invoice"),
        }
      : tab === "expenses"
        ? {
            variant: "finance",
            title: "No expenses yet",
            message: "Log materials, transport, and petty cash by project so profit reflects real spend.",
            ctaLabel: "Log expense",
            onCta: () => pick("expense"),
          }
        : {
            variant: "finance",
            title: "No payments yet",
            message: "Record cash, mobile money, or bank receipts against an invoice to clear balances.",
            ctaLabel: "Record payment",
            onCta: () => pick("payment"),
          };

  function renderCard({ item }) {
    if (tab === "invoices") {
      const inv = item;
      const total = invoiceTotal(inv);
      const paid = paidByInvoice[inv.id] || 0;
      const retainerApplied = repos.retainerApplications
        .listByInvoice(inv.id)
        .reduce((s, a) => s + Number(a.amount_applied), 0);
      const balance = repos.finance.amountDue(inv.id);
      const projName = projectById[inv.project_id]?.name || "Project";
      const isPaid = balance <= 0.001;
      const isOverdue = !isPaid && inv.due_date != null && Number(inv.due_date) < Date.now();
      const dueStr = formatShort(inv.due_date);

      let borderAccent = colors.primary;
      let amountTone = "default";
      let badge = { label: (inv.status || "issued").replace(/\b\w/g, (c) => c.toUpperCase()), tone: "neutral" };
      if (isPaid) {
        borderAccent = colors.financePositive;
        amountTone = "positive";
        badge = { label: "Paid", tone: "positive" };
      } else if (isOverdue) {
        borderAccent = colors.financeWarning;
        amountTone = "warning";
        badge = { label: "Overdue", tone: "warning" };
      }

      const creditBit =
        retainerApplied > 0 ? ` · Client deposit credit ${ugx(retainerApplied)}` : "";

      return (
        <FinanceCard
          title={`Invoice · ${String(inv.id).slice(0, 8)}`}
          subtitle={projName}
          amount={ugx(total)}
          amountTone={amountTone}
          detail={
            isPaid
              ? `Collected ${ugx(paid)}${creditBit}`
              : `Balance ${ugx(balance)} · Paid ${ugx(paid)}${creditBit}${dueStr ? ` · Due ${dueStr}` : ""}`
          }
          badge={badge}
          borderAccent={borderAccent}
          action={isOverdue && !isPaid ? { label: "WhatsApp reminder", onPress: () => openInvoiceReminder(inv) } : null}
          secondaryAction={{ label: "Export PDF", onPress: () => exportInvoicePdf(inv) }}
        />
      );
    }

    if (tab === "expenses") {
      const e = item;
      const projName = projectById[e.project_id]?.name || "Project";
      const linkedName = e.supplier_id ? supplierById[e.supplier_id]?.name : null;
      const vendorLabel = linkedName || e.supplier_name?.trim() || null;
      const title = e.category?.trim() || vendorLabel || "Expense";
      const sub = [vendorLabel, projName].filter(Boolean).join(" · ");
      const receiptUri = e.receipt_url ? String(e.receipt_url) : null;
      return (
        <FinanceCard
          title={title}
          subtitle={sub || projName}
          amount={ugx(e.amount)}
          amountTone="expense"
          detail={formatShort(e.expense_date) ? `Logged ${formatShort(e.expense_date)}` : null}
          badge={receiptUri ? { label: "Receipt", tone: "neutral" } : null}
          borderAccent={colors.financeExpense}
          thumbnailUri={receiptUri}
        />
      );
    }

    const p = item;
    const inv = invoiceById[p.invoice_id];
    const projName = inv ? projectById[inv.project_id]?.name : null;
    const sub = projName
      ? `${projName} · inv …${String(p.invoice_id).slice(0, 6)}`
      : `Invoice …${String(p.invoice_id).slice(0, 8)}`;
    const when = formatShort(p.paid_at ?? p.created_at);
    const rec = repos.receipts.getByPaymentId(p.id);
    const recBit = rec ? `Receipt …${String(rec.id).slice(0, 6)}` : null;
    return (
      <FinanceCard
        title="Payment received"
        subtitle={sub}
        amount={ugx(p.amount)}
        amountTone="payment"
        detail={[p.method, when ? when : null, recBit].filter(Boolean).join(" · ")}
        badge={rec ? { label: "Receipt", tone: "neutral", onPress: () => void exportPaymentReceiptPdf(p, rec) } : null}
        borderAccent={colors.financePayment}
      />
    );
  }

  const header = (
    <View style={styles.headerBand}>
      <View style={styles.monthBlock}>
        <Text style={styles.monthTitle}>This month</Text>
        <Text style={styles.monthSub}>Collected vs expenses → net (cash-basis)</Text>
        <View style={styles.monthGrid}>
          <View style={styles.monthCell}>
            <Text style={styles.monthLabel}>Collected</Text>
            <Text style={[styles.monthValue, styles.collected]}>{ugx(summary.monthlyCollected)}</Text>
          </View>
          <View style={styles.monthCell}>
            <Text style={styles.monthLabel}>Expenses</Text>
            <Text style={[styles.monthValue, styles.spent]}>{ugx(summary.monthlyExpenses)}</Text>
          </View>
          <View style={styles.monthCell}>
            <Text style={styles.monthLabel}>Net</Text>
            <Text style={[styles.monthValue, summary.monthlyNet >= 0 ? styles.netUp : styles.netDown]}>
              {ugx(summary.monthlyNet)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.outstandingStrip}>
        <Text style={styles.outstandingLabel}>Outstanding (net of deposits)</Text>
        <Text style={styles.outstandingValue}>{ugx(summary.outstanding)}</Text>
      </View>

      <View style={styles.tabs}>
        {[
          { key: "invoices", label: "Invoices" },
          { key: "expenses", label: "Expenses" },
          { key: "payments", label: "Payments" },
        ].map(({ key, label }) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
            <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabHint}>
        {tab === "invoices" ? (
          <Text style={styles.tabHintTxt}>
            {ugx(summary.outstanding)} unpaid · {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          </Text>
        ) : tab === "expenses" ? (
          <Text style={styles.tabHintTxt}>
            {ugx(summary.monthlyExpenses)} logged this month · {expenses.length} total rows
          </Text>
        ) : (
          <Text style={styles.tabHintTxt}>
            {ugx(summary.monthlyCollected)} collected this month · {payments.length} payment
            {payments.length === 1 ? "" : "s"}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={sharedStyles.screen}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <ListEmptyState {...listEmpty} />
          </View>
        }
        contentContainerStyle={listData.length === 0 ? styles.listEmpty : styles.list}
      />
      <ScreenFab
        label="+ Invoice / Expense"
        onPress={() => setMenu(true)}
        accessibilityLabel="New invoice, expense, or payment"
      />
      <FinanceNewMenu visible={menu} onClose={() => setMenu(false)} onSelect={pick} />

      <SimpleModal visible={invoiceModal} title="New invoice" onClose={() => setInvoiceModal(false)}>
        <Text style={sharedStyles.pickerLabel}>Project *</Text>
        <View style={sharedStyles.chipRow}>
          {projects.map((p) => (
            <Pressable
              key={p.id}
              style={[sharedStyles.chip, projId === p.id && sharedStyles.chipActive]}
              onPress={() => {
                setProjId(p.id);
                const fromQuote = invoiceLinesFromAcceptedQuotation(repos, p.id);
                setLineItems(fromQuote ?? [{ key: newLineKey(), description: "", quantity: "1", unitPrice: "" }]);
              }}
            >
              <Text
                style={[sharedStyles.chipText, projId === p.id && sharedStyles.chipTextActive]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.linesHeading}>Line items</Text>
        {lineItems.map((ln, idx) => (
          <View key={ln.key} style={styles.lineBlock}>
            <View style={styles.lineTop}>
              <Text style={styles.lineNum}>Line {idx + 1}</Text>
              {lineItems.length > 1 ? (
                <Pressable onPress={() => removeInvoiceLine(ln.key)} hitSlop={8}>
                  <Text style={styles.lineRemove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <FormField
              label="Description"
              value={ln.description}
              onChangeText={(v) => updateLine(ln.key, "description", v)}
              placeholder="e.g. Labour, materials"
            />
            <View style={styles.lineQtyRow}>
              <View style={styles.lineQtyCell}>
                <FormField
                  label="Qty"
                  value={ln.quantity}
                  onChangeText={(v) => updateLine(ln.key, "quantity", v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.lineQtyCell}>
                <FormField
                  label={`Unit (${currencyCode})`}
                  value={ln.unitPrice}
                  onChangeText={(v) => updateLine(ln.key, "unitPrice", v)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        ))}
        <Pressable onPress={addInvoiceLine} style={styles.addLineBtn}>
          <Text style={styles.addLineBtnText}>+ Add line</Text>
        </Pressable>
        {vatEnabled ? (
          <Pressable
            onPress={() => setIncludeVat(!includeVat)}
            style={styles.vatRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: includeVat }}
          >
            <View style={[styles.checkbox, includeVat && styles.checkboxOn]} />
            <Text style={styles.vatLabel}>Include VAT ({Math.round(UGANDA_VAT_RATE * 100)}% on net)</Text>
          </Pressable>
        ) : null}
        <View style={styles.totalsBox}>
          <Text style={styles.totalsLine}>Net {ugx(invoiceTotalsPreview.subTotal)}</Text>
          {vatEnabled ? (
            includeVat ? (
              <Text style={styles.totalsLine}>VAT {ugx(invoiceTotalsPreview.taxAmount)}</Text>
            ) : (
              <Text style={styles.totalsMuted}>VAT off — totals are net only</Text>
            )
          ) : null}
          <Text style={styles.totalsTotal}>Invoice total {ugx(invoiceTotalsPreview.totalAmount)}</Text>
        </View>
        {selectedRetainer ? (
          <>
            <Text style={sharedStyles.hint}>
              Client deposit balance {ugx(selectedRetainer.balance)} — apply up to invoice total.
            </Text>
            <FormField
              label={`Apply client deposit (${currencyCode})`}
              value={retainerApply}
              onChangeText={setRetainerApply}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </>
        ) : null}
        <FormField
          label="Due in (days)"
          value={dueInDays}
          onChangeText={setDueInDays}
          keyboardType="number-pad"
          placeholder="Optional"
        />
        <PrimaryButton
          title="Save invoice"
          onPress={saveInvoice}
          disabled={!projId || parsedLinesForTotals.length === 0}
        />
      </SimpleModal>

      <SimpleModal visible={expenseModal} title="New expense" onClose={() => setExpenseModal(false)}>
        <Text style={sharedStyles.pickerLabel}>Project *</Text>
        <View style={sharedStyles.chipRow}>
          {projects.map((p) => (
            <Pressable
              key={p.id}
              style={[sharedStyles.chip, projId === p.id && sharedStyles.chipActive]}
              onPress={() => setProjId(p.id)}
            >
              <Text
                style={[sharedStyles.chipText, projId === p.id && sharedStyles.chipTextActive]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={sharedStyles.pickerLabel}>Supplier</Text>
        <View style={sharedStyles.chipRow}>
          <Pressable
            style={[sharedStyles.chip, expenseSupplierId === null && sharedStyles.chipActive]}
            onPress={() => setExpenseSupplierId(null)}
          >
            <Text
              style={[
                sharedStyles.chipText,
                expenseSupplierId === null && sharedStyles.chipTextActive,
              ]}
              numberOfLines={1}
            >
              Informal
            </Text>
          </Pressable>
          {suppliers.map((s) => (
            <Pressable
              key={s.id}
              style={[sharedStyles.chip, expenseSupplierId === s.id && sharedStyles.chipActive]}
              onPress={() => setExpenseSupplierId(s.id)}
            >
              <Text
                style={[sharedStyles.chipText, expenseSupplierId === s.id && sharedStyles.chipTextActive]}
                numberOfLines={1}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.addSupChip} onPress={() => setSupplierModal(true)}>
            <Text style={styles.addSupChipText}>+ New</Text>
          </Pressable>
        </View>
        {expenseSupplierId === null ? (
          <FormField
            label="Supplier name (optional)"
            value={informalSupplierName}
            onChangeText={setInformalSupplierName}
            placeholder="e.g. roadside vendor"
          />
        ) : null}
        <FormField label="Amount *" value={expAmount} onChangeText={setExpAmount} keyboardType="decimal-pad" />
        <FormField label="Category" value={category} onChangeText={setCategory} placeholder="Timber, fuel…" />
        <Pressable style={styles.receiptBtn} onPress={receiptAttachMenu}>
          <Text style={styles.receiptBtnText}>{expenseReceiptUri ? "Change receipt photo" : "Attach receipt photo"}</Text>
        </Pressable>
        {expenseReceiptUri ? (
          <Image source={{ uri: expenseReceiptUri }} style={styles.receiptPreview} accessibilityLabel="Receipt preview" />
        ) : null}
        <PrimaryButton title="Save expense" onPress={saveExpense} disabled={!projId || !expAmount.trim()} />
      </SimpleModal>

      <SimpleModal visible={supplierModal} title="New supplier" onClose={() => setSupplierModal(false)}>
        <FormField label="Name *" value={newSupName} onChangeText={setNewSupName} placeholder="Company name" />
        <FormField label="Category" value={newSupCategory} onChangeText={setNewSupCategory} placeholder="Optional" />
        <FormField label="Contact" value={newSupContact} onChangeText={setNewSupContact} placeholder="Phone or email" />
        <PrimaryButton title="Save supplier" onPress={saveNewSupplier} disabled={!newSupName.trim()} />
      </SimpleModal>

      <SimpleModal visible={paymentModal} title="Record payment" onClose={() => setPaymentModal(false)}>
        <Text style={sharedStyles.pickerLabel}>Invoice *</Text>
        {invoices.length === 0 ? (
          <Text style={sharedStyles.hint}>Create an invoice first.</Text>
        ) : (
          <ScrollView
            style={styles.payInvoiceScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {paymentInvoiceRows.map(({ inv, proj, clientName, due, total }) => {
              const selected = payInvId === inv.id;
              const issuedStr = formatShort(inv.issued_date);
              const dueStr = formatShort(inv.due_date);
              const refShort = String(inv.id).slice(0, 8);
              return (
                <Pressable
                  key={inv.id}
                  onPress={() => setPayInvId(inv.id)}
                  style={[styles.payInvoiceCard, selected && styles.payInvoiceCardOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Project ${proj?.name ?? "unknown"}, invoice …${refShort}, balance due ${ugx(due)}`}
                >
                  <View style={styles.payInvoiceCardTop}>
                    <Text style={styles.payInvoiceProject} numberOfLines={2}>
                      {proj?.name ?? "Unknown project"}
                    </Text>
                    {Number(proj?.archived) === 1 ? (
                      <View style={styles.payInvoiceArchivedPill}>
                        <Text style={styles.payInvoiceArchivedTxt}>Archived</Text>
                      </View>
                    ) : null}
                  </View>
                  {clientName ? (
                    <Text style={styles.payInvoiceClient} numberOfLines={1}>
                      Client · {clientName}
                    </Text>
                  ) : (
                    <Text style={styles.payInvoiceClientMuted}>No client linked (no opportunity client)</Text>
                  )}
                  <View style={styles.payInvoiceDivider} />
                  <Text style={styles.payInvoiceSectionLab}>Invoice</Text>
                  <Text style={styles.payInvoiceMetaLine}>
                    Ref …{refShort} · {inv.status ? String(inv.status) : "—"}
                  </Text>
                  <Text style={styles.payInvoiceMetaLine}>
                    {issuedStr ? `Issued ${issuedStr}` : "Issued —"}
                    {dueStr ? ` · Due ${dueStr}` : ""}
                  </Text>
                  <View style={styles.payInvoiceAmounts}>
                    <View style={styles.payInvoiceAmtCol}>
                      <Text style={styles.payInvoiceAmtLabel}>Invoice total</Text>
                      <Text style={styles.payInvoiceAmtVal}>{ugx(total)}</Text>
                    </View>
                    <View style={[styles.payInvoiceAmtCol, styles.payInvoiceAmtColRight]}>
                      <Text style={styles.payInvoiceAmtLabel}>Balance due</Text>
                      <Text style={[styles.payInvoiceAmtVal, styles.payInvoiceDue]}>{ugx(due)}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <FormField label="Amount *" value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" />
        <FormField label="Method" value={payMethod} onChangeText={setPayMethod} placeholder="cash, momo, bank…" />
        <Pressable
          onPress={() => setPayIncludeThankYou((v) => !v)}
          style={styles.thankYouToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: payIncludeThankYou }}
        >
          <Text style={styles.thankYouToggleText}>
            {payIncludeThankYou ? "✓ " : ""}Include suggested thank-you line for client (when client is known via opportunity)
          </Text>
        </Pressable>
        <PrimaryButton title="Save payment" onPress={savePayment} disabled={!payInvId || !payAmount.trim()} />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBand: {
    backgroundColor: colors.surfaceContainerLow,
    paddingBottom: space.md,
    marginBottom: space.xs,
  },
  monthBlock: {
    paddingHorizontal: space.safe,
    paddingTop: space.md,
  },
  monthTitle: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  monthSub: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 4,
    marginBottom: space.sm,
  },
  monthGrid: { flexDirection: "row", gap: space.sm },
  monthCell: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  monthLabel: {
    fontSize: 10,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  monthValue: { fontSize: 15, fontFamily: fonts.displayBold },
  collected: { color: colors.financePayment },
  spent: { color: colors.financeExpense },
  netUp: { color: colors.financePayment },
  netDown: { color: colors.financeExpense },
  outstandingStrip: {
    marginTop: space.md,
    marginHorizontal: space.safe,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHighest,
  },
  outstandingLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  outstandingValue: {
    fontSize: 20,
    fontFamily: fonts.displayExtraBold,
    color: colors.onBackground,
    marginTop: 4,
  },
  tabs: { flexDirection: "row", marginTop: space.md, paddingHorizontal: space.md, gap: space.sm },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
  },
  tabOn: { backgroundColor: colors.secondaryContainer },
  tabTxt: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  tabTxtOn: { color: colors.primary, fontFamily: fonts.bodyBold },
  tabHint: { paddingHorizontal: space.safe, marginTop: space.sm },
  tabHintTxt: { fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  list: { paddingBottom: 120, paddingTop: space.sm },
  listEmpty: { flexGrow: 1, paddingBottom: 120 },
  emptyWrap: { flex: 1, minHeight: 280, paddingHorizontal: space.safe },
  linesHeading: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: space.sm,
    marginTop: space.sm,
  },
  lineBlock: {
    marginBottom: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  lineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  lineNum: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
  },
  lineRemove: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  lineQtyRow: { flexDirection: "row", gap: space.sm },
  lineQtyCell: { flex: 1 },
  addLineBtn: { alignSelf: "flex-start", marginBottom: space.md },
  addLineBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  vatRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  checkboxOn: { borderColor: colors.primary, backgroundColor: colors.secondaryContainer },
  vatLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.onBackground, flex: 1 },
  totalsBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  totalsLine: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  totalsMuted: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant, fontStyle: "italic" },
  totalsTotal: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
    marginTop: 6,
  },
  addSupChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  addSupChipText: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  receiptBtn: {
    alignSelf: "flex-start",
    marginBottom: space.sm,
    paddingVertical: 8,
  },
  receiptBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  receiptPreview: {
    width: "100%",
    maxWidth: 220,
    height: 140,
    borderRadius: radius.md,
    marginBottom: space.md,
    backgroundColor: colors.surfaceContainerHighest,
  },
  thankYouToggle: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  thankYouToggleText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    lineHeight: 18,
  },
  payInvoiceScroll: {
    maxHeight: 320,
    marginBottom: space.md,
  },
  payInvoiceCard: {
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    borderLeftWidth: 4,
    borderLeftColor: colors.outlineVariant,
  },
  payInvoiceCardOn: {
    borderColor: colors.primary,
    borderLeftColor: colors.primary,
    backgroundColor: colors.secondaryContainer,
  },
  payInvoiceCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
    marginBottom: 4,
  },
  payInvoiceProject: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
  },
  payInvoiceArchivedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerHighest,
  },
  payInvoiceArchivedTxt: {
    fontSize: 10,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  payInvoiceClient: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: space.sm,
  },
  payInvoiceClientMuted: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    fontStyle: "italic",
    marginBottom: space.sm,
  },
  payInvoiceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginBottom: space.sm,
  },
  payInvoiceSectionLab: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  payInvoiceMetaLine: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onBackground,
    marginBottom: 2,
  },
  payInvoiceAmounts: {
    flexDirection: "row",
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  payInvoiceAmtCol: { flex: 1 },
  payInvoiceAmtColRight: { alignItems: "flex-end" },
  payInvoiceAmtLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: 2,
  },
  payInvoiceAmtVal: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
  },
  payInvoiceDue: { color: colors.financeWarning },
});
