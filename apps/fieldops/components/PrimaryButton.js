import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, space } from "../theme/tokens";

export function PrimaryButton({ title, onPress, disabled, variant = "primary" }) {
  const isSecondary = variant === "secondary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrap,
        isSecondary && styles.wrapSecondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {isSecondary ? (
        <View style={styles.secondarySurface} pointerEvents="none">
          <Text style={styles.secondaryText}>{title}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={styles.text}>{title}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    marginTop: space.sm,
  },
  gradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  text: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  wrapSecondary: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.secondaryContainer,
  },
  secondarySurface: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodySemi,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.92 },
});
