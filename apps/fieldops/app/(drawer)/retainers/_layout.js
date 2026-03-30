import { Stack } from "expo-router";
import { colors, fonts } from "../../../theme/tokens";

export default function RetainersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onBackground,
        headerTitleStyle: { fontFamily: fonts.displayBold },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Client deposits", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Client deposit" }} />
    </Stack>
  );
}
