import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { FormField } from "../components/FormField";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDatabase } from "../context/DatabaseContext";
import { colors, fonts, space } from "../theme/tokens";

export default function LoginScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [businessUsername, setBusinessUsername] = useState(
    db?.sync?.profile?.businessUsername || db?.sync?.profile?.businessName || ""
  );
  const [email, setEmail] = useState(db?.sync?.profile?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [gateHint, setGateHint] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setLoading(true);
    setError("");
    setGateHint("");
    try {
      await db.sync.service.login({ businessUsername, email, password });
      router.replace("/(drawer)/(tabs)/pipeline");
    } catch (e) {
      if (e?.gate === "email_not_verified") {
        setGateHint("Email is not verified yet. You can resend the verification email.");
        router.push({
          pathname: "/verify-email",
          params: { businessUsername, email },
        });
      } else if (e?.gate === "license_expired") {
        setGateHint("License is expired. Contact support@servops.com.");
        router.replace({
          pathname: "/license-gate",
          params: {
            detail: String(e?.body?.detail || e?.message || "License is expired."),
            cta: String(e?.body?.cta || "Contact support@servops.com"),
          },
        });
      }
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.sub}>Use your business username, email, and password.</Text>
      <FormField
        label="Business username"
        value={businessUsername}
        onChangeText={setBusinessUsername}
        placeholder="your-business"
        autoCapitalize="none"
      />
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@business.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {gateHint ? <Text style={styles.hint}>{gateHint}</Text> : null}
      <PrimaryButton title={loading ? "Signing in..." : "Sign in"} onPress={onLogin} disabled={loading} />
      <PrimaryButton
        title="Forgot password"
        onPress={() => router.push("/forgot-password")}
        disabled={loading}
        variant="secondary"
      />
      <PrimaryButton
        title="Create account instead"
        onPress={() => router.push("/register")}
        disabled={loading}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: space.safe,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.displayExtraBold,
    color: colors.onBackground,
  },
  sub: {
    marginTop: space.xs,
    marginBottom: space.lg,
    color: colors.onSecondaryVariant,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  err: {
    marginTop: space.xs,
    color: colors.financeExpense,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  hint: {
    marginTop: space.xs,
    color: colors.financePositive,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
