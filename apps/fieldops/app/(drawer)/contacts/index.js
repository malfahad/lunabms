import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { ContactCard } from "../../../components/ContactCard";
import { FormField } from "../../../components/FormField";
import { ListEmptyState } from "../../../components/ListEmptyState";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenFab } from "../../../components/ScreenFab";
import { SimpleModal } from "../../../components/SimpleModal";
import { useRepos } from "../../../context/DatabaseContext";
import { useRouter } from "expo-router";
import { sharedStyles } from "../../../theme/styles";
import { colors, fonts, radius, space } from "../../../theme/tokens";

export default function ContactsScreen() {
  const repos = useRepos();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState("client");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | client | supplier

  const refresh = useCallback(() => setRows(repos.clients.list()), [repos]);
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  function openNew() {
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setKind("client");
    setModal(true);
  }

  function save() {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter a name for this contact.");
      return;
    }
    repos.clients.insert({
      name: name.trim(),
      type: kind,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    });
    setModal(false);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setKind("client");
    refresh();
  }

  const clearFilters = useCallback(() => {
    setSearch("");
    setTypeFilter("all");
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      const k = String(c.kind ?? c.type ?? "").toLowerCase();
      if (typeFilter !== "all" && k !== typeFilter) return false;
      if (!q) return true;
      const hay = [c.name, c.phone, c.email, c.notes]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [rows, search, typeFilter]);

  const listHeader = useMemo(() => {
    return (
      <View style={styles.headerBlock}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={18} color={colors.onSecondaryVariant} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts…"
            placeholderTextColor={colors.onSecondaryVariant}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search contacts"
          />
        </View>
        <Text style={sharedStyles.pickerLabel}>Customer type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {[
            { id: "all", label: "All" },
            { id: "client", label: "Clients" },
            { id: "supplier", label: "Suppliers" },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setTypeFilter(opt.id)}
              style={[styles.filterChip, typeFilter === opt.id && styles.filterChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: typeFilter === opt.id }}
            >
              <Text
                style={[styles.filterChipText, typeFilter === opt.id && styles.filterChipTextOn]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }, [search, typeFilter]);

  const emptyComponent = useMemo(() => {
    if (filteredRows.length !== 0) return null;
    if (rows.length === 0) {
      return (
        <ListEmptyState
          variant="contacts"
          title="No contacts yet"
          message="Save clients you sell to and suppliers you buy from. You will link them to jobs and expenses."
          ctaLabel="Add contact"
          onCta={openNew}
        />
      );
    }
    return (
      <ListEmptyState
        variant="generic"
        title="No matches"
        message="Try a different search term or filter."
        ctaLabel="Clear search & filters"
        onCta={clearFilters}
      />
    );
  }, [filteredRows.length, rows.length, clearFilters]);

  // UX target:
  // - Mobile: 2-column grid
  // - Tablet + Web: 4-column grid
  const numColumns = width >= 768 ? 4 : 2;

  return (
    <View style={sharedStyles.screen}>
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: c }) => (
          <View style={styles.col}>
            <ContactCard contact={c} onViewDetails={() => router.push(`/(drawer)/contacts/${c.id}`)} />
          </View>
        )}
        contentContainerStyle={[styles.listContent, filteredRows.length === 0 && styles.listContentEmpty]}
        ListEmptyComponent={emptyComponent}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      />
      <ScreenFab label="+ Contact" onPress={openNew} bottomOffset={16} accessibilityLabel="New contact" />
      <SimpleModal visible={modal} title="New contact" onClose={() => setModal(false)}>
        <FormField label="Name *" value={name} onChangeText={setName} placeholder="Company or person" />
        <FormField
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
        />
        <FormField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Optional"
          keyboardType="email-address"
        />
        <FormField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
        <Text style={sharedStyles.label}>Type</Text>
        <View style={sharedStyles.seg}>
          <Pressable
            style={[sharedStyles.segBtn, kind === "client" && sharedStyles.segBtnOn]}
            onPress={() => setKind("client")}
          >
            <Text style={[sharedStyles.segTxt, kind === "client" && sharedStyles.segTxtOn]}>Client</Text>
          </Pressable>
          <Pressable
            style={[sharedStyles.segBtn, kind === "supplier" && sharedStyles.segBtnOn]}
            onPress={() => setKind("supplier")}
          >
            <Text style={[sharedStyles.segTxt, kind === "supplier" && sharedStyles.segTxtOn]}>Supplier</Text>
          </Pressable>
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
  searchWrap: {
    marginHorizontal: space.safe,
    marginBottom: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHighest,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: "transparent",
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.onBackground,
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
  columnWrapper: {
    paddingHorizontal: space.safe,
    gap: space.sm,
  },
  col: { flex: 1, minWidth: 0 },
});
