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
import { sharedStyles } from "../../../theme/styles";
import { colors, fonts, radius, space } from "../../../theme/tokens";

function formatKind(kind) {
  const k = String(kind || "").trim();
  const lc = k.toLowerCase();
  if (!lc) return "—";
  if (lc === "client") return "Client";
  if (lc === "supplier") return "Supplier";
  return k;
}

function cleanNullable(s) {
  const v = (s ?? "").toString().trim();
  return v === "" ? null : v;
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

export default function ContactDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const navigation = useNavigation();
  const router = useRouter();
  const repos = useRepos();

  const [contact, setContact] = useState(null);

  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editKind, setEditKind] = useState("client");

  const refresh = useCallback(() => {
    if (!id) return;
    const c = repos.clients.get(id);
    setContact(c ?? null);
  }, [id, repos]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const effectiveKind = useMemo(() => {
    const k = contact?.kind ?? contact?.type ?? null;
    return (k === "supplier" || k === "client") ? k : "client";
  }, [contact?.kind, contact?.type]);

  const openEdit = useCallback(() => {
    if (!contact) return;
    const k = (contact.kind ?? contact.type ?? "client") === "supplier" ? "supplier" : "client";
    setEditName(contact.name ? String(contact.name) : "");
    setEditPhone(contact.phone ? String(contact.phone) : "");
    setEditEmail(contact.email ? String(contact.email) : "");
    setEditNotes(contact.notes ? String(contact.notes) : "");
    setEditKind(k);
    setEditModal(true);
  }, [contact]);

  const saveEdit = useCallback(() => {
    if (!id || !contact) return;
    if (!editName.trim()) {
      Alert.alert("Name required", "Enter a name for this contact.");
      return;
    }
    try {
      repos.clients.update(
        id,
        {
          name: editName.trim(),
          phone: cleanNullable(editPhone),
          email: cleanNullable(editEmail),
          notes: cleanNullable(editNotes),
          kind: editKind,
        },
        { expectedUpdatedAt: contact.updated_at }
      );
      setEditModal(false);
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not save", "This contact was changed elsewhere. Refreshing.");
        refresh();
        setEditModal(false);
      } else {
        Alert.alert("Could not save", String(e?.message || e));
      }
    }
  }, [id, contact, editName, editPhone, editEmail, editNotes, editKind, repos, refresh]);

  const confirmDelete = useCallback(() => {
    if (!id || !contact) return;
    const label = contact.name ? String(contact.name) : "this contact";
    Alert.alert("Delete contact?", `This removes “${label}” and will cascade to linked records where configured.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          repos.clients.delete(id);
          router.replace("/(drawer)/contacts");
        },
      },
    ]);
  }, [id, contact, repos, router]);

  const callPhone = useCallback(async () => {
    const dial = toDialablePhone(contact?.phone);
    if (!dial) {
      Alert.alert("No callable number", "This contact does not have a valid phone number.");
      return;
    }
    try {
      await Linking.openURL(`tel:${dial}`);
    } catch {
      Alert.alert("Could not place call", "Your device could not start a phone call.");
    }
  }, [contact?.phone]);

  useLayoutEffect(() => {
    if (!contact) {
      navigation.setOptions({ title: "Contacts", headerTitle: "Contact", headerRight: undefined });
      return;
    }
    navigation.setOptions({
      // Keep drawer/left navigation label stable ("Contacts") by not setting `title` to the record name.
      // Show the record name only in the header via `headerTitle`.
      title: "Contacts",
      headerTitle: contact.name ? String(contact.name) : "Contact",
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={openEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit contact">
            <Text style={styles.headerLink}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Delete contact"
          >
            <Text style={styles.headerLinkMuted}>Delete</Text>
          </Pressable>
        </View>
      ),
    });
  }, [contact, navigation, openEdit, confirmDelete]);

  if (!id) {
    return (
      <View style={styles.mutedWrap}>
        <Text style={styles.muted}>Missing contact id.</Text>
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.mutedWrap}>
        <Text style={styles.muted}>Contact not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Contact</Text>
        <Text style={styles.title}>{contact.name ? String(contact.name) : "—"}</Text>
        <Text style={styles.sub}>Type: {formatKind(effectiveKind)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Details</Text>
        {contact.email ? (
          <View style={styles.line}>
            <MaterialIcons name="mail-outline" size={18} color={colors.onSecondaryVariant} />
            <Text style={styles.body}>{String(contact.email)}</Text>
          </View>
        ) : null}
        {contact.phone ? (
          <View style={styles.line}>
            <MaterialIcons name="phone" size={18} color={colors.onSecondaryVariant} />
            <Text style={styles.body}>{String(contact.phone)}</Text>
            <Pressable onPress={() => void callPhone()} style={styles.callBtn} accessibilityRole="button">
              <MaterialIcons name="call" size={14} color={colors.primary} />
              <Text style={styles.callBtnText}>Call</Text>
            </Pressable>
          </View>
        ) : null}
        {!contact.email && !contact.phone ? <Text style={styles.body}>No phone or email.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text style={styles.body}>{contact.notes ? String(contact.notes) : "—"}</Text>
      </View>

      <SimpleModal visible={editModal} title="Edit contact" onClose={() => setEditModal(false)}>
        <FormField label="Name *" value={editName} onChangeText={setEditName} placeholder="Company or person" />
        <FormField
          label="Phone number"
          value={editPhone}
          onChangeText={setEditPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
        />
        <FormField
          label="Email"
          value={editEmail}
          onChangeText={setEditEmail}
          placeholder="Optional"
          keyboardType="email-address"
        />
        <FormField label="Notes" value={editNotes} onChangeText={setEditNotes} placeholder="Optional" multiline />
        <Text style={sharedStyles.label}>Type</Text>
        <View style={sharedStyles.seg}>
          <Pressable
            style={[sharedStyles.segBtn, editKind === "client" && sharedStyles.segBtnOn]}
            onPress={() => setEditKind("client")}
          >
            <Text style={[sharedStyles.segTxt, editKind === "client" && sharedStyles.segTxtOn]}>Client</Text>
          </Pressable>
          <Pressable
            style={[sharedStyles.segBtn, editKind === "supplier" && sharedStyles.segBtnOn]}
            onPress={() => setEditKind("supplier")}
          >
            <Text style={[sharedStyles.segTxt, editKind === "supplier" && sharedStyles.segTxtOn]}>
              Supplier
            </Text>
          </Pressable>
        </View>
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

