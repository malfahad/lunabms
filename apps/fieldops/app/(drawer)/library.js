import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRepos } from "../../context/DatabaseContext";
import {
  deleteAttachmentFile,
  describeAttachmentSize,
  downloadAttachment,
  openAttachment,
} from "../../lib/postAttachments";
import { parseMediaIdbKey, resolveMediaDisplayUri } from "../../lib/webMediaLibrary";
import { hydrateLibraryFromPostAttachments } from "../../lib/webMediaLibrary";
import { colors, fonts, radius, space } from "../../theme/tokens";

function shortRef(id) {
  return `…${String(id || "").slice(0, 8)}`;
}

export default function LibraryScreen() {
  const repos = useRepos();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [scope, setScope] = useState("all");
  const [thumbUris, setThumbUris] = useState({});

  const refresh = useCallback(() => {
    setRows(repos.postAttachments?.listAll?.() || []);
  }, [repos]);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (Platform.OS === "web") {
          try {
            await hydrateLibraryFromPostAttachments(repos.postAttachments?.listAll?.() || []);
          } catch {
            // best effort hydration on library open
          }
        }
        if (!cancelled) refresh();
      })();
      return () => {
        cancelled = true;
      };
    }, [refresh, repos])
  );

  const filtered = useMemo(() => {
    if (scope === "all") return rows;
    return rows.filter((r) => String(r.parent_type) === scope);
  }, [rows, scope]);

  useEffect(() => {
    let cancelled = false;
    const createdBlobUris = [];
    (async () => {
      const next = {};
      const images = filtered.filter((r) => String(r.attachment_type) === "image");
      for (const row of images) {
        const displayUri = await resolveMediaDisplayUri(row.storage_uri, { attachmentId: row.id });
        if (!displayUri) continue;
        next[row.id] = displayUri;
        if (displayUri.startsWith("blob:")) createdBlobUris.push(displayUri);
      }
      if (!cancelled) setThumbUris(next);
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
  }, [filtered]);

  async function remove(att) {
    await deleteAttachmentFile(att.storage_uri);
    repos.postAttachments.delete(att.id);
    refresh();
  }

  function openParent(att) {
    if (att.parent_type === "project") {
      router.push(`/(drawer)/(tabs)/projects/${att.parent_id}`);
      return;
    }
    router.push(`/(drawer)/(tabs)/pipeline/${att.parent_id}`);
  }

  function iconForType(att) {
    if (att.attachment_type === "video") return "videocam";
    if (att.attachment_type === "document") return "description";
    return "image";
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.sub}>All attachments across projects and opportunities.</Text>
      <View style={styles.scopeRow}>
        {[
          ["all", "All"],
          ["project", "Projects"],
          ["opportunity", "Opportunities"],
        ].map(([id, label]) => (
          <Pressable key={id} style={[styles.scopeChip, scope === id && styles.scopeChipOn]} onPress={() => setScope(id)}>
            <Text style={[styles.scopeTxt, scope === id && styles.scopeTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.head}>
              {item.attachment_type === "image" ? (
                thumbUris[item.id] ? (
                  <Image source={{ uri: thumbUris[item.id] }} style={styles.thumb} />
                ) : parseMediaIdbKey(item.storage_uri) ? (
                  <View style={styles.iconWrap}>
                    <MaterialIcons name="photo" size={24} color={colors.onSecondaryVariant} />
                  </View>
                ) : (
                  <Image source={{ uri: item.storage_uri }} style={styles.thumb} />
                )
              ) : (
                <View style={styles.iconWrap}>
                  <MaterialIcons name={iconForType(item)} size={24} color={colors.onSecondaryVariant} />
                </View>
              )}
              <View style={styles.meta}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.file_name}
                </Text>
                <Text style={styles.metaLine}>
                  {item.attachment_type} · {describeAttachmentSize(item.file_size)}
                </Text>
                <Text style={styles.metaLine}>
                  {item.parent_type} {shortRef(item.parent_id)}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => void openAttachment(item.storage_uri)}>
                <Text style={styles.actionTxt}>View</Text>
              </Pressable>
              <Pressable onPress={() => void downloadAttachment(item.storage_uri, item.file_name)}>
                <Text style={styles.actionTxt}>Download</Text>
              </Pressable>
              <Pressable onPress={() => openParent(item)}>
                <Text style={styles.actionTxt}>Open parent</Text>
              </Pressable>
              <Pressable onPress={() => void remove(item)}>
                <Text style={styles.deleteTxt}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingTop: space.md },
  title: { marginHorizontal: space.safe, fontSize: 24, fontFamily: fonts.displayBold, color: colors.onBackground },
  sub: { marginHorizontal: space.safe, marginTop: 4, color: colors.onSecondaryVariant, fontFamily: fonts.body, fontSize: 13 },
  scopeRow: { marginTop: space.sm, marginHorizontal: space.safe, flexDirection: "row", gap: space.sm },
  scopeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  scopeChipOn: { borderColor: colors.primary, backgroundColor: colors.secondaryContainer },
  scopeTxt: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  scopeTxtOn: { color: colors.primary },
  listContent: { padding: space.safe, paddingBottom: 120 },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    padding: space.sm,
    marginBottom: space.sm,
  },
  head: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceContainerHighest },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1 },
  fileName: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.onBackground },
  metaLine: { marginTop: 2, fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.sm, flexWrap: "wrap" },
  actionTxt: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.primary },
  deleteTxt: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.financeExpense },
});
