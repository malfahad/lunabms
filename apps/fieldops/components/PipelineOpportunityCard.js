import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadow, space } from "../theme/tokens";
import { formatMoney } from "@servops/core";

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function activityLine(o) {
  const ts = o.captured_at != null && o.captured_at !== "" ? Number(o.captured_at) : Number(o.updated_at ?? 0);
  if (!ts) return "No date";
  const days = Math.floor((Date.now() - ts) / 86400000);
  let rel;
  if (days <= 0) rel = "today";
  else if (days === 1) rel = "yesterday";
  else rel = `${days} days ago`;
  const label = o.captured_at != null && o.captured_at !== "" ? "Captured" : "Updated";
  return `${label} · ${rel}`;
}

/**
 * @param {{
 *   opportunity: Record<string, unknown>,
 *   clientName: string | null,
 *   onPress: () => void,
 *   currencyCode?: string,
 * }} props
 */
export function PipelineOpportunityCard({ opportunity: o, clientName, onPress, currencyCode = "UGX" }) {
  const title = o.name || "Opportunity";
  const sub = clientName?.trim() || "No client linked";
  const value = o.estimated_value ?? o.value;
  const stage = String(o.status || "—");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${stage}`}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFromName(title)}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={28} color={colors.onSecondaryVariant} />
      </View>

      {o.contact_name || o.contact_email || o.contact_phone ? (
        <View style={styles.contactBlock}>
          {o.contact_name ? (
            <View style={styles.contactLine}>
              <MaterialIcons name="person-outline" size={16} color={colors.onSecondaryVariant} />
              <Text style={styles.contactText} numberOfLines={1}>
                {String(o.contact_name)}
              </Text>
            </View>
          ) : null}
          {o.contact_email ? (
            <View style={styles.contactLine}>
              <MaterialIcons name="mail-outline" size={16} color={colors.onSecondaryVariant} />
              <Text style={styles.contactText} numberOfLines={1}>
                {String(o.contact_email)}
              </Text>
            </View>
          ) : null}
          {o.contact_phone ? (
            <View style={styles.contactLine}>
              <MaterialIcons name="phone" size={16} color={colors.onSecondaryVariant} />
              <Text style={styles.contactText} numberOfLines={1}>
                {String(o.contact_phone)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {o.location ? (
        <View style={styles.metaRow}>
          <MaterialIcons name="place" size={16} color={colors.onSecondaryVariant} />
          <Text style={styles.metaText} numberOfLines={1}>
            {String(o.location)}
          </Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <MaterialIcons name="event" size={16} color={colors.onSecondaryVariant} />
        <Text style={styles.metaText}>{activityLine(o)}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.stagePill}>
          <Text style={styles.stageText} numberOfLines={1}>
            {stage}
          </Text>
        </View>
        <Text style={styles.value}>{formatMoney(value, currencyCode)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.safe,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadow.ambient,
  },
  cardPressed: {
    backgroundColor: colors.surfaceBright,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.primary,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 16,
    fontFamily: fonts.bodySemi,
    color: colors.onBackground,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 4,
  },
  contactBlock: { marginTop: space.sm, gap: 6 },
  contactLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: space.sm,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.md,
    paddingTop: space.sm,
    gap: space.md,
  },
  stagePill: {
    flexShrink: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.onBackground,
  },
  stageText: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.surfaceContainerLowest,
    textTransform: "capitalize",
  },
  value: {
    fontSize: 17,
    fontFamily: fonts.displayBold,
    color: colors.primary,
  },
});
