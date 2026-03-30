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
import * as Linking from "expo-linking";
import { LWWConflictError, formatMoney } from "@servops/core";
import { FormField } from "../../components/FormField";
import { ListEmptyState } from "../../components/ListEmptyState";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenFab } from "../../components/ScreenFab";
import { SimpleModal } from "../../components/SimpleModal";
import { useRepos } from "../../context/DatabaseContext";
import { sharedStyles } from "../../theme/styles";
import { colors, fonts, radius, shadow, space } from "../../theme/tokens";

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDay(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toDialablePhone(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const plus = v.startsWith("+") ? "+" : "";
  const rest = plus ? v.slice(1) : v;
  const digits = rest.replace(/[^\d]/g, "");
  if (digits.length < 6) return null;
  return `${plus}${digits}`;
}

export default function SuppliersScreen() {
  const repos = useRepos();
  const { width } = useWindowDimensions();
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  const ugx = (n) => formatMoney(n, currencyCode);

  const [rows, setRows] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editContact, setEditContact] = useState("");

  const refresh = useCallback(() => {
    setRows(repos.suppliers.list());
    setExpenses(repos.expenses.list());
  }, [repos]);
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  function save() {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter a supplier name.");
      return;
    }
    repos.suppliers.insert({
      name: name.trim(),
      category: category.trim() || null,
      contact: contact.trim() || null,
    });
    setModal(false);
    setName("");
    setCategory("");
    setContact("");
    refresh();
  }

  const categories = useMemo(() => {
    const set = new Set();
    for (const s of rows) {
      const v = String(s.category ?? "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      const cat = String(s.category ?? "").trim();
      if (categoryFilter !== "all" && cat !== categoryFilter) return false;
      if (!q) return true;
      const hay = [s.name, s.category, s.contact]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [rows, search, categoryFilter]);

  function openDetail(supplier) {
    setDetail(supplier);
  }

  const linkedExpenses = useMemo(() => {
    if (!detail) return [];
    const sid = detail.id;
    const supplierName = String(detail.name ?? "").trim().toLowerCase();
    const list = expenses.filter((e) => {
      if (e.supplier_id && e.supplier_id === sid) return true;
      if (!e.supplier_id && supplierName) {
        return String(e.supplier_name ?? "")
          .trim()
          .toLowerCase() === supplierName;
      }
      return false;
    });
    return list.sort((a, b) => Number(b.expense_date ?? b.updated_at ?? 0) - Number(a.expense_date ?? a.updated_at ?? 0));
  }, [detail, expenses]);

  const linkedExpenseTotal = useMemo(
    () => linkedExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0),
    [linkedExpenses]
  );

  function openEdit() {
    if (!detail) return;
    setEditName(String(detail.name ?? ""));
    setEditCategory(String(detail.category ?? ""));
    setEditContact(String(detail.contact ?? ""));
    setEditModal(true);
  }

  function saveEdit() {
    if (!detail) return;
    if (!editName.trim()) {
      Alert.alert("Name required", "Enter a supplier name.");
      return;
    }
    try {
      repos.suppliers.update(
        detail.id,
        {
          name: editName.trim(),
          category: editCategory.trim() || null,
          contact: editContact.trim() || null,
        },
        { expectedUpdatedAt: detail.updated_at }
      );
      setEditModal(false);
      const refreshed = repos.suppliers.get(detail.id);
      setDetail(refreshed ?? null);
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not save", "This supplier was changed elsewhere. Refreshing.");
        setEditModal(false);
        refresh();
      } else {
        Alert.alert("Could not save", String(e?.message || e));
      }
    }
  }

  function confirmDelete() {
    if (!detail) return;
    const label = String(detail.name || "this supplier");
    Alert.alert("Delete supplier?", `This removes “${label}”.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          repos.suppliers.delete(detail.id);
          setDetail(null);
          refresh();
        },
      },
    ]);
  }

  const callSupplier = useCallback(async () => {
    const dial = toDialablePhone(detail?.contact);
    if (!dial) {
      Alert.alert("No callable number", "This supplier contact is not a valid phone number.");
      return;
    }
    try {
      await Linking.openURL(`tel:${dial}`);
    } catch {
      Alert.alert("Could not place call", "Your device could not start a phone call.");
    }
  }, [detail?.contact]);

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color={colors.onSecondaryVariant} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search suppliers..."
          placeholderTextColor={colors.onSecondaryVariant}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search suppliers"
        />
      </View>
      <Text style={sharedStyles.pickerLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        <Pressable
          onPress={() => setCategoryFilter("all")}
          style={[styles.filterChip, categoryFilter === "all" && styles.filterChipOn]}
        >
          <Text style={[styles.filterChipText, categoryFilter === "all" && styles.filterChipTextOn]}>All</Text>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategoryFilter(cat)}
            style={[styles.filterChip, categoryFilter === cat && styles.filterChipOn]}
          >
            <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextOn]}>{cat}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const numColumns = width >= 768 ? 4 : 2;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[styles.listContent, filteredRows.length === 0 && styles.listContentEmpty]}
        ListEmptyComponent={
          rows.length === 0 ? (
            <ListEmptyState
              variant="generic"
              title="No suppliers yet"
              message="Add vendors you buy from so expenses can link to a proper supplier record."
              ctaLabel="Add supplier"
              onCta={() => setModal(true)}
            />
          ) : (
            <ListEmptyState
              variant="generic"
              title="No matches"
              message="Try a different search term or category."
              ctaLabel="Clear filters"
              onCta={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
            />
          )
        }
        renderItem={({ item: s }) => (
          <View style={styles.col}>
            <View style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsFromName(s.name)}</Text>
                </View>
                <View style={styles.titleBlock}>
                  <Text style={styles.title} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{s.category ? String(s.category) : "Supplier"}</Text>
                    </View>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.onSecondaryVariant} />
              </View>
              <View style={styles.metaBlock}>
                {s.contact ? (
                  <View style={styles.metaLine}>
                    <MaterialIcons name="phone" size={16} color={colors.onSecondaryVariant} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {String(s.contact)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.metaText, styles.metaItalic]}>No contact details</Text>
                )}
              </View>
              <Pressable onPress={() => openDetail(s)} style={styles.detailsBtn} accessibilityRole="button">
                <Text style={styles.detailsBtnText}>View Details</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      <ScreenFab
        label="+ Supplier"
        onPress={() => setModal(true)}
        bottomOffset={16}
        accessibilityLabel="New supplier"
      />
      <SimpleModal visible={modal} title="New supplier" onClose={() => setModal(false)}>
        <FormField label="Name *" value={name} onChangeText={setName} placeholder="e.g. Kampala Supplies Ltd" />
        <FormField label="Category" value={category} onChangeText={setCategory} placeholder="Timber, fuel…" />
        <FormField label="Contact" value={contact} onChangeText={setContact} placeholder="Phone or email" />
        <PrimaryButton title="Save" onPress={save} disabled={!name.trim()} />
      </SimpleModal>

      <SimpleModal visible={detail != null} title="Supplier details" onClose={() => setDetail(null)}>
        {detail ? (
          <>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Supplier</Text>
              <Text style={styles.detailTitle}>{detail.name ? String(detail.name) : "—"}</Text>
              <Text style={styles.detailSub}>Category: {detail.category ? String(detail.category) : "Uncategorized"}</Text>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Details</Text>
              {detail.contact ? (
                <View style={styles.line}>
                  <MaterialIcons name="phone" size={18} color={colors.onSecondaryVariant} />
                  <Text style={styles.detailBody}>{String(detail.contact)}</Text>
                  <Pressable onPress={() => void callSupplier()} style={styles.callBtn} accessibilityRole="button">
                    <MaterialIcons name="call" size={14} color={colors.primary} />
                    <Text style={styles.callBtnText}>Call</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.detailBody}>No contact details.</Text>
              )}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Linked expenses</Text>
              <Text style={styles.detailBody}>
                {linkedExpenses.length} record{linkedExpenses.length === 1 ? "" : "s"} · Total {ugx(linkedExpenseTotal)}
              </Text>
              {linkedExpenses.slice(0, 5).map((e) => (
                <View key={e.id} style={styles.expenseRow}>
                  <Text style={styles.expenseText} numberOfLines={1}>
                    {e.category ? String(e.category) : "Expense"} · {formatDay(Number(e.expense_date ?? e.updated_at ?? 0))}
                  </Text>
                  <Text style={styles.expenseAmount}>{ugx(Number(e.amount ?? 0))}</Text>
                </View>
              ))}
              {linkedExpenses.length === 0 ? <Text style={styles.detailBody}>No expenses linked yet.</Text> : null}
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={openEdit} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Edit</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={[styles.actionBtn, styles.actionBtnDanger]}>
                <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Delete</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </SimpleModal>

      <SimpleModal visible={editModal} title="Edit supplier" onClose={() => setEditModal(false)}>
        <FormField label="Name *" value={editName} onChangeText={setEditName} placeholder="e.g. Kampala Supplies Ltd" />
        <FormField label="Category" value={editCategory} onChangeText={setEditCategory} placeholder="Timber, fuel..." />
        <FormField label="Contact" value={editContact} onChangeText={setEditContact} placeholder="Phone or email" />
        <PrimaryButton title="Save" onPress={saveEdit} disabled={!editName.trim()} />
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
  card: {
    flex: 1,
    minWidth: 0,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadow.ambient,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginBottom: space.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.primary,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 16,
    fontFamily: fonts.bodySemi,
    color: colors.onBackground,
  },
  badgeRow: { marginTop: 6 },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHighest,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaBlock: { gap: 6 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
  metaItalic: { fontStyle: "italic" },
  detailsBtn: {
    marginTop: "auto",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsBtnText: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  detailCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailTitle: { fontSize: 22, fontFamily: fonts.displayBold, color: colors.onBackground, marginTop: 4 },
  detailSub: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bodySemi, color: colors.onBackground, marginBottom: 10 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  detailBody: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  callBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  callBtnText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.primary },
  expenseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  expenseText: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  expenseAmount: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.onBackground },
  actionsRow: {
    flexDirection: "row",
    gap: space.md,
    marginBottom: space.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDanger: {
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.financeExpense,
  },
  actionBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  actionBtnTextDanger: { color: colors.financeExpense },
});
