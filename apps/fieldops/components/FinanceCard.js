import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, space } from "../theme/tokens";

/**
 * @param {{
 *   title: string,
 *   subtitle?: string | null,
 *   amount: string,
 *   amountTone?: "default" | "expense" | "payment" | "warning" | "positive",
 *   detail?: string | null,
 *   badge?: { label: string; tone?: "neutral" | "warning" | "positive"; onPress?: (() => void) | null } | null,
 *   borderAccent?: string,
 *   thumbnailUri?: string | null,
 *   action?: { label: string; onPress: () => void } | null,
 *   secondaryAction?: { label: string; onPress: () => void } | null,
 * }} props
 */
export function FinanceCard({
  title,
  subtitle,
  amount,
  amountTone = "default",
  detail,
  badge,
  borderAccent,
  thumbnailUri,
  action,
  secondaryAction,
}) {
  const amountColor =
    amountTone === "expense"
      ? colors.financeExpense
      : amountTone === "payment"
        ? colors.financePayment
        : amountTone === "warning"
          ? colors.financeWarning
          : amountTone === "positive"
            ? colors.financePositive
            : colors.onBackground;

  const badgeBg =
    badge?.tone === "warning"
      ? colors.surfaceContainerHighest
      : badge?.tone === "positive"
        ? colors.secondaryContainer
        : colors.surfaceContainerHighest;
  const badgeTxt =
    badge?.tone === "warning"
      ? colors.financeWarning
      : badge?.tone === "positive"
        ? colors.financePositive
        : colors.onSecondaryVariant;

  return (
    <View style={[styles.card, borderAccent ? { borderLeftColor: borderAccent } : styles.cardBorderDefault]}>
      <View style={styles.top}>
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? (
          badge.onPress ? (
            <Pressable
              onPress={badge.onPress}
              style={({ pressed }) => [styles.badge, { backgroundColor: badgeBg }, pressed && styles.badgePressed]}
              accessibilityRole="button"
              accessibilityLabel={badge.label}
            >
              <Text style={[styles.badgeText, { color: badgeTxt }]}>{badge.label}</Text>
            </Pressable>
          ) : (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: badgeTxt }]}>{badge.label}</Text>
            </View>
          )
        ) : null}
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{amount}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {action || secondaryAction ? (
        <View style={styles.actionRow}>
          {action ? (
            <Pressable
              onPress={action.onPress}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text style={styles.actionBtnText}>{action.label}</Text>
            </Pressable>
          ) : null}
          {secondaryAction ? (
            <Pressable
              onPress={secondaryAction.onPress}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
            >
              <Text style={styles.actionBtnText}>{secondaryAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={styles.thumb} accessibilityLabel="Receipt thumbnail" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.safe,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderLeftWidth: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    borderRightColor: colors.outlineVariant,
    borderBottomColor: colors.outlineVariant,
    shadowColor: colors.onBackground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardBorderDefault: { borderLeftColor: colors.primary },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.sm },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontFamily: fonts.bodySemi, color: colors.onBackground },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 4 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgePressed: { opacity: 0.85 },
  badgeText: { fontSize: 11, fontFamily: fonts.bodySemi, textTransform: "uppercase", letterSpacing: 0.4 },
  amount: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    marginTop: space.sm,
  },
  detail: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
    alignItems: "center",
  },
  actionBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionBtnText: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  thumb: {
    width: "100%",
    maxWidth: 200,
    height: 120,
    borderRadius: radius.md,
    marginTop: space.sm,
    backgroundColor: colors.surfaceContainerHighest,
  },
});
