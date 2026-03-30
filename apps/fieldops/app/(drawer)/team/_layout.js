import { Stack } from "expo-router";
import { colors, fonts } from "../../../theme/tokens";

export default function TeamStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onBackground,
        headerTitleStyle: { fontFamily: fonts.displayBold },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Team", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Team member" }} />
    </Stack>
  );
}
