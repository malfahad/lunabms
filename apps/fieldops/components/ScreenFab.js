import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, shadow, space } from "../theme/tokens";

export function ScreenFab({ label, onPress, accessibilityLabel, bottomOffset = 52 }) {
  const insets = useSafeAreaInsets();
  const bottom = bottomOffset + Math.max(insets.bottom, 8) + 8;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.outer, { bottom }, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.fabLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    right: space.safe,
    maxWidth: 220,
    borderRadius: 9999,
    zIndex: 20,
    ...shadow.ambient,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: { opacity: 0.92 },
  fabLabel: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    textAlign: "center",
  },
});
