import { Stack } from "expo-router";
import { colors, fonts } from "../../../theme/tokens";

export default function ContactsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.onBackground,
        headerTitleStyle: { fontFamily: fonts.displayBold },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Contacts", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Contact" }} />
    </Stack>
  );
}
