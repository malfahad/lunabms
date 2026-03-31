import "react-native-gesture-handler";
import { useCallback, useEffect } from "react";
import { Stack, usePathname, useRootNavigationState, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OverdueNotificationBridge } from "../components/OverdueNotificationBridge";
import { DatabaseProvider, useDatabase } from "../context/DatabaseContext";
import { registerMediaServiceWorker } from "../lib/registerMediaServiceWorker";
import { useAppFonts } from "../theme/fonts";
import { navigationTheme } from "../theme/navigationTheme";

SplashScreen.preventAutoHideAsync();

function isLicenseExpired(licenseExpiresAt) {
  const raw = String(licenseExpiresAt || "").trim();
  if (!raw) return false;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() <= Date.now();
}

export default function RootLayout() {
  const [loaded, error] = useAppFonts();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    registerMediaServiceWorker();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (loaded) {
      await SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
      <ThemeProvider value={navigationTheme}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <DatabaseProvider>
            <SessionGate />
            <AppSideEffects />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="welcome" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="verify-email" />
              <Stack.Screen name="forgot-password" />
            <Stack.Screen name="license-gate" />
              <Stack.Screen name="(drawer)" />
            </Stack>
          </DatabaseProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppSideEffects() {
  const { sync } = useDatabase();
  if (!sync?.authenticated) return null;
  return <OverdueNotificationBridge />;
}

function SessionGate() {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavState = useRootNavigationState();
  const { sync } = useDatabase();
  const isAuthed = Boolean(sync?.authenticated);
  const licenseExpired = isLicenseExpired(sync?.profile?.licenseExpiresAt);
  const inApp = pathname?.startsWith("/(drawer)");
  const inAuth =
    pathname === "/welcome" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/verify-email" ||
    pathname === "/forgot-password" ||
    pathname === "/";
  const onLicenseGate = pathname === "/license-gate";

  useEffect(() => {
    if (!rootNavState?.key) return;
    if (!sync?.ready) return;
    if (isAuthed && licenseExpired && !onLicenseGate) {
      router.replace("/license-gate");
      return;
    }
    if (isAuthed && !licenseExpired && onLicenseGate) {
      router.replace("/(drawer)/(tabs)/pipeline");
      return;
    }
    if (!isAuthed && inApp) {
      router.replace("/welcome");
      return;
    }
    if (isAuthed && inAuth) {
      router.replace("/(drawer)/(tabs)/pipeline");
    }
  }, [inApp, inAuth, isAuthed, licenseExpired, onLicenseGate, rootNavState?.key, router, sync?.ready]);

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
