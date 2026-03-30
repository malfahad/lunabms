import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { FormField } from "../components/FormField";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDatabase } from "../context/DatabaseContext";
import { colors, fonts, space } from "../theme/tokens";

export default function RegisterScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [businessName, setBusinessName] = useState("");
  const [businessUsername, setBusinessUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    setLoading(true);
    setError("");
    setHint("");
    try {
      await db.sync.service.register({ businessName, businessUsername, email, password, confirmPassword });
      setHint("Account created. Verify your email before signing in.");
      router.replace({
        pathname: "/verify-email",
        params: { businessUsername, email },
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.sub}>Register your business account and verify email before first login.</Text>
      <FormField
        label="Business name"
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Acme Services Ltd"
        autoCapitalize="words"
      />
      <FormField
        label="Business username"
        value={businessUsername}
        onChangeText={setBusinessUsername}
        placeholder="acme-services"
        autoCapitalize="none"
      />
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="owner@business.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Minimum 8 characters"
        secureTextEntry
        autoCapitalize="none"
      />
      <FormField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Retype password"
        secureTextEntry
        autoCapitalize="none"
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <PrimaryButton title={loading ? "Creating account..." : "Register"} onPress={onRegister} disabled={loading} />
      <PrimaryButton title="Back to login" onPress={() => router.push("/login")} disabled={loading} variant="secondary" />
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
