import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { FormField } from "../../../../components/FormField";
import { PrimaryButton } from "../../../../components/PrimaryButton";
import { SimpleModal } from "../../../../components/SimpleModal";
import { OPPORTUNITY_PIPELINE_STATUSES } from "../../../../constants/opportunityPipeline";
import { QUOTATION_STATUS, QUOTATION_STATUS_LABELS } from "../../../../constants/quotation";
import {
  buildQuotationPdfHtml,
  computeInvoiceTotals,
  lineNetAmount,
  LWWConflictError,
  UGANDA_VAT_RATE,
  formatMoney,
} from "@servops/core";
import { sharePdfFromHtml } from "../../../../lib/sharePdf";
import { loadImageAsDataUri } from "../../../../lib/pdfImageData";
import { useRepos } from "../../../../context/DatabaseContext";
import { sharedStyles } from "../../../../theme/styles";
import { colors, fonts, radius, space } from "../../../../theme/tokens";

function formatCapturedAt(ts) {
  if (ts == null || ts === "") return "—";
  try {
    return new Date(Number(ts)).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function labelForStatus(s) {
  const key = String(s || "").toLowerCase();
  return QUOTATION_STATUS_LABELS[key] ?? s ?? "—";
}

function formatClientRelationshipLabel(kind, type) {
  const k = String(kind ?? type ?? "").trim().toLowerCase();
  if (k === "client") return "Client";
  if (k === "supplier") return "Supplier";
  const t = String(type ?? kind ?? "").trim();
  return t || null;
}

function newQuoteLineKey() {
  return `qln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Index into {@link OPPORTUNITY_PIPELINE_STATUSES}; unknown values default to Prospecting. */
function pipelineStageIndex(status) {
  const s = String(status ?? "").trim();
  if (!s) return 0;
  const lc = s.toLowerCase();
  const i = OPPORTUNITY_PIPELINE_STATUSES.findIndex((x) => x.toLowerCase() === lc);
  return i >= 0 ? i : 0;
}

export default function OpportunityDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const repos = useRepos();

  const [opp, setOpp] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [quoteLinesByQuoteId, setQuoteLinesByQuoteId] = useState({});
  const [quoteModal, setQuoteModal] = useState(false);
  const [quoteLineItems, setQuoteLineItems] = useState([
    { key: newQuoteLineKey(), description: "", quantity: "1", unitPrice: "" },
  ]);
  const [quoteIncludeVat, setQuoteIncludeVat] = useState(true);
  const [editingQuotationId, setEditingQuotationId] = useState(null);
  const [editingQuotationUpdatedAt, setEditingQuotationUpdatedAt] = useState(null);
  const [quoteMenuForId, setQuoteMenuForId] = useState(null);

  const [editModal, setEditModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState(OPPORTUNITY_PIPELINE_STATUSES[0]);
  const [editValue, setEditValue] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editClientId, setEditClientId] = useState(null);

  const refresh = useCallback(() => {
    if (!id) return;
    setOpp(repos.opportunities.get(id));
    const qs = repos.quotations.listByOpportunity(id);
    setQuotations(qs);
    const map = {};
    for (const q of qs) {
      map[q.id] = repos.quotationLineItems.listByQuotation(q.id);
    }
    setQuoteLinesByQuoteId(map);
  }, [repos, id]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const vatEnabled = repos.appSettings.getSnapshot().default_include_vat === "1";
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  const quoteApplyVat = vatEnabled && quoteIncludeVat;

  const parsedQuoteLines = useMemo(() => {
    return quoteLineItems
      .map((ln) => ({
        quantity: Number(String(ln.quantity).replace(/,/g, "")) || 1,
        unit_price: Number(String(ln.unitPrice).replace(/,/g, "")),
      }))
      .filter((ln) => !Number.isNaN(ln.unit_price));
  }, [quoteLineItems]);

  const quoteTotalsPreview = useMemo(
    () => computeInvoiceTotals(parsedQuoteLines, { includeVat: quoteApplyVat }),
    [parsedQuoteLines, quoteApplyVat]
  );

  const showNewQuoteButton = useMemo(
    () => !quotations.some((q) => q.project_id),
    [quotations]
  );

  const acceptableQuote = useMemo(() => {
    for (const q of quotations) {
      const qs = String(q.status || "").toLowerCase();
      const canAct =
        qs !== QUOTATION_STATUS.accepted && qs !== QUOTATION_STATUS.rejected && !q.project_id;
      if (canAct) return q;
    }
    return null;
  }, [quotations]);

  function openNewQuote() {
    setEditingQuotationId(null);
    setEditingQuotationUpdatedAt(null);
    setQuoteLineItems([{ key: newQuoteLineKey(), description: "", quantity: "1", unitPrice: "" }]);
    setQuoteIncludeVat(repos.appSettings.getSnapshot().default_include_vat === "1");
    setQuoteModal(true);
  }

  function openEditQuote(q) {
    setQuoteMenuForId(null);
    const lines = quoteLinesByQuoteId[q.id] || [];
    setQuoteLineItems(
      lines.length > 0
        ? lines.map((ln) => ({
            key: ln.id || newQuoteLineKey(),
            description: ln.description != null ? String(ln.description) : "",
            quantity: String(ln.quantity ?? 1),
            unitPrice: ln.unit_price != null && ln.unit_price !== "" ? String(ln.unit_price) : "",
          }))
        : [{ key: newQuoteLineKey(), description: "", quantity: "1", unitPrice: "" }]
    );
    setQuoteIncludeVat(vatEnabled && Number(q.tax_amount) > 0.001);
    setEditingQuotationId(q.id);
    setEditingQuotationUpdatedAt(q.updated_at);
    setQuoteModal(true);
  }

  function updateQuoteLine(key, field, value) {
    setQuoteLineItems((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function removeQuoteLine(key) {
    setQuoteLineItems((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  function addQuoteLine() {
    setQuoteLineItems((rows) => [...rows, { key: newQuoteLineKey(), description: "", quantity: "1", unitPrice: "" }]);
  }

  function openEdit() {
    if (!opp) return;
    setEditName(opp.name || "");
    const st = opp.status ? String(opp.status) : OPPORTUNITY_PIPELINE_STATUSES[0];
    setEditStatus(OPPORTUNITY_PIPELINE_STATUSES.includes(st) ? st : OPPORTUNITY_PIPELINE_STATUSES[0]);
    const v = opp.estimated_value ?? opp.value;
    setEditValue(v != null && v !== "" ? String(v) : "");
    setEditLocation(opp.location || "");
    setEditContactName(opp.contact_name || "");
    setEditContactPhone(opp.contact_phone || "");
    setEditContactEmail(opp.contact_email || "");
    setEditClientId(opp.client_id || null);
    setClients(repos.clients.list());
    setEditModal(true);
  }

  function saveEdit() {
    if (!opp || !id || !editName.trim()) return;
    const raw = editValue.trim().replace(/,/g, "");
    const n = raw === "" ? null : Number(raw);
    try {
      repos.opportunities.update(
        id,
        {
          name: editName.trim(),
          status: editStatus,
          estimated_value: n,
          value: n,
          client_id: editClientId,
          location: editLocation.trim() || null,
          contact_name: editContactName.trim() || null,
          contact_phone: editContactPhone.trim() || null,
          contact_email: editContactEmail.trim() || null,
        },
        { expectedUpdatedAt: opp.updated_at }
      );
      setEditModal(false);
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not save", "This opportunity was changed elsewhere. The screen will refresh.");
        refresh();
        setEditModal(false);
      } else {
        Alert.alert("Could not save", String(e?.message || e));
      }
    }
  }

  function saveQuote() {
    if (!id) return;
    const lines = quoteLineItems
      .map((ln) => ({
        description: ln.description.trim(),
        quantity: Number(String(ln.quantity).replace(/,/g, "")) || 1,
        unit_price: Number(String(ln.unitPrice).replace(/,/g, "")),
      }))
      .filter((ln) => !Number.isNaN(ln.unit_price));
    if (lines.length === 0) return;
    const totals = computeInvoiceTotals(lines, { includeVat: quoteApplyVat });
    const linePayload = lines.map((ln) => ({
      description: ln.description || "Line",
      quantity: ln.quantity,
      unit_price: ln.unit_price,
    }));

    if (editingQuotationId) {
      try {
        repos.quotations.update(
          editingQuotationId,
          {
            sub_total: totals.subTotal,
            tax_amount: totals.taxAmount,
            total_amount: totals.totalAmount,
          },
          { expectedUpdatedAt: editingQuotationUpdatedAt }
        );
        repos.quotationLineItems.replaceForQuotation(editingQuotationId, linePayload);
        setQuoteModal(false);
        setEditingQuotationId(null);
        setEditingQuotationUpdatedAt(null);
        refresh();
      } catch (e) {
        if (e instanceof LWWConflictError) {
          Alert.alert("Could not save", "This quotation was changed elsewhere. The screen will refresh.");
          refresh();
          setQuoteModal(false);
          setEditingQuotationId(null);
          setEditingQuotationUpdatedAt(null);
        } else {
          Alert.alert("Could not save", String(e?.message || e));
        }
      }
      return;
    }

    const q = repos.quotations.insert({
      opportunity_id: id,
      status: QUOTATION_STATUS.draft,
      sub_total: totals.subTotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
    });
    repos.quotationLineItems.replaceForQuotation(q.id, linePayload);
    setQuoteModal(false);
    refresh();
  }

  function markSent(q) {
    setQuoteMenuForId(null);
    try {
      repos.quotations.update(q.id, { status: QUOTATION_STATUS.sent }, { expectedUpdatedAt: q.updated_at });
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not update", "This quotation was changed elsewhere. The screen will refresh.");
        refresh();
      } else {
        Alert.alert("Could not update", String(e?.message || e));
      }
    }
  }

  function markRejected(q) {
    try {
      repos.quotations.update(q.id, { status: QUOTATION_STATUS.rejected }, { expectedUpdatedAt: q.updated_at });
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not update", "This quotation was changed elsewhere. The screen will refresh.");
        refresh();
      } else {
        Alert.alert("Could not update", String(e?.message || e));
      }
    }
  }

  function confirmVoidQuotation(q) {
    setQuoteMenuForId(null);
    Alert.alert(
      "Void quotation",
      "This marks the quotation as rejected and removes it from your active pipeline. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void",
          style: "destructive",
          onPress: () => markRejected(q),
        },
      ]
    );
  }

  async function exportQuotationPdf(q) {
    if (!opp) return;
    setQuoteMenuForId(null);
    const snap = repos.appSettings.getSnapshot();
    let client = null;
    if (opp.client_id) {
      const c = repos.clients.get(opp.client_id);
      if (c) {
        client = {
          name: c.name || null,
          phone: c.phone || null,
          email: c.email || null,
          typeLabel: formatClientRelationshipLabel(c.kind, c.type),
          notes: c.notes || null,
        };
      }
    }
    const qLines = quoteLinesByQuoteId[q.id] || [];
    const ts = q.issued_date ?? q.updated_at;
    const createdAtStr = ts != null && ts !== "" ? formatCapturedAt(ts) : null;
    const issuedDateStr =
      q.issued_date != null && q.issued_date !== "" ? formatCapturedAt(q.issued_date) : null;
    const expiryDateStr =
      q.expiry_date != null && q.expiry_date !== "" ? formatCapturedAt(q.expiry_date) : null;
    const lastUpdatedStr = q.updated_at != null ? formatCapturedAt(q.updated_at) : null;
    const expectedCloseStr =
      opp.expected_close != null && opp.expected_close !== "" ? formatCapturedAt(opp.expected_close) : null;
    const html = buildQuotationPdfHtml({
      companyName: snap.company_name || null,
      companyTagline: snap.company_tagline || null,
      companyLogoDataUri: await loadImageAsDataUri(snap.company_logo_local_url || snap.company_logo_url || null),
      companyAddress: snap.company_address || null,
      companyPhone: snap.company_phone || null,
      projectProspectName: opp.name || null,
      client,
      clientName: client?.name ?? null,
      workLocation: opp.location || null,
      siteContactName: opp.contact_name || null,
      siteContactPhone: opp.contact_phone || null,
      siteContactEmail: opp.contact_email || null,
      expectedCloseStr,
      quotationRef: q.id,
      status: labelForStatus(q.status),
      createdAtStr,
      issuedDateStr,
      expiryDateStr,
      lastUpdatedStr,
      linkedProjectId: q.project_id || null,
      lines: qLines,
      subTotal: Number(q.sub_total),
      taxAmount: Number(q.tax_amount),
      totalAmount: Number(q.total_amount),
      includeVat: snap.default_include_vat === "1" && Number(q.tax_amount) > 0.001,
      currencyCode: snap.currency || "UGX",
    });
    await sharePdfFromHtml(html, `quotation-${String(q.id).slice(0, 8)}`);
  }

  function goToPipelineStage(targetIndex) {
    if (!opp || !id) return;
    if (targetIndex < 0 || targetIndex >= OPPORTUNITY_PIPELINE_STATUSES.length) return;
    const newStatus = OPPORTUNITY_PIPELINE_STATUSES[targetIndex];
    try {
      repos.opportunities.update(id, { status: newStatus }, { expectedUpdatedAt: opp.updated_at });
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not update stage", "This opportunity was changed elsewhere. The screen will refresh.");
        refresh();
      } else {
        Alert.alert("Could not update stage", String(e?.message || e));
      }
    }
  }

  function acceptAndCreateProject(q) {
    if (!opp || !id) return;
    if (q.project_id) {
      Alert.alert("Already converted", "This quotation is already linked to a project.");
      return;
    }
    const projectName = `${opp.name}`.trim() || "Project";
    const budget = q.total_amount != null ? Number(q.total_amount) : null;
    const proj = repos.projects.insert({
      name: projectName,
      opportunity_id: id,
      budget,
      status: "active",
    });
    const latest = repos.quotations.get(q.id);
    repos.quotations.update(
      q.id,
      { status: QUOTATION_STATUS.accepted, project_id: proj.id },
      { expectedUpdatedAt: latest.updated_at }
    );
    refresh();
    Alert.alert("Project created", `${projectName} is ready. Open it to add tasks.`, [
      { text: "View project", onPress: () => router.push(`/(drawer)/(tabs)/projects/${proj.id}`) },
      { text: "Stay", style: "cancel" },
    ]);
  }

  if (!id) {
    return (
      <View style={sharedStyles.screen}>
        <Text style={styles.missing}>Missing opportunity.</Text>
      </View>
    );
  }

  if (!opp) {
    return (
      <View style={sharedStyles.screen}>
        <Text style={styles.missing}>Opportunity not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={sharedStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>{opp.name}</Text>
            <Pressable onPress={openEdit} style={styles.editBtn} accessibilityRole="button" accessibilityLabel="Edit opportunity">
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.heroMeta}>
            {opp.status} · {formatCapturedAt(opp.captured_at)} · {formatMoney(opp.estimated_value ?? opp.value, currencyCode)}
          </Text>
          {opp.location ? <Text style={styles.heroLine}>{opp.location}</Text> : null}
          {(opp.contact_name || opp.contact_phone || opp.contact_email) && (
            <Text style={styles.heroLine}>
              {[opp.contact_name, opp.contact_phone, opp.contact_email].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>

        {(() => {
          const idx = pipelineStageIndex(opp.status);
          const lastIdx = OPPORTUNITY_PIPELINE_STATUSES.length - 1;
          const isClosing = idx === lastIdx;
          if (isClosing) {
            return (
              <View style={styles.opportunityCta}>
                <Text style={styles.opportunityCtaHeading}>Stage: Closing</Text>
                <Text style={styles.opportunityCtaSub}>When you are ready, accept a quotation to create the project.</Text>
                <Pressable
                  style={styles.stageBackLink}
                  onPress={() => goToPipelineStage(idx - 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Negotiation"
                >
                  <MaterialIcons name="chevron-left" size={18} color={colors.primary} />
                  <Text style={styles.stageBackLinkText}>Back to Negotiation</Text>
                </Pressable>
                {acceptableQuote ? (
                  <PrimaryButton
                    title="Accept → create project"
                    onPress={() => acceptAndCreateProject(acceptableQuote)}
                  />
                ) : (
                  <Text style={styles.opportunityCtaHint}>
                    No open quotation to accept. Add a quotation or void rejected quotes first.
                  </Text>
                )}
              </View>
            );
          }
          return (
            <View style={styles.opportunityCta}>
              <Text style={styles.opportunityCtaHeading}>Stage: {OPPORTUNITY_PIPELINE_STATUSES[idx]}</Text>
              <Text style={styles.opportunityCtaSub}>Move this deal toward the next conversation.</Text>
              <View style={styles.stageNavRow}>
                {idx > 0 ? (
                  <Pressable
                    style={styles.stageNavBtn}
                    onPress={() => goToPipelineStage(idx - 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Back to ${OPPORTUNITY_PIPELINE_STATUSES[idx - 1]}`}
                  >
                    <MaterialIcons name="chevron-left" size={20} color={colors.primary} />
                    <Text style={styles.stageNavBtnText} numberOfLines={1}>
                      {OPPORTUNITY_PIPELINE_STATUSES[idx - 1]}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.stageNavSlot} />
                )}
                {idx < lastIdx ? (
                  <Pressable
                    style={styles.stageNavBtnPrimary}
                    onPress={() => goToPipelineStage(idx + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Next: ${OPPORTUNITY_PIPELINE_STATUSES[idx + 1]}`}
                  >
                    <Text style={styles.stageNavBtnTextPrimary} numberOfLines={1}>
                      {OPPORTUNITY_PIPELINE_STATUSES[idx + 1]}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.onPrimary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })()}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Quotations</Text>
          {showNewQuoteButton ? (
            <Pressable onPress={openNewQuote} style={styles.addQuoteBtn} accessibilityRole="button">
              <Text style={styles.addQuoteBtnText}>+ New quote</Text>
            </Pressable>
          ) : null}
        </View>

        {quotations.length === 0 ? (
          <Text style={styles.emptyQuotes}>
            No quotations yet. Add a quote, mark it sent if you like, then accept to create a project.
          </Text>
        ) : (
          quotations.map((q) => {
            const qLines = quoteLinesByQuoteId[q.id] || [];
            const linkedProject = q.project_id ? repos.projects.get(q.project_id) : null;
            const linkedProjectName = linkedProject?.name?.trim() ? linkedProject.name.trim() : "Project";
            return (
              <View key={q.id} style={styles.quoteCard}>
                <View style={styles.quoteTop}>
                  <Text style={styles.quoteStatus}>{labelForStatus(q.status)}</Text>
                  <Text style={styles.quoteTotal}>{formatMoney(q.total_amount, currencyCode)}</Text>
                </View>
                {qLines.length > 0 ? (
                  <View style={styles.quoteLinesWrap}>
                    <View style={styles.quoteTableHead}>
                      <Text style={[styles.quoteTh, styles.quoteThProduct]}>Product</Text>
                      <Text style={[styles.quoteTh, styles.quoteThCol]}>Price</Text>
                      <Text style={[styles.quoteTh, styles.quoteThCol]}>Qty</Text>
                      <Text style={[styles.quoteTh, styles.quoteThNet]}>Net</Text>
                    </View>
                    {qLines.map((ln) => {
                      const net = lineNetAmount({
                        quantity: ln.quantity,
                        unit_price: ln.unit_price,
                      });
                      return (
                        <View key={ln.id} style={styles.quoteTableRow}>
                          <Text style={[styles.quoteTd, styles.quoteThProduct]} numberOfLines={2}>
                            {ln.description || "—"}
                          </Text>
                          <Text style={styles.quoteTdNum}>{formatMoney(ln.unit_price, currencyCode)}</Text>
                          <Text style={styles.quoteTdNum}>{String(ln.quantity)}</Text>
                          <Text style={[styles.quoteTdNum, styles.quoteThNet]}>{formatMoney(net, currencyCode)}</Text>
                        </View>
                      );
                    })}
                    <View style={styles.quoteTotalsBox}>
                      <Text style={styles.quoteTotalsLabel}>Sub-total</Text>
                      <Text style={styles.quoteTotalsVal}>{formatMoney(q.sub_total, currencyCode)}</Text>
                    </View>
                    {vatEnabled && Number(q.tax_amount) > 0 ? (
                      <View style={styles.quoteTotalsBox}>
                        <Text style={styles.quoteTotalsLabel}>VAT ({Math.round(UGANDA_VAT_RATE * 100)}%)</Text>
                        <Text style={styles.quoteTotalsVal}>{formatMoney(q.tax_amount, currencyCode)}</Text>
                      </View>
                    ) : null}
                    <View style={styles.quoteTotalsBox}>
                      <Text style={styles.quoteTotalsGrand}>Total</Text>
                      <Text style={styles.quoteTotalsGrandAmt}>{formatMoney(q.total_amount, currencyCode)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.quoteDetail}>
                    {vatEnabled
                      ? `Sub ${formatMoney(q.sub_total, currencyCode)} + tax ${formatMoney(q.tax_amount, currencyCode)} (no line breakdown)`
                      : `Sub ${formatMoney(q.sub_total, currencyCode)} · Total ${formatMoney(q.total_amount, currencyCode)} (no line breakdown)`}
                  </Text>
                )}
                <View style={styles.quoteCardFooter}>
                  <Pressable
                    onPress={() => setQuoteMenuForId(q.id)}
                    style={styles.actionsDropdownBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Quotation actions"
                    accessibilityHint="Opens menu with export, mark sent, edit, and void"
                  >
                    <MaterialIcons name="more-horiz" size={22} color={colors.primary} />
                    <Text style={styles.actionsDropdownBtnText}>Actions</Text>
                  </Pressable>
                </View>
                {q.project_id ? (
                  <Pressable
                    style={styles.linkedRow}
                    onPress={() => router.push(`/(drawer)/(tabs)/projects/${q.project_id}`)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open project ${linkedProjectName}`}
                  >
                    <Text style={styles.linkedText} numberOfLines={1}>
                      Open project: {linkedProjectName}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={quoteMenuForId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setQuoteMenuForId(null)}
      >
        <View style={styles.quoteMenuRoot}>
          <Pressable style={styles.quoteMenuBackdrop} onPress={() => setQuoteMenuForId(null)} accessibilityLabel="Close menu" />
          <View style={styles.quoteMenuSheet}>
            {quoteMenuForId != null
              ? (() => {
                  const menuQ = quotations.find((x) => x.id === quoteMenuForId);
                  if (!menuQ) return null;
                  const mst = String(menuQ.status || "").toLowerCase();
                  const mCanAct =
                    mst !== QUOTATION_STATUS.accepted && mst !== QUOTATION_STATUS.rejected && !menuQ.project_id;
                  return (
                    <>
                      <Text style={styles.quoteMenuTitle}>Quotation actions</Text>
                      <Pressable
                        style={styles.quoteMenuRow}
                        onPress={() => exportQuotationPdf(menuQ)}
                        accessibilityRole="button"
                        accessibilityLabel="Export PDF"
                      >
                        <MaterialIcons name="picture-as-pdf" size={22} color={colors.primary} />
                        <Text style={styles.quoteMenuRowText}>Export PDF</Text>
                      </Pressable>
                      {mCanAct && mst === QUOTATION_STATUS.draft ? (
                        <Pressable
                          style={styles.quoteMenuRow}
                          onPress={() => markSent(menuQ)}
                          accessibilityRole="button"
                          accessibilityLabel="Mark sent"
                        >
                          <MaterialIcons name="send" size={22} color={colors.onBackground} />
                          <Text style={styles.quoteMenuRowText}>Mark sent</Text>
                        </Pressable>
                      ) : null}
                      {mCanAct ? (
                        <Pressable
                          style={styles.quoteMenuRow}
                          onPress={() => openEditQuote(menuQ)}
                          accessibilityRole="button"
                          accessibilityLabel="Edit quotation"
                        >
                          <MaterialIcons name="edit" size={22} color={colors.onBackground} />
                          <Text style={styles.quoteMenuRowText}>Edit quotation</Text>
                        </Pressable>
                      ) : null}
                      {mCanAct ? (
                        <Pressable
                          style={[styles.quoteMenuRow, styles.quoteMenuRowDangerLast]}
                          onPress={() => confirmVoidQuotation(menuQ)}
                          accessibilityRole="button"
                          accessibilityLabel="Void quotation"
                        >
                          <MaterialIcons name="block" size={22} color={colors.financeExpense} />
                          <Text style={[styles.quoteMenuRowText, styles.quoteMenuRowTextDanger]}>Void</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={styles.quoteMenuCancel}
                        onPress={() => setQuoteMenuForId(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                      >
                        <Text style={styles.quoteMenuCancelText}>Cancel</Text>
                      </Pressable>
                    </>
                  );
                })()
              : null}
          </View>
        </View>
      </Modal>

      <SimpleModal visible={editModal} title="Edit opportunity" onClose={() => setEditModal(false)}>
        <FormField label="Name *" value={editName} onChangeText={setEditName} placeholder="e.g. Roof repair" />
        <Text style={sharedStyles.pickerLabel}>Pipeline stage</Text>
        <View style={sharedStyles.chipRow}>
          {OPPORTUNITY_PIPELINE_STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[sharedStyles.chip, editStatus === s && sharedStyles.chipActive, styles.statusChip]}
              onPress={() => setEditStatus(s)}
            >
              <Text
                style={[sharedStyles.chipText, editStatus === s && sharedStyles.chipTextActive, styles.statusChipText]}
                numberOfLines={1}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <FormField
          label="Location"
          value={editLocation}
          onChangeText={setEditLocation}
          placeholder="Site or area (optional)"
        />
        <FormField
          label="Contact person name"
          value={editContactName}
          onChangeText={setEditContactName}
          placeholder="Name of key client contact"
        />
        <FormField
          label="Contact person phone"
          value={editContactPhone}
          onChangeText={setEditContactPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
        />
        <FormField
          label="Contact person email"
          value={editContactEmail}
          onChangeText={setEditContactEmail}
          placeholder="Optional"
          keyboardType="email-address"
        />
        <FormField
          label={`Value (${currencyCode})`}
          value={editValue}
          onChangeText={setEditValue}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />
        <Text style={sharedStyles.pickerLabel}>Client (optional)</Text>
        <View style={sharedStyles.chipRow}>
          <Pressable
            style={[sharedStyles.chip, editClientId === null && sharedStyles.chipActive]}
            onPress={() => setEditClientId(null)}
          >
            <Text style={[sharedStyles.chipText, editClientId === null && sharedStyles.chipTextActive]}>None</Text>
          </Pressable>
          {clients.map((c) => (
            <Pressable
              key={c.id}
              style={[sharedStyles.chip, editClientId === c.id && sharedStyles.chipActive]}
              onPress={() => setEditClientId(c.id)}
            >
              <Text style={[sharedStyles.chipText, editClientId === c.id && sharedStyles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton title="Save changes" onPress={saveEdit} disabled={!editName.trim()} />
      </SimpleModal>

      <SimpleModal
        visible={quoteModal}
        title={editingQuotationId ? "Edit quotation" : "New quotation"}
        onClose={() => {
          setQuoteModal(false);
          setEditingQuotationId(null);
          setEditingQuotationUpdatedAt(null);
        }}
      >
        <Text style={styles.linesHeading}>Line items</Text>
        {quoteLineItems.map((ln, idx) => (
          <View key={ln.key} style={styles.lineBlock}>
            <View style={styles.lineTop}>
              <Text style={styles.lineNum}>Line {idx + 1}</Text>
              {quoteLineItems.length > 1 ? (
                <Pressable onPress={() => removeQuoteLine(ln.key)} hitSlop={8} accessibilityRole="button">
                  <MaterialIcons name="delete-outline" size={22} color={colors.financeExpense} accessibilityLabel="Remove line" />
                </Pressable>
              ) : null}
            </View>
            <FormField
              label="Description"
              value={ln.description}
              onChangeText={(v) => updateQuoteLine(ln.key, "description", v)}
              placeholder="Product or service"
            />
            <View style={styles.lineQtyRow}>
              <View style={styles.lineQtyCell}>
                <FormField
                  label="Qty"
                  value={ln.quantity}
                  onChangeText={(v) => updateQuoteLine(ln.key, "quantity", v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.lineQtyCell}>
                <FormField
                  label={`Unit (${currencyCode})`}
                  value={ln.unitPrice}
                  onChangeText={(v) => updateQuoteLine(ln.key, "unitPrice", v)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        ))}
        <Pressable onPress={addQuoteLine} style={styles.addLineBtn}>
          <Text style={styles.addLineBtnText}>+ Add line</Text>
        </Pressable>
        {vatEnabled ? (
          <Pressable
            onPress={() => setQuoteIncludeVat(!quoteIncludeVat)}
            style={styles.vatRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: quoteIncludeVat }}
          >
            <View style={[styles.checkbox, quoteIncludeVat && styles.checkboxOn]} />
            <Text style={styles.vatLabel}>Include VAT ({Math.round(UGANDA_VAT_RATE * 100)}% on net)</Text>
          </Pressable>
        ) : null}
        <View style={styles.totalsBox}>
          <Text style={styles.totalsLine}>Net {formatMoney(quoteTotalsPreview.subTotal, currencyCode)}</Text>
          {vatEnabled ? (
            quoteIncludeVat ? (
              <Text style={styles.totalsLine}>VAT {formatMoney(quoteTotalsPreview.taxAmount, currencyCode)}</Text>
            ) : (
              <Text style={styles.totalsMuted}>VAT off — totals are net only</Text>
            )
          ) : null}
          <Text style={styles.totalsTotal}>Quote total {formatMoney(quoteTotalsPreview.totalAmount, currencyCode)}</Text>
        </View>
        <PrimaryButton
          title={editingQuotationId ? "Save changes" : "Save as draft"}
          onPress={saveQuote}
          disabled={parsedQuoteLines.length === 0}
        />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120, paddingHorizontal: space.safe },
  missing: { padding: space.safe, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  backLink: { paddingHorizontal: space.safe },
  backLinkText: { fontFamily: fonts.bodySemi, color: colors.primary, fontSize: 16 },
  hero: {
    marginBottom: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  heroTitle: { flex: 1, fontSize: 22, fontFamily: fonts.displayBold, color: colors.onBackground },
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  editBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  statusChip: {
    paddingVertical: space.sm,
    paddingHorizontal: 12,
  },
  statusChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
  },
  heroMeta: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 6 },
  heroLine: { fontSize: 14, fontFamily: fonts.body, color: colors.onBackground, marginTop: 8 },
  opportunityCta: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.lg,
    gap: space.sm,
  },
  opportunityCtaHeading: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
  },
  opportunityCtaSub: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    lineHeight: 20,
    marginBottom: space.xs,
  },
  opportunityCtaHint: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    lineHeight: 20,
    fontStyle: "italic",
  },
  stageBackLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginBottom: space.sm,
    paddingVertical: 4,
  },
  stageBackLinkText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  stageNavRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
  stageNavSlot: { minWidth: 120, flex: 1 },
  stageNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    flex: 1,
    minWidth: 140,
    justifyContent: "flex-start",
  },
  stageNavBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flex: 1,
    minWidth: 140,
    justifyContent: "flex-end",
  },
  stageNavBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
    flex: 1,
    textAlign: "left",
  },
  stageNavBtnTextPrimary: {
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    color: colors.onPrimary,
    flex: 1,
    textAlign: "right",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  sectionTitle: { fontSize: 16, fontFamily: fonts.displayBold, color: colors.onBackground },
  addQuoteBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  addQuoteBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  emptyQuotes: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, lineHeight: 20 },
  quoteCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  quoteTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quoteStatus: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  quoteTotal: { fontSize: 17, fontFamily: fonts.displayBold, color: colors.onBackground },
  quoteDetail: { fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 4 },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  linkedText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  quoteCardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  actionsDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  actionsDropdownBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  quoteMenuRoot: {
    flex: 1,
    justifyContent: "center",
    padding: space.lg,
  },
  quoteMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  quoteMenuSheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
    zIndex: 2,
    elevation: 12,
    shadowColor: "#0f1c2d",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  quoteMenuTitle: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  quoteMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.md,
  },
  quoteMenuRowDangerLast: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    marginTop: space.xs,
  },
  quoteMenuRowText: { fontSize: 16, fontFamily: fonts.body, color: colors.onBackground, flex: 1 },
  quoteMenuRowTextDanger: { color: colors.financeExpense, fontFamily: fonts.bodySemi },
  quoteMenuCancel: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    marginTop: space.xs,
  },
  quoteMenuCancelText: { fontSize: 16, fontFamily: fonts.bodySemi, color: colors.primary },
  quoteLinesWrap: { marginTop: space.sm },
  quoteTableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    marginBottom: 6,
    gap: 4,
  },
  quoteTh: {
    fontSize: 10,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  quoteThProduct: { flex: 2, minWidth: 0 },
  quoteThCol: { flex: 1 },
  quoteThNet: { flex: 1, textAlign: "right" },
  quoteTableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  quoteTd: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onBackground,
    flex: 2,
    minWidth: 0,
  },
  quoteTdNum: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    flex: 1,
  },
  quoteTotalsBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  quoteTotalsLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  quoteTotalsVal: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.onBackground },
  quoteTotalsGrand: { fontSize: 14, fontFamily: fonts.displayBold, color: colors.onBackground },
  quoteTotalsGrandAmt: { fontSize: 16, fontFamily: fonts.displayBold, color: colors.primary },
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
});
