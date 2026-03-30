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

function formatKind(kind) {
  const k = String(kind || "").trim();
  if (!k) return "—";
  const lc = k.toLowerCase();
  if (lc === "client") return "Client";
  if (lc === "supplier") return "Supplier";
  return k;
}

export function ContactCard({ contact, onViewDetails }) {
  const name = contact?.name ? String(contact.name) : "Contact";
  const kind = contact?.kind ?? contact?.type;
  const badgeLabel = formatKind(kind);

  const email = contact?.email ? String(contact.email) : null;
  const phone = contact?.phone ? String(contact.phone) : null;
  const notes = contact?.notes ? String(contact.notes) : null;

  const notesPreview = notes ? (notes.length > 56 ? `${notes.slice(0, 54)}…` : notes) : null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`${name} avatar`}>
          <Text style={styles.avatarText}>{initialsFromName(name)}</Text>
        </View>

        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {name}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={24} color={colors.onSecondaryVariant} />
      </View>

      <View style={styles.metaBlock}>
        {email ? (
          <View style={styles.metaLine}>
            <MaterialIcons name="mail-outline" size={16} color={colors.onSecondaryVariant} />
            <Text style={styles.metaText} numberOfLines={1}>
              {email}
            </Text>
          </View>
        ) : null}
        {phone ? (
          <View style={styles.metaLine}>
            <MaterialIcons name="phone" size={16} color={colors.onSecondaryVariant} />
            <Text style={styles.metaText} numberOfLines={1}>
              {phone}
            </Text>
          </View>
        ) : null}
        {!email && !phone ? (
          <Text style={[styles.metaText, { fontStyle: "italic" }]}>No contact details</Text>
        ) : null}
      </View>

      {notesPreview ? (
        <Text style={styles.notes} numberOfLines={1}>
          {notesPreview}
        </Text>
      ) : null}

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
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
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
    marginTop: 10,
    marginBottom: 10,
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

