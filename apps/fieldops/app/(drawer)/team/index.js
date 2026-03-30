import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FormField } from "../../../components/FormField";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenFab } from "../../../components/ScreenFab";
import { SimpleModal } from "../../../components/SimpleModal";
import { ListEmptyState } from "../../../components/ListEmptyState";
import { TeamMemberCard } from "../../../components/TeamMemberCard";
import { useRepos } from "../../../context/DatabaseContext";
import { colors, fonts, radius, space } from "../../../theme/tokens";
import { sharedStyles } from "../../../theme/styles";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function TeamScreen() {
  const repos = useRepos();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [notesFilter, setNotesFilter] = useState("all"); // all | with | none

  const refresh = useCallback(() => setRows(repos.workers.list()), [repos]);
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  function save() {
    if (!displayName.trim()) return;
    repos.workers.insert({ name: displayName.trim(), notes: notes.trim() || null });
    setModal(false);
    setDisplayName("");
    setNotes("");
    refresh();
  }

  const clearFilters = useCallback(() => {
    setSearch("");
    setNotesFilter("all");
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((w) => {
      const hasNotes = Boolean(w.notes && String(w.notes).trim());
      if (notesFilter === "with" && !hasNotes) return false;
      if (notesFilter === "none" && hasNotes) return false;
      if (!q) return true;
      const name = String(w.name ?? w.display_name ?? "").toLowerCase();
      const role = String(w.role ?? "").toLowerCase();
      const phone = String(w.phone ?? "").toLowerCase();
      const notes = String(w.notes ?? "").toLowerCase();
      return [name, role, phone, notes].some((s) => s.includes(q));
    });
  }, [rows, search, notesFilter]);

  const listHeader = useMemo(() => {
    return (
      <View style={styles.headerBlock}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={18} color={colors.onSecondaryVariant} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search team members…"
            placeholderTextColor={colors.onSecondaryVariant}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search team members"
          />
        </View>
        <Text style={sharedStyles.pickerLabel}>Notes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {[
            { id: "all", label: "All" },
            { id: "with", label: "Has notes" },
            { id: "none", label: "No notes" },
          ].map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setNotesFilter(opt.id)}
              style={[styles.filterChip, notesFilter === opt.id && styles.filterChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: notesFilter === opt.id }}
            >
              <Text style={[styles.filterChipText, notesFilter === opt.id && styles.filterChipTextOn]} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }, [search, notesFilter]);

  const emptyComponent = useMemo(() => {
    if (filteredRows.length !== 0) return null;
    if (rows.length === 0) {
      return (
        <ListEmptyState
          variant="team"
          title="No team members yet"
          message="Add field workers so you can assign tasks and notify the right person when work is due."
          ctaLabel="Add team member"
          onCta={() => setModal(true)}
        />
      );
    }
    return (
      <ListEmptyState
        variant="generic"
        title="No matches"
        message="Try a different search term or notes filter."
        ctaLabel="Clear search & filters"
        onCta={clearFilters}
      />
    );
  }, [filteredRows.length, rows.length, clearFilters]);

  const numColumns = width >= 1000 ? 3 : width >= 700 ? 2 : 1;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader}
        renderItem={({ item: w }) => (
          <View style={styles.col}>
            <TeamMemberCard worker={w} onViewDetails={() => router.push(`/(drawer)/team/${w.id}`)} />
          </View>
        )}
        contentContainerStyle={[styles.listContent, filteredRows.length === 0 && styles.listContentEmpty]}
        ListEmptyComponent={emptyComponent}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        keyboardShouldPersistTaps="handled"
      />
      <ScreenFab label="+ Team member" onPress={() => setModal(true)} bottomOffset={16} accessibilityLabel="New team member" />
      <SimpleModal visible={modal} title="New team member" onClose={() => setModal(false)}>
        <FormField label="Name *" value={displayName} onChangeText={setDisplayName} placeholder="Worker name" />
        <FormField label="Notes" value={notes} onChangeText={setNotes} placeholder="Role or phone (optional)" />
        <PrimaryButton title="Save" onPress={save} disabled={!displayName.trim()} />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
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
