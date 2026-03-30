import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, space } from "../theme/tokens";

function formatPostTime(ts) {
  if (ts == null || ts === "") return "";
  try {
    const d = new Date(Number(ts));
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Today ${timeStr}`;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * @param {{
 *   post: { body?: string | null; transcript?: string | null; type?: string; created_at: number };
 *   authorName?: string | null;
 *   parentLabel: string;
 *   onPressParent?: () => void;
 * }} props
 */
export function PostBubble({ post, authorName, parentLabel, onPressParent }) {
  const displayName = authorName?.trim() || "Unattributed";
  const initial = displayName.charAt(0).toUpperCase();
  const timeStr = formatPostTime(post.created_at);
  const text =
    post.transcript?.trim() ||
    post.body?.trim() ||
    (post.type && post.type !== "text" ? `(${post.type})` : "");

  return (
    <View style={styles.outer}>
      <View style={styles.row}>
        <View style={styles.avatar} accessibilityLabel={`Author ${displayName}`}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.bubble}>
          <Text style={styles.meta}>
            <Text style={styles.metaName}>{displayName}</Text>
            {timeStr ? <Text style={styles.metaTime}> · {timeStr}</Text> : null}
          </Text>
          {text ? <Text style={styles.body}>{text}</Text> : null}
          {onPressParent ? (
            <Pressable
              style={({ pressed }) => [styles.parentPill, styles.parentPillLink, pressed && styles.parentPillPressed]}
              onPress={onPressParent}
              accessibilityRole="link"
              accessibilityLabel={`Open ${parentLabel}`}
            >
              <Text style={styles.parentTextLink} numberOfLines={1}>
                {parentLabel}
              </Text>
              <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
            </Pressable>
          ) : (
            <View style={styles.parentPill}>
              <Text style={styles.parentText}>{parentLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: space.md,
    paddingHorizontal: space.safe,
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  avatarText: {
    fontSize: 15,
    fontFamily: fonts.displayBold,
    color: colors.onSecondaryContainer,
  },
  bubble: {
    flex: 1,
    maxWidth: "88%",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopLeftRadius: radius.sm,
    shadowColor: colors.onBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  meta: { marginBottom: 4 },
  metaName: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
  },
  metaTime: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.onBackground,
    lineHeight: 22,
  },
  parentPill: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHighest,
  },
  parentPillLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    maxWidth: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  parentPillPressed: {
    opacity: 0.85,
  },
  parentText: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  parentTextLink: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
