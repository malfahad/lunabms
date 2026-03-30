import { Tabs, router } from "expo-router";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, fonts } from "../../../theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerLeft: () => <DrawerToggleButton tintColor={colors.onBackground} />,
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onBackground,
        headerTitleStyle: { fontFamily: fonts.displayBold },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSecondaryVariant,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="pipeline"
        options={{
          title: "Pipeline",
          tabBarLabel: "Pipeline",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="timeline" color={color} size={size} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace("/(drawer)/(tabs)/pipeline");
          },
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarLabel: "Projects",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="work-outline" color={color} size={size} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const projectsRoute = state.routes.find((r) => r.name === "projects");
            const nested = projectsRoute?.state;
            if (!nested || nested.index === 0) return;
            e.preventDefault();
            router.replace("/(drawer)/(tabs)/projects");
          },
        })}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Updates",
          tabBarLabel: "Updates",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications-none" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: "Finance",
          tabBarLabel: "Finance",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="account-balance-wallet" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
