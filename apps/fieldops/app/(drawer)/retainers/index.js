import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { EntityList } from "../../../components/EntityList";
import { FormField } from "../../../components/FormField";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenFab } from "../../../components/ScreenFab";
import { SimpleModal } from "../../../components/SimpleModal";
import { useRepos } from "../../../context/DatabaseContext";
import { sharedStyles } from "../../../theme/styles";
import { colors, fonts, space } from "../../../theme/tokens";
import { formatMoney } from "@servops/core";

export default function RetainersListScreen() {
  const repos = useRepos();
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  // Shadow legacy formatter so existing JSX can keep using `ugx(...)`.
  const ugx = (n) => formatMoney(n, currencyCode);
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [total, setTotal] = useState("");
  const [opportunityId, setOpportunityId] = useState(null);
  const [projectLinkId, setProjectLinkId] = useState(null);

  const refresh = useCallback(() => {
    setRows(repos.retainers.list());
    setClients(repos.clients.list());
    setOpportunities(repos.opportunities.list());
    setProjects(repos.projects.list());
  }, [repos]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const oppsForClient = useMemo(() => {
    if (!clientId) return [];
    return opportunities.filter((o) => o.client_id === clientId);
  }, [clientId, opportunities]);

  const projectsUnlinked = useMemo(() => projects.filter((p) => !p.retainer_id), [projects]);

  function openModal() {
    setClientId(null);
    setTotal("");
    setOpportunityId(null);
    setProjectLinkId(null);
    setClients(repos.clients.list());
    setOpportunities(repos.opportunities.list());
    setProjects(repos.projects.list());
    setModal(true);
  }

  function save() {
    if (!clientId || !total.trim()) return;
    const amt = Number(total.replace(/,/g, ""));
    const ret = repos.retainers.insert({
      client_id: clientId,
      total_amount: amt,
      balance: amt,
      opportunity_id: opportunityId,
    });
    if (projectLinkId) {
      try {
        repos.projects.assignRetainer(projectLinkId, ret.id);
      } catch {
        Alert.alert(
          "Project link",
          "Client deposit was saved; linking the project failed. Open the client deposit to try again."
        );
      }
    }
    setModal(false);
    refresh();
  }

  const header = (
    <View style={styles.intro}>
      <Text style={styles.introTag}>Drawer</Text>
      <Text style={styles.introTitle}>Client deposits</Text>
      <Text style={styles.introSub}>
        Deposits and prepaid balances per client. Link an opportunity or project, then apply credit when invoicing (Finance
        → New invoice).
      </Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <EntityList
        data={rows}
        empty={{
          variant: "retainers",
          title: "No client deposits yet",
          message:
            "Record upfront payments against a client. Optional link to an opportunity or project for context.",
          ctaLabel: "New client deposit",
          onCta: openModal,
        }}
        keyField="id"
        ListHeaderComponent={header}
        onRowPress={(r) => router.push(`/(drawer)/retainers/${r.id}`)}
        renderRow={(r) => {
          const cname = clientById[r.client_id]?.name || "Client";
          return `${cname} · balance ${ugx(r.balance)} / ${ugx(r.total_amount)} · ${r.status || "active"}`;
        }}
      />
      <ScreenFab label="+ Client deposit" onPress={openModal} bottomOffset={16} accessibilityLabel="New client deposit" />
      <SimpleModal visible={modal} title="New client deposit" onClose={() => setModal(false)}>
        <Text style={sharedStyles.pickerLabel}>Client *</Text>
        <View style={sharedStyles.chipRow}>
          {clients.map((c) => (
            <Pressable
              key={c.id}
              style={[sharedStyles.chip, clientId === c.id && sharedStyles.chipActive]}
              onPress={() => {
                setClientId(c.id);
                setOpportunityId(null);
              }}
            >
              <Text style={[sharedStyles.chipText, clientId === c.id && sharedStyles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        {clients.length === 0 ? <Text style={sharedStyles.hint}>Add a contact first.</Text> : null}

        {clientId && oppsForClient.length > 0 ? (
          <>
            <Text style={sharedStyles.pickerLabel}>Opportunity (optional)</Text>
            <View style={sharedStyles.chipRow}>
              <Pressable
                style={[sharedStyles.chip, opportunityId === null && sharedStyles.chipActive]}
                onPress={() => setOpportunityId(null)}
              >
                <Text
                  style={[sharedStyles.chipText, opportunityId === null && sharedStyles.chipTextActive]}
                  numberOfLines={1}
                >
                  None
                </Text>
              </Pressable>
              {oppsForClient.map((o) => (
                <Pressable
                  key={o.id}
                  style={[sharedStyles.chip, opportunityId === o.id && sharedStyles.chipActive]}
                  onPress={() => setOpportunityId(o.id)}
                >
                  <Text
                    style={[sharedStyles.chipText, opportunityId === o.id && sharedStyles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {o.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={sharedStyles.pickerLabel}>Link project (optional)</Text>
        <Text style={sharedStyles.hint}>Only projects without a client deposit yet. One project per client deposit.</Text>
        <View style={sharedStyles.chipRow}>
          <Pressable
            style={[sharedStyles.chip, projectLinkId === null && sharedStyles.chipActive]}
            onPress={() => setProjectLinkId(null)}
          >
            <Text style={[sharedStyles.chipText, projectLinkId === null && sharedStyles.chipTextActive]}>None</Text>
          </Pressable>
          {projectsUnlinked.map((p) => (
            <Pressable
              key={p.id}
              style={[sharedStyles.chip, projectLinkId === p.id && sharedStyles.chipActive]}
              onPress={() => setProjectLinkId(p.id)}
            >
              <Text
                style={[sharedStyles.chipText, projectLinkId === p.id && sharedStyles.chipTextActive]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <FormField
          label={`Initial deposit (${currencyCode}) *`}
          value={total}
          onChangeText={setTotal}
          keyboardType="decimal-pad"
          placeholder="Recorded as total and current balance"
        />
        <PrimaryButton title="Save" onPress={save} disabled={!clientId || !total.trim()} />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  intro: {
    paddingHorizontal: space.safe,
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
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
});
