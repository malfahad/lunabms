import { MaterialIcons } from "@expo/vector-icons";
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRepos } from "../context/DatabaseContext";
import { colors, fonts, radius, space } from "../theme/tokens";

const APP_DISPLAY_NAME = "Field Ops";
const MAX_BRAND_CHARS = 28;

function getDrawerBrandName(name) {
  const cleaned = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || APP_DISPLAY_NAME;
  if (base.length <= MAX_BRAND_CHARS) return base;
  return `${base.slice(0, MAX_BRAND_CHARS - 1).trimEnd()}…`;
}

const ROUTE_ICONS = {
  "(tabs)": "home",
  contacts: "contacts",
  suppliers: "local-shipping",
  team: "group",
  retainers: "account-balance-wallet",
  reports: "assessment",
  library: "perm-media",
  settings: "settings",
};

export function CollapsibleDrawerContent(props) {
  const repos = useRepos();
  const appSettings = repos.appSettings.getSnapshot();
  const drawerBrand = getDrawerBrandName(appSettings.company_name);
  const { collapsed, onToggleCollapse, ...drawerProps } = props;
  const { state, navigation, descriptors } = drawerProps;

  return (
    <DrawerContentScrollView
      {...drawerProps}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
      showsVerticalScrollIndicator={!collapsed}
    >
      <View style={[styles.toolbar, collapsed && styles.toolbarCollapsed]}>
        <Pressable
          onPress={onToggleCollapse}
          style={({ pressed }) => [styles.toggleBtn, pressed && styles.toggleBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Expand menu" : "Collapse menu"}
        >
          <MaterialIcons name={collapsed ? "chevron-right" : "chevron-left"} size={22} color={colors.onBackground} />
        </Pressable>
        {!collapsed ? (
          <Text style={styles.brand} numberOfLines={1}>
            {drawerBrand}
          </Text>
        ) : null}
      </View>

      {collapsed ? (
        <View style={styles.rail}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const icon = ROUTE_ICONS[route.name] || "circle";
            return (
              <Pressable
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={({ pressed }) => [
                  styles.railItem,
                  focused && styles.railItemFocused,
                  pressed && styles.railItemPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={descriptors[route.key].options.title ?? route.name}
              >
                <MaterialIcons name={icon} size={24} color={focused ? colors.primary : colors.onSecondaryVariant} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <DrawerItemList {...drawerProps} />
      )}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.surfaceContainerLow,
  },
  scrollContent: {
    paddingTop: space.xs,
    flexGrow: 1,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingBottom: space.md,
    marginBottom: space.sm,
  },
  toolbarCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  toggleBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnPressed: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  brand: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    flex: 1,
  },
  rail: {
    paddingTop: space.sm,
    alignItems: "center",
    gap: space.xs,
  },
  railItem: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  railItemFocused: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  railItemPressed: {
    opacity: 0.88,
  },
});
