import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { FormField } from "../../components/FormField";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SimpleModal } from "../../components/SimpleModal";
import { useDatabase, useRepos } from "../../context/DatabaseContext";
import { persistBusinessLogoImage } from "../../lib/persistBranding";
import { sharedStyles } from "../../theme/styles";
import { colors, fonts, radius, space } from "../../theme/tokens";

const CURRENCY_OPTIONS = ["UGX", "USD", "KES", "EUR", "CNY", "AED"];
const PAYMENT_METHODS_KEY = "payment_methods";
const DEFAULT_PAYMENT_METHODS = [
  { id: "cash", label: "Cash", enabled: true },
  { id: "bank", label: "Bank", enabled: true },
  { id: "credit-card", label: "Credit Card", enabled: true },
];

function normalizeMethodId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePaymentMethods(raw) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    if (!Array.isArray(parsed)) return DEFAULT_PAYMENT_METHODS;
    const normalized = parsed
      .map((m) => {
        const label = String(m?.label || "").trim();
        const id = normalizeMethodId(m?.id || label);
        if (!id || !label) return null;
        return { id, label, enabled: m?.enabled !== false };
      })
      .filter(Boolean);
    return normalized.length ? normalized : DEFAULT_PAYMENT_METHODS;
  } catch {
    return DEFAULT_PAYMENT_METHODS;
  }
}

function serializePaymentMethods(methods) {
  return JSON.stringify(
    methods.map((m) => ({
      id: normalizeMethodId(m.id || m.label),
      label: String(m.label || "").trim(),
      enabled: m.enabled !== false,
    }))
  );
}

