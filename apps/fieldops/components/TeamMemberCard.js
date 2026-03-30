import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadow, space } from "../theme/tokens";

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeamMemberCard({ worker, onViewDetails }) {
  const name = worker?.name ?? worker?.display_name ?? "Team member";
  const role = worker?.role ? String(worker.role) : null;
  const phone = worker?.phone ? String(worker.phone) : null;
  const notes = worker?.notes ? String(worker.notes) : null;

  const notesPreview = notes ? (notes.length > 56 ? `${notes.slice(0, 54)}…` : notes) : null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`${name} avatar`}>
          <Text style={styles.avatarText}>{initialsFromName(name)}</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Team member</Text>
            </View>
          </View>
          {role ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {role}
            </Text>
          ) : null}
        </View>

        <MaterialIcons name="chevron-right" size={24} color={colors.onSecondaryVariant} />
      </View>

      <View style={styles.metaBlock}>
        {phone ? (
          <View style={styles.metaLine}>
            <MaterialIcons name="phone" size={16} color={colors.onSecondaryVariant} />
            <Text style={styles.metaText} numberOfLines={1}>
              {phone}
            </Text>
          </View>
        ) : null}
        {!phone ? <Text style={[styles.metaText, { fontStyle: "italic" }]}>No phone</Text> : null}
        {notesPreview ? (
          <Text style={styles.notes} numberOfLines={2}>
            {notesPreview}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onViewDetails}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${name}`}
        style={({ pressed }) => [styles.detailsBtn, pressed && styles.detailsBtnPressed]}
      >
        <Text style={styles.detailsBtnText}>View Details</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadow.ambient,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginBottom: space.sm,
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
  badgeRow: { marginTop: 6 },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHighest,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 4,
  },
  metaBlock: { gap: 6 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
  notes: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 6,
  },
  detailsBtn: {
    marginTop: "auto",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsBtnPressed: { opacity: 0.9 },
  detailsBtnText: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
});

