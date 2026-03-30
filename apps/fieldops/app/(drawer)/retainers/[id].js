import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FormField } from "../../../components/FormField";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { SimpleModal } from "../../../components/SimpleModal";
import { useRepos } from "../../../context/DatabaseContext";
import { sharedStyles } from "../../../theme/styles";
import { colors, fonts, radius, space } from "../../../theme/tokens";
import { formatMoney } from "@servops/core";

function formatWhen(ts) {
  if (ts == null || ts === "") return "—";
  try {
    return new Date(Number(ts)).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function RetainerDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const navigation = useNavigation();
  const repos = useRepos();
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  const ugx = (n) => formatMoney(n, currencyCode);

  const [retainer, setRetainer] = useState(null);
  const [client, setClient] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [linkedProjects, setLinkedProjects] = useState([]);
  const [applications, setApplications] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [linkModal, setLinkModal] = useState(false);
  const [pickedProjectId, setPickedProjectId] = useState(null);
  const [statusEdit, setStatusEdit] = useState("");

  const refresh = useCallback(() => {
    if (!id) return;
    const r = repos.retainers.get(id);
    setRetainer(r ?? null);
    setClient(r?.client_id ? repos.clients.get(r.client_id) : null);
    setOpportunity(r?.opportunity_id ? repos.opportunities.get(r.opportunity_id) : null);
    setLinkedProjects(repos.projects.listByRetainer(id));
    setApplications(repos.retainerApplications.listByRetainer(id));
    setLedger(repos.finance.retainerLedger(id));
    setAllProjects(repos.projects.list());
  }, [repos, id]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const unlinkCandidates = useMemo(
    () => allProjects.filter((p) => !p.retainer_id || p.retainer_id === id),
    [allProjects, id]
  );

  useLayoutEffect(() => {
    const t = client?.name ? `${client.name} · client deposit` : "Client deposit";
    navigation.setOptions({ title: t });
  }, [client?.name, navigation]);

  function openLinkModal() {
    setPickedProjectId(null);
    setAllProjects(repos.projects.list());
    setLinkModal(true);
  }

  function confirmLinkProject() {
    if (!id || !pickedProjectId) return;
    try {
      repos.projects.assignRetainer(pickedProjectId, id);
      setLinkModal(false);
      refresh();
    } catch {
      setLinkModal(false);
    }
  }

  function unlinkProject(projectId) {
    if (!id) return;
    const p = repos.projects.get(projectId);
    if (!p || p.retainer_id !== id) return;
    repos.projects.assignRetainer(projectId, null);
    refresh();
  }

  function saveStatus() {
    if (!retainer || !statusEdit.trim()) return;
    const row = repos.retainers.get(retainer.id);
    repos.retainers.update(retainer.id, { status: statusEdit.trim() }, { expectedUpdatedAt: row.updated_at });
    setStatusEdit("");
    refresh();
  }

  if (!id) {
    return (
      <View style={styles.mutedWrap}>
        <Text style={styles.muted}>Missing client deposit id.</Text>
      </View>
    );
  }

  if (!retainer) {
    return (
      <View style={styles.mutedWrap}>
        <Text style={styles.muted}>Client deposit not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Active balance</Text>
        <Text style={styles.balance}>{ugx(retainer.balance)}</Text>
        <Text style={styles.sub}>Original deposit {ugx(retainer.total_amount)}</Text>
        <Text style={styles.sub}>Status: {retainer.status || "active"}</Text>
        {retainer.start_date ? (
          <Text style={styles.sub}>Started {formatWhen(retainer.start_date)}</Text>
        ) : null}
      </View>

      {ledger ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Balance check</Text>
          <Text style={styles.body}>
            Design: remaining = total − sum(applied to invoices). Stored balance should match.
          </Text>
          <Text style={styles.mono}>
            Σ applied: {ugx(ledger.sumApplied)} · Implied remaining: {ugx(ledger.impliedRemaining)}
          </Text>
          <Text style={[styles.body, !ledger.balancesMatch && styles.warn]}>
            {ledger.balancesMatch ? "Stored balance matches ledger." : "Mismatch — inspect applications or data repair."}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Client</Text>
        <Text style={styles.body}>{client?.name || "—"}</Text>
      </View>

      {opportunity ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Linked opportunity</Text>
          <Text style={styles.body}>{opportunity.name}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Linked projects</Text>
          <Pressable onPress={openLinkModal} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Link project</Text>
          </Pressable>
        </View>
        {linkedProjects.length === 0 ? (
          <Text style={styles.body}>None — link a project so invoicing can offer this client deposit.</Text>
        ) : (
          linkedProjects.map((p) => (
            <View key={p.id} style={styles.projRow}>
              <Text style={styles.body}>{p.name}</Text>
              <Pressable onPress={() => unlinkProject(p.id)} hitSlop={8}>
                <Text style={styles.unlink}>Unlink</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Applications to invoices</Text>
        {applications.length === 0 ? (
          <Text style={styles.body}>None yet — apply when creating an invoice on a linked project.</Text>
        ) : (
          applications.map((a) => (
            <Text key={a.id} style={styles.appLine}>
              {ugx(a.amount_applied)} · inv …{String(a.invoice_id).slice(0, 8)} · {formatWhen(a.applied_at)}
            </Text>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Update status</Text>
        <FormField label="Status" value={statusEdit} onChangeText={setStatusEdit} placeholder={retainer.status || "active"} />
        <PrimaryButton title="Save status" onPress={saveStatus} disabled={!statusEdit.trim()} />
      </View>

      <SimpleModal visible={linkModal} title="Link project" onClose={() => setLinkModal(false)}>
        <Text style={sharedStyles.hint}>Clears this client deposit from any other project, then assigns here.</Text>
        <View style={sharedStyles.chipRow}>
          {unlinkCandidates.map((p) => (
            <Pressable
              key={p.id}
              style={[sharedStyles.chip, pickedProjectId === p.id && sharedStyles.chipActive]}
              onPress={() => setPickedProjectId(p.id)}
            >
              <Text
                style={[sharedStyles.chipText, pickedProjectId === p.id && sharedStyles.chipTextActive]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
        {unlinkCandidates.length === 0 ? <Text style={sharedStyles.hint}>No eligible projects.</Text> : null}
        <PrimaryButton title="Assign client deposit to project" onPress={confirmLinkProject} disabled={!pickedProjectId} />
      </SimpleModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.safe, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balance: { fontSize: 28, fontFamily: fonts.displayExtraBold, color: colors.onBackground, marginTop: 6 },
  sub: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bodySemi, color: colors.onBackground, marginBottom: 8 },
  body: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  mono: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.onBackground, marginTop: 8 },
  warn: { color: colors.financeWarning, fontFamily: fonts.bodySemi, marginTop: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  linkBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  projRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  unlink: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.financeExpense },
  appLine: { fontSize: 13, fontFamily: fonts.body, color: colors.onBackground, marginTop: 6 },
  mutedWrap: { flex: 1, padding: space.safe, backgroundColor: colors.background },
  muted: { fontFamily: fonts.body, color: colors.onSecondaryVariant },
});
