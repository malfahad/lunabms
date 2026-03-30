import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FormField } from "../components/FormField";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDatabase } from "../context/DatabaseContext";
import { colors, fonts, radius, space } from "../theme/tokens";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [email, setEmail] = useState("");
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canReset = useMemo(
    () => Boolean(selectedTenant && newPassword && confirmNewPassword && email),
    [confirmNewPassword, email, newPassword, selectedTenant]
  );

  async function lookupTenants() {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const body = await db.sync.service.forgotPassword({ email });
      const nextTenants = Array.isArray(body?.tenants) ? body.tenants : [];
      setTenants(nextTenants);
      setSelectedTenant(nextTenants[0]?.business_username || "");
      setStatus("Select your tenant and set a new password.");
    } catch (e) {
      setError(String(e?.message || e));
      setTenants([]);
      setSelectedTenant("");
    } finally {
      setLoading(false);
    }
  }

  async function onResetPassword() {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      await db.sync.service.resetPassword({
        businessUsername: selectedTenant,
        email,
        newPassword,
        confirmNewPassword,
      });
      setStatus("Password reset successful. You can now sign in.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.sub}>Enter your email to find registered tenants, then set your new password.</Text>

      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@business.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <PrimaryButton
        title={loading ? "Searching..." : "Reset Password"}
        onPress={lookupTenants}
        disabled={loading}
        variant="secondary"
      />

      {tenants.length ? <Text style={styles.section}>Registered tenants</Text> : null}
      {tenants.map((tenant) => {
        const isSelected = selectedTenant === tenant.business_username;
        return (
          <Pressable
            key={tenant.business_username}
            style={[styles.tenantRow, isSelected && styles.tenantRowSelected]}
            onPress={() => setSelectedTenant(tenant.business_username)}
          >
            <Text style={styles.tenantName}>{tenant.business_name}</Text>
            <Text style={styles.tenantUsername}>{tenant.business_username}</Text>
          </Pressable>
        );
      })}

      {tenants.length ? (
        <>
          <FormField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimum 8 characters"
            secureTextEntry
            autoCapitalize="none"
          />
          <FormField
            label="Confirm new password"
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Retype new password"
            secureTextEntry
            autoCapitalize="none"
          />
          <PrimaryButton
            title={loading ? "Resetting..." : "Reset password"}
            onPress={onResetPassword}
            disabled={loading || !canReset}
          />
        </>
      ) : null}

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <PrimaryButton
        title="Back to login"
        onPress={() => router.replace("/login")}
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
  section: {
    marginTop: space.sm,
    marginBottom: space.xs,
    color: colors.onBackground,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    textTransform: "uppercase",
  },
  tenantRow: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  tenantRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerHighest,
  },
  tenantName: {
    fontFamily: fonts.bodySemi,
    color: colors.onBackground,
    fontSize: 14,
  },
  tenantUsername: {
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    fontSize: 13,
    marginTop: 2,
  },
  status: {
    marginTop: space.xs,
    color: colors.financePositive,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  err: {
    marginTop: space.xs,
    color: colors.financeExpense,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
