import { useEffect, useMemo, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";
import { EmptyIllustration } from "../components/illustrations/EmptyIllustrations";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDatabase } from "../context/DatabaseContext";
import { colors, fonts, space } from "../theme/tokens";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const db = useDatabase();
  const autoRunRef = useRef(false);

  const email = useMemo(() => String(params?.email || "").trim(), [params?.email]);
  const uid = useMemo(() => {
    const raw = params?.uid;
    return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  }, [params?.uid]);
  const token = useMemo(() => {
    const raw = params?.token;
    return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  }, [params?.token]);

  const emailHost = useMemo(() => {
    const at = email.indexOf("@");
    if (at < 0) return "";
    return email.slice(at + 1).trim().toLowerCase();
  }, [email]);

  async function onOpenEmailHost() {
    const hostUrl = emailHost ? `https://${emailHost}` : null;
    try {
      if (hostUrl) {
        await Linking.openURL(hostUrl);
        return;
      }
      await Linking.openURL("mailto:");
    } catch {
      await Linking.openURL("mailto:");
    }
  }

  useEffect(() => {
    if (autoRunRef.current) return;
    if (!uid || !token) return;
    autoRunRef.current = true;
    (async () => {
      try {
        await db.sync.service.verifyEmail({ uid, token });
        router.replace("/(drawer)/(tabs)/pipeline");
      } catch {
        // Keep the page simple; user can still open inbox and retry link if needed.
      }
    })();
  }, [uid, token, db, router]);

  return (
    <View style={styles.screen}>
      <View style={styles.illustrationWrap}>
        <EmptyIllustration variant="generic" width={220} />
      </View>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.sub}>
        We sent a verification link{email ? ` to ${email}` : ""}. Open your inbox and follow the link to continue.
      </Text>
      <PrimaryButton title={`Open ${emailHost || "email app"}`} onPress={onOpenEmailHost} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: space.safe,
    justifyContent: "center",
    alignItems: "center",
  },
  illustrationWrap: {
    marginBottom: space.lg,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.displayExtraBold,
    color: colors.onBackground,
    textAlign: "center",
  },
  sub: {
    marginTop: space.xs,
    marginBottom: space.lg,
    color: colors.onSecondaryVariant,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 360,
  },
});
