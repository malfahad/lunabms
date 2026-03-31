import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { LWWConflictError } from "@lunabms/core";
import { FormField } from "../../../components/FormField";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { SimpleModal } from "../../../components/SimpleModal";
import { useRepos } from "../../../context/DatabaseContext";
import { colors, fonts, radius, space } from "../../../theme/tokens";

function toDialablePhone(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const plus = v.startsWith("+") ? "+" : "";
  const rest = plus ? v.slice(1) : v;
  const digits = rest.replace(/[^\d]/g, "");
  if (digits.length < 6) return null;
  return `${plus}${digits}`;
}

export default function TeamMemberDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const navigation = useNavigation();
  const router = useRouter();
  const repos = useRepos();

  const [worker, setWorker] = useState(null);

  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const refresh = useCallback(() => {
    if (!id) return;
    setWorker(repos.workers.get(id) ?? null);
  }, [id, repos]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const displayName = useMemo(() => {
    if (!worker) return "Team member";
    return worker.name ? String(worker.name) : worker.display_name ? String(worker.display_name) : "Team member";
  }, [worker]);

  const openEdit = useCallback(() => {
    if (!worker) return;
    setEditName(worker.name ? String(worker.name) : worker.display_name ? String(worker.display_name) : "");
    setEditRole(worker.role ? String(worker.role) : "");
    setEditPhone(worker.phone ? String(worker.phone) : "");
    setEditNotes(worker.notes ? String(worker.notes) : "");
    setEditModal(true);
  }, [worker]);

  const saveEdit = useCallback(() => {
    if (!id || !worker) return;
    if (!editName.trim()) {
      Alert.alert("Name required", "Enter a name for this team member.");
      return;
    }
    const cleanNullable = (s) => {
      const v = (s ?? "").toString().trim();
      return v === "" ? null : v;
    };
    try {
      repos.workers.update(
        id,
        {
          name: editName.trim(),
          role: cleanNullable(editRole),
          phone: cleanNullable(editPhone),
          notes: cleanNullable(editNotes),
        },
        { expectedUpdatedAt: worker.updated_at }
      );
      setEditModal(false);
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not save", "This team member was changed elsewhere. Refreshing.");
        refresh();
        setEditModal(false);
      } else {
        Alert.alert("Could not save", String(e?.message || e));
      }
    }
  }, [id, worker, editName, editRole, editPhone, editNotes, repos, refresh]);

  const confirmDelete = useCallback(() => {
    if (!id || !worker) return;
    Alert.alert("Delete team member?", `This removes “${displayName}” and will cascade where configured.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          repos.workers.delete(id);
          router.replace("/(drawer)/team");
        },
      },
    ]);
  }, [id, worker, repos, router, displayName]);

  const callPhone = useCallback(async () => {
    const dial = toDialablePhone(worker?.phone);
    if (!dial) {
      Alert.alert("No callable number", "This team member does not have a valid phone number.");
      return;
    }
    try {
      await Linking.openURL(`tel:${dial}`);
    } catch {
      Alert.alert("Could not place call", "Your device could not start a phone call.");
    }
  }, [worker?.phone]);

  useLayoutEffect(() => {
    if (!worker) {
      navigation.setOptions({ title: "Team", headerTitle: "Team member", headerRight: undefined });
      return;
    }
    navigation.setOptions({
      // Keep drawer/left navigation label stable ("Team") by not setting `title` to the record name.
      // Show the record name only in the header via `headerTitle`.
      title: "Team",
      headerTitle: displayName,
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={openEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit team member">
            <Text style={styles.headerLink}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Delete team member"
          >
            <Text style={styles.headerLinkMuted}>Delete</Text>
          </Pressable>
        </View>
      ),
    });
  }, [worker, navigation, displayName, openEdit, confirmDelete]);

  if (!id) {
    return (
      <View style={styles.mutedWrap}>
        <Text style={styles.muted}>Missing team member id.</Text>
      </View>
    );
  }

  if (!worker) {
    return (
      <View style={styles.mutedWrap}>
        <Text style={styles.muted}>Team member not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Team member</Text>
        <Text style={styles.title}>{displayName}</Text>
        {worker.role ? <Text style={styles.sub}>Role: {String(worker.role)}</Text> : <Text style={styles.sub}>Role: —</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact</Text>
        {worker.phone ? (
          <View style={styles.line}>
            <MaterialIcons name="phone" size={18} color={colors.onSecondaryVariant} />
            <Text style={styles.body}>{String(worker.phone)}</Text>
            <Pressable onPress={() => void callPhone()} style={styles.callBtn} accessibilityRole="button">
              <MaterialIcons name="call" size={14} color={colors.primary} />
              <Text style={styles.callBtnText}>Call</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.body}>No phone.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text style={styles.body}>{worker.notes ? String(worker.notes) : "—"}</Text>
      </View>

      <SimpleModal visible={editModal} title="Edit team member" onClose={() => setEditModal(false)}>
        <FormField label="Name *" value={editName} onChangeText={setEditName} placeholder="Worker name" />
        <FormField label="Role" value={editRole} onChangeText={setEditRole} placeholder="Optional" />
        <FormField
          label="Phone"
          value={editPhone}
          onChangeText={setEditPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
        />
        <FormField label="Notes" value={editNotes} onChangeText={setEditNotes} placeholder="Optional" multiline />
        <PrimaryButton title="Save" onPress={saveEdit} disabled={!editName.trim()} />
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
  mutedWrap: { flex: 1, padding: space.safe, backgroundColor: colors.background, justifyContent: "center" },
  muted: { fontFamily: fonts.body, color: colors.onSecondaryVariant },
  label: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  title: { fontSize: 22, fontFamily: fonts.displayBold, color: colors.onBackground, marginTop: 4 },
  sub: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bodySemi, color: colors.onBackground, marginBottom: 10 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  body: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant },
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerLink: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.primary },
  headerLinkMuted: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.financeExpense },
});

