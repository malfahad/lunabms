import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { FormField } from "../../../components/FormField";
import { ListEmptyState } from "../../../components/ListEmptyState";
import { PostBubble } from "../../../components/PostBubble";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenFab } from "../../../components/ScreenFab";
import { SimpleModal } from "../../../components/SimpleModal";
import { useRepos } from "../../../context/DatabaseContext";
import { sharedStyles } from "../../../theme/styles";
import { colors, fonts, space } from "../../../theme/tokens";

export default function UpdatesScreen() {
  const router = useRouter();
  const repos = useRepos();
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [parentType, setParentType] = useState("project");
  const [parentId, setParentId] = useState(null);
  const [body, setBody] = useState("");
  const [authorWorkerId, setAuthorWorkerId] = useState(null);
  const [opps, setOpps] = useState([]);
  const [projs, setProjs] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [feedScope, setFeedScope] = useState("all");
  const [filterProjectId, setFilterProjectId] = useState(null);
  const [filterOppId, setFilterOppId] = useState(null);

  const projectById = useMemo(() => Object.fromEntries(projs.map((p) => [p.id, p])), [projs]);
  const oppById = useMemo(() => Object.fromEntries(opps.map((o) => [o.id, o])), [opps]);
  const workerById = useMemo(() => Object.fromEntries(workers.map((w) => [w.id, w])), [workers]);

  const loadParents = useCallback(() => {
    setOpps(repos.opportunities.list());
    setProjs(repos.projects.list());
    setWorkers(repos.workers.list());
  }, [repos]);

  const reloadPosts = useCallback(() => {
    let list = [];
    if (feedScope === "all") {
      list = repos.posts.listRecent(120);
    } else if (feedScope === "project" && filterProjectId) {
      list = repos.posts.listByParent("project", filterProjectId);
    } else if (feedScope === "opportunity" && filterOppId) {
      list = repos.posts.listByParent("opportunity", filterOppId);
    }
    const sorted = [...list].sort((a, b) => Number(a.created_at) - Number(b.created_at));
    setRows(sorted);
  }, [repos, feedScope, filterProjectId, filterOppId]);

  const refresh = useCallback(() => {
    loadParents();
    reloadPosts();
  }, [loadParents, reloadPosts]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  useEffect(() => {
    reloadPosts();
  }, [reloadPosts]);

  function openNew() {
    setBody("");
    setParentType("project");
    setParentId(null);
    setAuthorWorkerId(null);
    loadParents();
    setModal(true);
  }

  function save() {
    if (!parentId || !body.trim()) return;
    repos.posts.insert({
      parent_type: parentType,
      parent_id: parentId,
      type: "text",
      body: body.trim(),
      author_id: authorWorkerId,
    });
    setModal(false);
    refresh();
  }

  function parentLabelForPost(p) {
    if (p.parent_type === "project") {
      const name = projectById[p.parent_id]?.name;
      return name ? `Project · ${name}` : "Project";
    }
    const name = oppById[p.parent_id]?.name;
    return name ? `Opportunity · ${name}` : "Opportunity";
  }

  function authorNameForPost(p) {
    if (p.type && String(p.type).startsWith("implicit_")) return "Activity";
    if (!p.author_id) return null;
    const w = workerById[p.author_id];
    return w?.name ?? w?.display_name ?? null;
  }

  function openPostParent(p) {
    const t = String(p.parent_type || "").toLowerCase();
    if (t === "project" && p.parent_id) {
      router.push(`/(drawer)/(tabs)/projects/${p.parent_id}`);
      return;
    }
    if (t === "opportunity" && p.parent_id) {
      router.push(`/(drawer)/(tabs)/pipeline/${p.parent_id}`);
    }
  }

  const parents = parentType === "project" ? projs : opps;

  const emptyForScope =
    feedScope === "project" && !filterProjectId
      ? {
          variant: "updates",
          title: "Choose a project",
          message: "Select a project above to see its update thread, or switch to All to see everything recent.",
          ctaLabel: "All updates",
          onCta: () => {
            setFeedScope("all");
            setFilterProjectId(null);
          },
        }
      : feedScope === "opportunity" && !filterOppId
        ? {
            variant: "updates",
            title: "Choose an opportunity",
            message: "Select an opportunity to see posts linked to that deal, or switch to All.",
            ctaLabel: "All updates",
            onCta: () => {
              setFeedScope("all");
              setFilterOppId(null);
            },
          }
        : {
            variant: "updates",
            title: "No updates yet",
            message:
              "Post updates on a project or opportunity so your team can follow progress in one place.",
            ctaLabel: "New post",
            onCta: openNew,
          };

  return (
    <View style={sharedStyles.screen}>
      <View style={styles.filterBand}>
        <Text style={styles.filterLabel}>Feed</Text>
        <View style={styles.scopeRow}>
          {[
            { key: "all", label: "All" },
            { key: "project", label: "Project" },
            { key: "opportunity", label: "Opportunity" },
          ].map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.scopeChip, feedScope === key && styles.scopeChipOn]}
              onPress={() => {
                setFeedScope(key);
                if (key === "all") {
                  setFilterProjectId(null);
                  setFilterOppId(null);
                }
              }}
            >
              <Text style={[styles.scopeChipTxt, feedScope === key && styles.scopeChipTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {feedScope === "project" ? (
          <>
            <Text style={styles.filterHint}>Which project?</Text>
            <View style={styles.chipWrap}>
              {projs.length === 0 ? (
                <Text style={styles.hintMuted}>No projects yet.</Text>
              ) : (
                projs.map((p) => (
                  <Pressable
                    key={p.id}
                    style={[styles.filterChip, filterProjectId === p.id && styles.filterChipOn]}
                    onPress={() => setFilterProjectId(p.id)}
                  >
                    <Text
                      style={[styles.filterChipTxt, filterProjectId === p.id && styles.filterChipTxtOn]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
        {feedScope === "opportunity" ? (
          <>
            <Text style={styles.filterHint}>Which opportunity?</Text>
            <View style={styles.chipWrap}>
              {opps.length === 0 ? (
                <Text style={styles.hintMuted}>No opportunities yet.</Text>
              ) : (
                opps.map((o) => (
                  <Pressable
                    key={o.id}
                    style={[styles.filterChip, filterOppId === o.id && styles.filterChipOn]}
                    onPress={() => setFilterOppId(o.id)}
                  >
                    <Text
                      style={[styles.filterChipTxt, filterOppId === o.id && styles.filterChipTxtOn]}
                      numberOfLines={1}
                    >
                      {o.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ListEmptyState {...emptyForScope} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostBubble
              post={item}
              authorName={authorNameForPost(item)}
              parentLabel={parentLabelForPost(item)}
              onPressParent={() => openPostParent(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          style={styles.list}
        />
      )}

      <ScreenFab label="+ Post" onPress={openNew} accessibilityLabel="New post" />
      <SimpleModal visible={modal} title="New post" onClose={() => setModal(false)}>
        <Text style={sharedStyles.label}>Link to</Text>
        <View style={sharedStyles.seg}>
          <Pressable
            style={[sharedStyles.segBtn, parentType === "project" && sharedStyles.segBtnOn]}
            onPress={() => {
              setParentType("project");
              setParentId(null);
            }}
          >
            <Text style={[sharedStyles.segTxt, parentType === "project" && sharedStyles.segTxtOn]}>Project</Text>
          </Pressable>
          <Pressable
            style={[sharedStyles.segBtn, parentType === "opportunity" && sharedStyles.segBtnOn]}
            onPress={() => {
              setParentType("opportunity");
              setParentId(null);
            }}
          >
            <Text style={[sharedStyles.segTxt, parentType === "opportunity" && sharedStyles.segTxtOn]}>
              Opportunity
            </Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.label}>Select {parentType}</Text>
        <View style={sharedStyles.chipRow}>
          {parents.length === 0 ? (
            <Text style={styles.hintItalic}>No {parentType}s yet — create one in Pipeline or Projects first.</Text>
          ) : (
            parents.map((x) => (
              <Pressable
                key={x.id}
                style={[sharedStyles.chip, parentId === x.id && sharedStyles.chipActive]}
                onPress={() => setParentId(x.id)}
              >
                <Text
                  style={[sharedStyles.chipText, parentId === x.id && sharedStyles.chipTextActive]}
                  numberOfLines={1}
                >
                  {x.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
        <Text style={sharedStyles.label}>Posted by (optional)</Text>
        <View style={sharedStyles.chipRow}>
          <Pressable
            style={[sharedStyles.chip, authorWorkerId === null && sharedStyles.chipActive]}
            onPress={() => setAuthorWorkerId(null)}
          >
            <Text style={[sharedStyles.chipText, authorWorkerId === null && sharedStyles.chipTextActive]}>
              Unattributed
            </Text>
          </Pressable>
          {workers.map((w) => (
            <Pressable
              key={w.id}
              style={[sharedStyles.chip, authorWorkerId === w.id && sharedStyles.chipActive]}
              onPress={() => setAuthorWorkerId(w.id)}
            >
              <Text
                style={[sharedStyles.chipText, authorWorkerId === w.id && sharedStyles.chipTextActive]}
                numberOfLines={1}
              >
                {w.name ?? w.display_name}
              </Text>
            </Pressable>
          ))}
        </View>
        {workers.length === 0 ? (
          <Text style={styles.hintItalic}>Add team members in the drawer to attribute posts.</Text>
        ) : null}
        <FormField label="Message *" value={body} onChangeText={setBody} placeholder="Update…" multiline />
        <PrimaryButton title="Post" onPress={save} disabled={!parentId || !body.trim()} />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  filterBand: {
    paddingHorizontal: space.safe,
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
  scopeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  scopeChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scopeChipTxt: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  scopeChipTxtOn: { color: colors.onPrimary },
  filterHint: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: 6,
    marginTop: 4,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: 4 },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLowest,
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  filterChipOn: { borderColor: colors.primary, backgroundColor: colors.surfaceContainerHighest },
  filterChipTxt: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.onBackground },
  filterChipTxtOn: { fontFamily: fonts.bodySemi, color: colors.primary },
  hintMuted: { fontSize: 13, fontFamily: fonts.body, color: colors.onSecondaryVariant, fontStyle: "italic" },
  list: { flex: 1 },
  listContent: { paddingTop: space.md, paddingBottom: 120 },
  emptyWrap: { flex: 1 },
  hintItalic: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    fontStyle: "italic",
  },
});
