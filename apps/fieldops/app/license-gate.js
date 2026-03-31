import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDatabase } from "../context/DatabaseContext";
import { colors, fonts, space } from "../theme/tokens";

function formatExpiry(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "Unknown";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleString();
}

export default function LicenseGateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const db = useDatabase();
  const expiresAt = db.sync?.profile?.licenseExpiresAt || "";
  const detail = String(params?.detail || "").trim();
  const cta = String(params?.cta || "").trim();

  async function onLogout() {
    await db.sync.service.logout();
    router.replace("/welcome");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>License expired</Text>
      <Text style={styles.message}>
        {detail || "Your business license has expired. Renew your Luna BMS license to continue using the app."}
      </Text>
      <Text style={styles.detail}>Expires at: {formatExpiry(expiresAt)}</Text>
      <Text style={styles.detail}>{cta || "Contact support@lunabms.com"}</Text>
      <View style={styles.actions}>
        <PrimaryButton title="Logout" onPress={onLogout} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: space.safe,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: colors.financeExpense,
    fontFamily: fonts.displayExtraBold,
  },
  message: {
    marginTop: space.md,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSecondaryVariant,
    fontFamily: fonts.body,
  },
  detail: {
    marginTop: space.sm,
    fontSize: 14,
    color: colors.onBackground,
    fontFamily: fonts.bodySemi,
  },
  actions: {
    marginTop: space.xl,
  },
});
