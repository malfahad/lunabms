import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FormField } from "../../../../components/FormField";
import { ListEmptyState } from "../../../../components/ListEmptyState";
import { PrimaryButton } from "../../../../components/PrimaryButton";
import { ProgressBar } from "../../../../components/ProgressBar";
import { ScreenFab } from "../../../../components/ScreenFab";
import { SimpleModal } from "../../../../components/SimpleModal";
import { useRepos } from "../../../../context/DatabaseContext";
import { colors, fonts, space } from "../../../../theme/tokens";
import { formatMoney } from "@servops/core";

export default function ProjectsScreen() {
  const router = useRouter();
  const repos = useRepos();
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";
  const [rows, setRows] = useState([]);
  const [archivedTab, setArchivedTab] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");

  const refresh = useCallback(() => {
    const base = archivedTab ? repos.projects.listWithStats({ archivedOnly: true }) : repos.projects.listWithStats();
    setRows(
      base.map((p) => ({
        ...p,
        balanceDueNet: repos.finance.projectBalanceDueNet(p.id),
      }))
    );
  }, [repos, archivedTab]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  function save() {
    if (!name.trim()) return;
    const b = budget.trim().replace(/,/g, "");
    repos.projects.insert({
      name: name.trim(),
      budget: b === "" ? null : Number(b),
    });
    setModal(false);
    setName("");
    setBudget("");
    refresh();
  }

  const emptyTitle = archivedTab ? "No archived projects" : "No projects yet";
  const emptyMessage = archivedTab
    ? "Archived projects appear here. Open a project and tap Archive to move it off the active list."
    : "Create a project to track tasks, invoices, and expenses in one place. Budget and progress show up on the card.";

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        <Pressable
          style={[styles.segBtn, !archivedTab && styles.segBtnOn]}
          onPress={() => setArchivedTab(false)}
          accessibilityRole="tab"
          accessibilityState={{ selected: !archivedTab }}
        >
          <Text style={[styles.segTxt, !archivedTab && styles.segTxtOn]}>Active</Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, archivedTab && styles.segBtnOn]}
          onPress={() => setArchivedTab(true)}
          accessibilityRole="tab"
          accessibilityState={{ selected: archivedTab }}
        >
          <Text style={[styles.segTxt, archivedTab && styles.segTxtOn]}>Archived</Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rows.length === 0 ? [styles.list, styles.listEmpty] : styles.list}
        ListEmptyComponent={
          <ListEmptyState
            variant="projects"
            title={emptyTitle}
            message={emptyMessage}
            ctaLabel={archivedTab ? undefined : "New project"}
            onCta={archivedTab ? undefined : () => setModal(true)}
          />
        }
        renderItem={({ item: p, index }) => (
          <Pressable
            onPress={() => router.push(`/(drawer)/(tabs)/projects/${p.id}`)}
            accessibilityRole="button"
            style={styles.rowPress}
          >
            <View
              style={[
                styles.row,
                index % 2 === 1 && styles.rowAlt,
                Number(p.archived) === 1 && styles.rowArchived,
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.name}>{p.name}</Text>
                {p.budget != null ? <Text style={styles.meta}>{formatMoney(p.budget, currencyCode)}</Text> : null}
              </View>
              {Number(p.archived) === 1 ? <Text style={styles.archivedBadge}>Archived</Text> : null}
              {p.taskTotal > 0 ? (
                <>
                  <ProgressBar done={p.taskDone} total={p.taskTotal} />
                  {p.overdueCount > 0 ? (
                    <Text style={styles.overdue}>
                      {p.overdueCount} overdue task{p.overdueCount > 1 ? "s" : ""}
                    </Text>
                  ) : (
                    <Text style={styles.ok}>No overdue tasks</Text>
                  )}
                </>
              ) : (
                <Text style={styles.ok}>No tasks yet — open to add</Text>
              )}
              {p.balanceDueNet > 0.005 ? (
                <Text style={styles.balanceDue}>
                  Balance due (net of deposit) {formatMoney(p.balanceDueNet, currencyCode)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      <ScreenFab label="+ New Project" onPress={() => setModal(true)} accessibilityLabel="New project" />
      <SimpleModal visible={modal} title="New project" onClose={() => setModal(false)}>
        <FormField label="Name *" value={name} onChangeText={setName} placeholder="Project name" />
        <FormField
          label={`Budget (${currencyCode})`}
          value={budget}
          onChangeText={setBudget}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />
        <PrimaryButton title="Save" onPress={save} disabled={!name.trim()} />
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  segment: {
    flexDirection: "row",
    marginHorizontal: space.safe,
    marginTop: space.sm,
    marginBottom: space.sm,
    gap: space.sm,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  segBtnOn: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primary,
  },
  segTxt: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  segTxtOn: { color: colors.primary },
  list: { paddingBottom: 120 },
  listEmpty: { flexGrow: 1 },
  rowPress: { alignSelf: "stretch" },
  row: {
    paddingVertical: space.sm,
    paddingHorizontal: space.safe,
    backgroundColor: colors.surface,
  },
  rowAlt: { backgroundColor: colors.surfaceContainerLow },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  name: { fontSize: 17, fontFamily: fonts.displayBold, color: colors.onBackground, flex: 1 },
  rowArchived: { opacity: 0.92 },
  archivedBadge: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  meta: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  overdue: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.financeWarning,
    marginTop: 6,
  },
  ok: { fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 6 },
  balanceDue: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.financeWarning,
    marginTop: 6,
  },
});
