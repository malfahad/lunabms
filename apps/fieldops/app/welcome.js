import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";
import { WelcomeIllustration } from "../components/WelcomeIllustration";
import { colors, fonts, space } from "../theme/tokens";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <WelcomeIllustration />
      </View>
      <Text style={styles.title}>Welcome to Luna BMS</Text>
      <Text style={styles.message}>
        Luna Business Management System helps you manage field work even when offline. Sign in to keep your local
        data synchronized securely with your business tenant in the cloud.
      </Text>

      <View style={styles.ctaWrap}>
        <PrimaryButton title="Create business account" onPress={() => router.push("/register")} />
        <PrimaryButton title="Login" onPress={() => router.push("/login")} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: space.safe,
    paddingVertical: space.xl,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: space.lg,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: colors.onBackground,
    fontFamily: fonts.displayExtraBold,
    marginBottom: space.sm,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSecondaryVariant,
    fontFamily: fonts.body,
  },
  ctaWrap: {
    marginTop: space.xl,
  },
});
