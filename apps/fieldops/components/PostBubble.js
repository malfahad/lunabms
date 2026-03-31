import { useEffect, useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { parseMediaIdbKey, resolveMediaDisplayUri } from "../lib/webMediaLibrary";
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
 *   attachments?: Array<{ id: string; attachment_type: string; file_name: string; storage_uri: string }>;
 *   authorName?: string | null;
 *   parentLabel: string;
 *   onPressParent?: () => void;
 *   onPressAttachment?: (attachment: any) => void;
 *   onDownloadAttachment?: (attachment: any) => void;
 *   onDeleteAttachment?: (attachment: any) => void;
 * }} props
 */
export function PostBubble({
  post,
  attachments = [],
  authorName,
  parentLabel,
  onPressParent,
  onPressAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
}) {
  const displayName = authorName?.trim() || "Unattributed";
  const initial = displayName.charAt(0).toUpperCase();
  const timeStr = formatPostTime(post.created_at);
  const [previewImage, setPreviewImage] = useState("");
  const text =
    post.transcript?.trim() ||
    post.body?.trim() ||
    (post.type && post.type !== "text" ? `(${post.type})` : "");
  const imageAttachments = useMemo(
    () => attachments.filter((a) => String(a.attachment_type) === "image"),
    [attachments]
  );
  const fileAttachments = useMemo(
    () => attachments.filter((a) => String(a.attachment_type) !== "image"),
    [attachments]
  );
  const [imageViewUris, setImageViewUris] = useState({});
  const attachmentKeyFor = useMemo(
    () => (att, idx) => att?.id || `${String(att?.storage_uri || "")}-${idx}`,
    []
  );
  const imageDepsKey = useMemo(
    () =>
      imageAttachments
        .map((att, idx) => `${attachmentKeyFor(att, idx)}|${String(att?.storage_uri || "")}`)
        .join("||"),
    [imageAttachments, attachmentKeyFor]
  );

  useEffect(() => {
    let cancelled = false;
    const createdBlobUris = [];
    (async () => {
      const next = {};
      for (let i = 0; i < imageAttachments.length; i += 1) {
        const att = imageAttachments[i];
        const key = attachmentKeyFor(att, i);
        const displayUri = await resolveMediaDisplayUri(att.storage_uri, { attachmentId: att.id });
        if (!displayUri) continue;
        next[key] = displayUri;
        if (displayUri.startsWith("blob:")) createdBlobUris.push(displayUri);
      }
      if (!cancelled) {
        setImageViewUris((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(next);
          if (prevKeys.length !== nextKeys.length) return next;
          for (const k of nextKeys) {
            if (prev[k] !== next[k]) return next;
          }
          return prev;
        });
      }
    })();
    return () => {
      cancelled = true;
      for (const uri of createdBlobUris) {
        try {
          URL.revokeObjectURL(uri);
        } catch {
          /* ignore */
        }
      }
    };
  }, [imageDepsKey, imageAttachments, attachmentKeyFor]);

  function attachmentIcon(att) {
    return String(att.attachment_type) === "video" ? "videocam" : "description";
  }

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
          {imageAttachments.length ? (
            <View style={styles.imagesWrap}>
              {imageAttachments.map((att, idx) => (
                <Pressable
                  key={attachmentKeyFor(att, idx)}
                  style={imageAttachments.length === 1 ? styles.imageSingle : styles.imageThumb}
                  onPress={() => {
                    const displayUri = imageViewUris[attachmentKeyFor(att, idx)];
                    if (displayUri) setPreviewImage(displayUri);
                  }}
                >
                  {imageViewUris[attachmentKeyFor(att, idx)] ? (
                    <Image source={{ uri: imageViewUris[attachmentKeyFor(att, idx)] }} style={styles.image} />
                  ) : parseMediaIdbKey(att.storage_uri) ? (
                    <View style={styles.imageFallback}>
                      <MaterialIcons name="photo" size={18} color={colors.onSecondaryVariant} />
                    </View>
                  ) : (
                    <Image source={{ uri: att.storage_uri }} style={styles.image} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}
          {fileAttachments.length ? (
            <View style={styles.filesWrap}>
              {fileAttachments.map((att) => (
                <View key={att.id} style={styles.fileCard}>
                  <View style={styles.fileHead}>
                    <MaterialIcons name={attachmentIcon(att)} size={20} color={colors.onSecondaryVariant} />
                    <Text style={styles.fileName} numberOfLines={1}>
                      {att.file_name || "Attachment"}
                    </Text>
                  </View>
                  <View style={styles.fileActions}>
                    <Pressable onPress={() => onPressAttachment?.(att)}>
                      <Text style={styles.fileActionText}>View</Text>
                    </Pressable>
                    <Pressable onPress={() => onDownloadAttachment?.(att)}>
                      <Text style={styles.fileActionText}>Download</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteAttachment?.(att)}>
                      <Text style={styles.fileDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
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
      <Modal visible={Boolean(previewImage)} transparent animationType="fade" onRequestClose={() => setPreviewImage("")}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImage("")}>
          {previewImage ? <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
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
  imagesWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  imageSingle: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceContainerHighest,
  },
  imageThumb: {
    width: "48%",
    height: 110,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceContainerHighest,
  },
  image: { width: "100%", height: "100%" },
  imageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerHighest,
  },
  filesWrap: { marginTop: space.sm, gap: space.xs },
  fileCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerHighest,
    padding: space.sm,
  },
  fileHead: { flexDirection: "row", alignItems: "center", gap: space.xs },
  fileName: { flex: 1, fontSize: 13, fontFamily: fonts.bodySemi, color: colors.onBackground },
  fileActions: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  fileActionText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.primary },
  fileDeleteText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.financeExpense },
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
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: space.safe,
  },
  previewImage: { width: "100%", height: "100%" },
});
