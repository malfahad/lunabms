import { Stack } from "expo-router";
import { colors, fonts } from "../../../../theme/tokens";

export default function ProjectsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onBackground,
        headerTitleStyle: { fontFamily: fonts.displayBold },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Project" }} />
    </Stack>
  );
}
