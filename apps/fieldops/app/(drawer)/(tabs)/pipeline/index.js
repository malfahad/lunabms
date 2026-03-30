import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FormField } from "../../../../components/FormField";
import { ListEmptyState } from "../../../../components/ListEmptyState";
import { PipelineOpportunityCard } from "../../../../components/PipelineOpportunityCard";
import { PrimaryButton } from "../../../../components/PrimaryButton";
import { ScreenFab } from "../../../../components/ScreenFab";
import { SimpleModal } from "../../../../components/SimpleModal";
import { OPPORTUNITY_PIPELINE_STATUSES } from "../../../../constants/opportunityPipeline";
import { useRepos } from "../../../../context/DatabaseContext";
import { sharedStyles } from "../../../../theme/styles";
import { colors, fonts, radius, space } from "../../../../theme/tokens";

export default function PipelineScreen() {
  const router = useRouter();
  const repos = useRepos();
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(OPPORTUNITY_PIPELINE_STATUSES[0]);
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [clientId, setClientId] = useState(null);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(null);

  const refresh = useCallback(() => {
    setRows(repos.opportunities.list());
    setClients(repos.clients.list());
  }, [repos]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (stageFilter != null) {
      list = list.filter((o) => String(o.status) === stageFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const client = o.client_id ? clientById[o.client_id] : null;
      const clientName = client?.name ? String(client.name) : "";
      const hay = [
        o.name,
        clientName,
        o.location,
        o.contact_name,
        o.contact_phone,
        o.contact_email,
        o.status,
      ]
        .filter((x) => x != null && x !== "")
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, stageFilter, search, clientById]);

  function openNew() {
    setName("");
    setStatus(OPPORTUNITY_PIPELINE_STATUSES[0]);
    setValue("");
    setLocation("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setClientId(null);
    setClients(repos.clients.list());
    setModal(true);
  }

  function save() {
    if (!name.trim()) return;
    const raw = value.trim().replace(/,/g, "");
    const n = raw === "" ? null : Number(raw);
    repos.opportunities.insert({
      name: name.trim(),
      status,
      estimated_value: n,
      value: n,
      client_id: clientId,
      location: location.trim() || null,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
    });
    setModal(false);
    refresh();
  }

  function clearFilters() {
    setSearch("");
    setStageFilter(null);
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search opportunities…"
        placeholderTextColor={colors.onSecondaryVariant}
        style={styles.searchInput}
        returnKeyType="search"
        accessibilityLabel="Search opportunities"
      />
      <Text style={sharedStyles.pickerLabel}>Filter by stage</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        <Pressable
          onPress={() => setStageFilter(null)}
          style={[styles.filterChip, stageFilter === null && styles.filterChipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: stageFilter === null }}
        >
          <Text style={[styles.filterChipText, stageFilter === null && styles.filterChipTextOn]}>All</Text>
        </Pressable>
        {OPPORTUNITY_PIPELINE_STATUSES.map((s) => (
          <Pressable
            key={s}
            onPress={() => setStageFilter(s)}
            style={[styles.filterChip, stageFilter === s && styles.filterChipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: stageFilter === s }}
          >
            <Text style={[styles.filterChipText, stageFilter === s && styles.filterChipTextOn]} numberOfLines={1}>
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const emptyComponent =
    rows.length === 0 ? (
      <ListEmptyState
        variant="pipeline"
        title="No opportunities yet"
        message="Track leads, location, contacts, and pipeline stage. Open an opportunity to add quotations; accepting a quote creates a project."
        ctaLabel="New opportunity"
        onCta={openNew}
      />
    ) : (
      <ListEmptyState
        variant="generic"
        title="No matches"
        message="Try a different search term or stage filter."
        ctaLabel="Clear search & filters"
        onCta={clearFilters}
      />
    );

  return (
    <View style={sharedStyles.screen}>
      <FlatList
        data={filteredRows}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item: o }) => {
          const client = o.client_id ? clientById[o.client_id] : null;
          const clientName = client?.name ?? null;
          return (
            <PipelineOpportunityCard
              opportunity={o}
              clientName={clientName}
              currencyCode={currencyCode}
              onPress={() => router.push(`/(drawer)/(tabs)/pipeline/${o.id}`)}
            />
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          filteredRows.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={emptyComponent}
        keyboardShouldPersistTaps="handled"
      />
      <ScreenFab label="+ New opportunity" onPress={openNew} accessibilityLabel="New opportunity" />
      <SimpleModal visible={modal} title="New opportunity" onClose={() => setModal(false)}>
        <FormField label="Name *" value={name} onChangeText={setName} placeholder="e.g. Roof repair" />
        <Text style={sharedStyles.pickerLabel}>Pipeline stage</Text>
        <View style={sharedStyles.chipRow}>
          {OPPORTUNITY_PIPELINE_STATUSES.map((s) => (
            <Pressable
              key={s}
              style={[sharedStyles.chip, status === s && sharedStyles.chipActive, modalStyles.statusChip]}
              onPress={() => setStatus(s)}
            >
              <Text
                style={[sharedStyles.chipText, status === s && sharedStyles.chipTextActive, modalStyles.statusChipText]}
                numberOfLines={1}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <FormField
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Site or area (optional)"
        />
        <FormField
          label="Contact person name"
          value={contactName}
          onChangeText={setContactName}
          placeholder="Name of key client contact"
        />
        <FormField
          label="Contact person phone"
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
        />
        <FormField
          label="Contact person email"
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Optional"
          keyboardType="email-address"
        />
        <FormField
          label={`Value (${currencyCode})`}
          value={value}
          onChangeText={setValue}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />
        <Text style={modalStyles.capturedHint}>Capture date is set automatically when you save.</Text>
        <Text style={sharedStyles.pickerLabel}>Client (optional)</Text>
        <View style={sharedStyles.chipRow}>
          <Pressable
            style={[sharedStyles.chip, clientId === null && sharedStyles.chipActive]}
            onPress={() => setClientId(null)}
          >
            <Text style={[sharedStyles.chipText, clientId === null && sharedStyles.chipTextActive]}>None</Text>
          </Pressable>
          {clients.map((c) => (
            <Pressable
              key={c.id}
              style={[sharedStyles.chip, clientId === c.id && sharedStyles.chipActive]}
              onPress={() => setClientId(c.id)}
            >
              <Text style={[sharedStyles.chipText, clientId === c.id && sharedStyles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton title="Save" onPress={save} disabled={!name.trim()} />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  searchInput: {
    marginHorizontal: space.safe,
    marginBottom: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHighest,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.onBackground,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipScroll: {
    paddingHorizontal: space.safe,
    gap: space.sm,
    paddingBottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    paddingVertical: space.sm,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    maxWidth: 220,
  },
  filterChipOn: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.onSecondaryContainer,
  },
  filterChipTextOn: {
    color: colors.onPrimary,
    fontFamily: fonts.bodySemi,
  },
  listContent: {
    paddingBottom: 120,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});

const modalStyles = StyleSheet.create({
  statusChip: {
    paddingVertical: space.sm,
    paddingHorizontal: 12,
  },
  statusChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
  },
  capturedHint: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginBottom: space.md,
    marginTop: -space.xs,
  },
});
