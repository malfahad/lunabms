import { DrawerToggleButton } from "@react-navigation/drawer";
import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { CollapsibleDrawerContent } from "../../components/CollapsibleDrawerContent";
import { useDatabase } from "../../context/DatabaseContext";
import { colors, fonts } from "../../theme/tokens";

const DRAWER_WIDTH_EXPANDED = 268;
const DRAWER_WIDTH_COLLAPSED = 76;

export default function DrawerLayout() {
  const { sync } = useDatabase();
  const { width } = useWindowDimensions();
  const isLarge = width >= 900;
  const [railCollapsed, setRailCollapsed] = useState(false);

  const onToggleCollapse = useCallback(() => {
    setRailCollapsed((c) => !c);
  }, []);

  useEffect(() => {
    if (!isLarge) setRailCollapsed(false);
  }, [isLarge]);

  const drawerContent = useCallback(
    (props) => (
      <CollapsibleDrawerContent
        {...props}
        collapsed={isLarge && railCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
    ),
    [isLarge, railCollapsed, onToggleCollapse]
  );

  if (!sync?.ready) return null;
  if (!sync?.authenticated) return <Redirect href="/welcome" />;

  return (
    <Drawer
      drawerContent={isLarge ? drawerContent : undefined}
      screenOptions={({ route }) => ({
        drawerType: isLarge ? "permanent" : "front",
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.onSecondaryVariant,
        drawerLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
        overlay: !isLarge,
        drawerStyle: isLarge
          ? {
              width: railCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED,
              backgroundColor: colors.surfaceContainerLow,
              borderRightWidth: 0,
            }
          : {
              backgroundColor: colors.surfaceContainerLow,
              borderRightWidth: 0,
            },
        headerShown: route.name !== "(tabs)",
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onBackground,
        headerTitleStyle: { fontFamily: fonts.displayBold, color: colors.onBackground },
        headerShadowVisible: false,
        headerLeft: () => <DrawerToggleButton tintColor={colors.onBackground} />,
      })}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          title: "Home",
          drawerLabel: "Home",
          drawerIcon: ({ color, size }) => <MaterialIcons name="home" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="contacts"
        options={{
          title: "Contacts",
          drawerLabel: "Contacts",
          drawerIcon: ({ color, size }) => <MaterialIcons name="contacts" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="suppliers"
        options={{
          title: "Suppliers",
          drawerLabel: "Suppliers",
          drawerIcon: ({ color, size }) => <MaterialIcons name="storefront" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="team"
        options={{
          title: "Team",
          drawerLabel: "Team",
          drawerIcon: ({ color, size }) => <MaterialIcons name="groups" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="retainers"
        options={{
          title: "Client deposits",
          drawerLabel: "Client deposits",
          drawerIcon: ({ color, size }) => <MaterialIcons name="account-balance-wallet" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="reports"
        options={{
          title: "Reports",
          drawerLabel: "Reports",
          drawerIcon: ({ color, size }) => <MaterialIcons name="bar-chart" color={color} size={size} />,
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerLabel: "Settings",
          drawerIcon: ({ color, size }) => <MaterialIcons name="settings" color={color} size={size} />,
        }}
      />
    </Drawer>
  );
}