function formatLicenseInfo(licenseExpiresAt) {
  const raw = String(licenseExpiresAt || "").trim();
  if (!raw) return { status: "Unknown", expires: "Not available" };
  const expiresDate = new Date(raw);
  if (Number.isNaN(expiresDate.getTime())) {
    return { status: "Unknown", expires: raw };
  }
  const now = Date.now();
  const diffMs = expiresDate.getTime() - now;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const status = daysLeft < 0 ? "Expired" : "Active";
  const expires = `${expiresDate.toLocaleDateString()} (${daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`})`;
  return { status, expires };
}

export default function SettingsScreen() {
  const repos = useRepos();
  const db = useDatabase();

  const [companyName, setCompanyName] = useState("");
  const [companyTagline, setCompanyTagline] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [companyLogoLocalUrl, setCompanyLogoLocalUrl] = useState("");
  const [pendingLogoUri, setPendingLogoUri] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [defaultIncludeVat, setDefaultIncludeVat] = useState(true);
  const [defaultDueDays, setDefaultDueDays] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [currencyModal, setCurrencyModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [paymentMethodModal, setPaymentMethodModal] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [saveHint, setSaveHint] = useState("");

  const loadProfile = useCallback(() => {
    const s = repos.appSettings.getSnapshot();
    setCompanyName(s.company_name || "");
    setCompanyTagline(s.company_tagline || "");
    setCompanyLogoUrl(s.company_logo_url || "");
    setCompanyLogoLocalUrl(s.company_logo_local_url || "");
    setCompanyAddress(s.company_address || "");
    setCompanyPhone(s.company_phone || "");
    setDefaultIncludeVat(s.default_include_vat === "1");
    setDefaultDueDays(s.default_invoice_due_days || "");
    setCurrency(s.currency || "UGX");
    setPaymentMethods(parsePaymentMethods(repos.appSettings.get(PAYMENT_METHODS_KEY)));
  }, [repos]);

  const refresh = useCallback(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  async function saveProfile() {
    let nextRemoteLogo = companyLogoUrl.trim();
    if (pendingLogoUri) {
      try {
        const uploaded = await db.sync.service.uploadLogo(pendingLogoUri);
        nextRemoteLogo = String(uploaded?.logo_url || nextRemoteLogo);
      } catch (e) {
        setSaveHint(String(e?.message || e));
        setTimeout(() => setSaveHint(""), 4000);
        return;
      }
    }
    repos.appSettings.set("company_name", companyName.trim());
    repos.appSettings.set("company_tagline", companyTagline.trim());
    repos.appSettings.set("company_logo_url", nextRemoteLogo);
    repos.appSettings.set("company_logo_local_url", companyLogoLocalUrl.trim());
    repos.appSettings.set("company_address", companyAddress.trim());
    repos.appSettings.set("company_phone", companyPhone.trim());
    repos.appSettings.set("default_include_vat", defaultIncludeVat ? "1" : "0");
    repos.appSettings.set("default_invoice_due_days", defaultDueDays.trim());
    repos.appSettings.set("currency", currency);
    repos.appSettings.set(PAYMENT_METHODS_KEY, serializePaymentMethods(paymentMethods));
    setCompanyLogoUrl(nextRemoteLogo);
    setPendingLogoUri("");
    setSaveHint("Saved. New invoices will use these defaults.");
    setTimeout(() => setSaveHint(""), 4000);
  }

  async function logout() {
    await db.sync.service.logout();
    refresh();
  }

  const license = formatLicenseInfo(db.sync?.profile?.licenseExpiresAt);

  function togglePaymentMethod(methodId) {
    setPaymentMethods((rows) => rows.map((m) => (m.id === methodId ? { ...m, enabled: !m.enabled } : m)));
  }

  function addPaymentMethod() {
    const label = newPaymentMethod.trim();
    if (!label) return;
    const id = normalizeMethodId(label);
    if (!id) return;
    setPaymentMethods((rows) => {
      if (rows.some((m) => m.id === id)) return rows;
      return [...rows, { id, label, enabled: true }];
    });
    setNewPaymentMethod("");
    setPaymentMethodModal(false);
  }

  async function chooseLogoFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (r.canceled) return;
    const uri = r.assets?.[0]?.uri;
    if (!uri) return;
    const persisted = await persistBusinessLogoImage(uri);
    if (persisted) {
      setCompanyLogoLocalUrl(persisted);
      setPendingLogoUri(persisted);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>Your business details and defaults for new invoices and reminders.</Text>

      <Text style={styles.section}>Company</Text>
      <View style={styles.card}>
        <FormField label="Company name" value={companyName} onChangeText={setCompanyName} placeholder="Shown on reminders" />
        <FormField
          label="Business tagline"
          value={companyTagline}
          onChangeText={setCompanyTagline}
          placeholder="Optional slogan or short descriptor"
        />
        <Text style={styles.fieldLabel}>Business logo</Text>
        {companyLogoLocalUrl || companyLogoUrl ? (
          <View style={styles.logoWrap}>
            <Image source={{ uri: companyLogoLocalUrl || companyLogoUrl }} style={styles.logoPreview} />
          </View>
        ) : (
          <Text style={styles.logoHint}>No logo selected.</Text>
        )}
        <Pressable style={styles.btnAlt} onPress={chooseLogoFromLibrary} accessibilityRole="button">
          <Text style={styles.btnAltText}>Upload logo</Text>
        </Pressable>
        {companyLogoLocalUrl || companyLogoUrl ? (
          <Pressable
            style={[styles.btnAlt, styles.btnAltDanger]}
            onPress={() => {
              setCompanyLogoUrl("");
              setCompanyLogoLocalUrl("");
              setPendingLogoUri("");
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.btnAltText, styles.btnAltDangerText]}>Remove logo</Text>
          </Pressable>
        ) : null}
        <FormField
          label="Address"
          value={companyAddress}
          onChangeText={setCompanyAddress}
          placeholder="Optional — multi-line OK"
          multiline
        />
        <FormField
          label="Business phone"
          value={companyPhone}
          onChangeText={setCompanyPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
        />
        <Text style={styles.fieldLabel}>Currency</Text>
        <Pressable
          onPress={() => setCurrencyModal(true)}
          style={styles.currencyRow}
          accessibilityRole="button"
          accessibilityLabel="Select currency"
        >
          <Text style={styles.currencyRowText}>Selected: {currency}</Text>
        </Pressable>
        <SimpleModal visible={currencyModal} title="Choose currency" onClose={() => setCurrencyModal(false)}>
          <View style={sharedStyles.chipRow}>
            {CURRENCY_OPTIONS.map((c) => (
              <Pressable key={c} style={[sharedStyles.chip, currency === c && sharedStyles.chipActive]} onPress={() => setCurrency(c)}>
                <Text style={[sharedStyles.chipText, currency === c && sharedStyles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton title="Done" onPress={() => setCurrencyModal(false)} />
        </SimpleModal>
        <Pressable
          onPress={() => setDefaultIncludeVat((v) => !v)}
          style={styles.toggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: defaultIncludeVat }}
        >
          <Text style={styles.toggleText}>
            {defaultIncludeVat ? "✓ " : ""}Default: Include 18% VAT on new invoices
          </Text>
        </Pressable>
        <FormField
          label="Default due in (days)"
          value={defaultDueDays}
          onChangeText={setDefaultDueDays}
          placeholder="Optional — e.g. 14"
          keyboardType="number-pad"
        />
        <Text style={styles.fieldLabel}>Payment methods</Text>
        <Text style={styles.hintText}>Enable methods to show in payment entry. Add custom methods as needed.</Text>
        <View style={sharedStyles.chipRow}>
          {paymentMethods.map((m) => (
            <Pressable
              key={m.id}
              style={[sharedStyles.chip, m.enabled && sharedStyles.chipActive]}
              onPress={() => togglePaymentMethod(m.id)}
            >
              <Text style={[sharedStyles.chipText, m.enabled && sharedStyles.chipTextActive]}>
                {m.enabled ? "✓ " : ""}{m.label}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.addMethodPill} onPress={() => setPaymentMethodModal(true)}>
            <Text style={styles.addMethodPillText}>+ Add method</Text>
          </Pressable>
        </View>
        <SimpleModal visible={paymentMethodModal} title="Add payment method" onClose={() => setPaymentMethodModal(false)}>
          <FormField
            label="Method name"
            value={newPaymentMethod}
            onChangeText={setNewPaymentMethod}
            placeholder="e.g. Mobile Money"
          />
          <PrimaryButton title="Add method" onPress={addPaymentMethod} disabled={!newPaymentMethod.trim()} />
          <PrimaryButton
            title="Cancel"
            onPress={() => {
              setPaymentMethodModal(false);
              setNewPaymentMethod("");
            }}
            variant="secondary"
          />
        </SimpleModal>
        <PrimaryButton title="Save company & defaults" onPress={saveProfile} />
        {saveHint ? <Text style={styles.saveHint}>{saveHint}</Text> : null}
      </View>

      <Text style={styles.section}>Reminders & receipts</Text>
      <View style={styles.card}>
        <Row
          label="Task reminders (mobile only)"
          hint="Get local reminders when an assigned task is overdue. Reminders run when the app opens or returns to foreground, and are limited to once per task assignee per day."
        />
        <Row
          label="Payment receipt message"
          hint="When recording a payment, you can include an optional thank-you line in the shareable receipt message (toggle on or off in the payment form)."
        />
        <Row
          label="Web app behavior"
          hint="Overdue task reminders are not shown in browser. Use Projects to view overdue tasks."
        />
      </View>

      <Text style={styles.section}>Sync</Text>
      <View style={styles.card}>
        <Row label="Business account" hint={db.sync?.profile?.businessName || "Not connected"} />
        <Row label="Business username" hint={db.sync?.profile?.businessUsername || "Not connected"} />
        <Row label="Signed in as" hint={db.sync?.profile?.email || "Not connected"} />
        <Row label="Email verification" hint={db.sync?.profile?.emailVerified ? "Verified" : "Not verified"} />
        <Row label="License status" hint={license.status} />
        <Row label="License expires" hint={license.expires} />
        <Pressable style={styles.btnAlt} onPress={logout} accessibilityRole="button">
          <Text style={styles.btnAltText}>Logout</Text>
        </Pressable>
        <Row
          label="Sync status"
          hint={
            db.sync?.running
              ? "Syncing now..."
              : db.sync?.lastSyncAt
                ? `Last synced ${new Date(db.sync.lastSyncAt).toLocaleTimeString()}`
                : "Not synced yet"
          }
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, hint }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: space.safe, paddingBottom: space.xl * 2 },
  title: { fontSize: 24, fontFamily: fonts.displayBold, color: colors.onBackground },
  sub: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 6, marginBottom: space.md },
  section: {
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
  },
  row: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  rowLabel: { fontSize: 16, fontFamily: fonts.displayBold, color: colors.onBackground },
  rowHint: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 4 },
  toggle: { paddingVertical: space.sm, paddingHorizontal: space.md, marginBottom: space.sm },
  toggleText: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  fieldLabel: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  currencyRow: {
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surfaceContainerHighest,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  currencyRowText: { fontSize: 16, fontFamily: fonts.body, color: colors.onBackground },
  hintText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginHorizontal: space.md,
    marginBottom: space.sm,
  },
  addMethodPill: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.secondaryContainer,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addMethodPillText: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
  },
  saveHint: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.financePositive,
    marginHorizontal: space.md,
    marginBottom: space.md,
  },
  btnAlt: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
  },
  btnAltText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.onBackground },
  btnAltDanger: { borderColor: colors.financeExpense },
  btnAltDangerText: { color: colors.financeExpense },
  logoWrap: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.md,
  },
  logoPreview: { width: 180, height: 100, resizeMode: "contain" },
  logoHint: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
});
