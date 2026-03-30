import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FormField } from "../../../../components/FormField";
import { PrimaryButton } from "../../../../components/PrimaryButton";
import { ProgressBar } from "../../../../components/ProgressBar";
import { ScreenFab } from "../../../../components/ScreenFab";
import { SimpleModal } from "../../../../components/SimpleModal";
import { LWWConflictError, formatMoney } from "@servops/core";
import {
  TASK_STATUS,
  TASK_STATUS_LABELS,
  isTaskDoneStatus,
  normalizeTaskStatus,
} from "../../../../constants/taskStatus";
import { useRepos } from "../../../../context/DatabaseContext";
import { sharedStyles } from "../../../../theme/styles";
import { colors, fonts, radius, space } from "../../../../theme/tokens";

function isDone(task) {
  return isTaskDoneStatus(task.status);
}

function formatDue(ts) {
  if (ts == null || ts === "") return null;
  try {
    return new Date(Number(ts)).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** Calendar days from today to end (negative = past end). */
function daysRelativeToEnd(endTs) {
  if (endTs == null || endTs === "") return null;
  const end = new Date(Number(endTs));
  const now = new Date();
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((sod(end) - sod(now)) / 86400000);
}

export default function ProjectDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const navigation = useNavigation();
  const repos = useRepos();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [retainer, setRetainer] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [profitRow, setProfitRow] = useState(null);
  const [balanceDueNet, setBalanceDueNet] = useState(0);
  const [taskModal, setTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDays, setTaskDueDays] = useState("");
  const [taskPriority, setTaskPriority] = useState("");
  const [workers, setWorkers] = useState([]);
  const [assignTask, setAssignTask] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  const refresh = useCallback(() => {
    if (!id) return;
    const p = repos.projects.get(id);
    setProject(p ?? null);
    setTasks(p ? repos.tasks.listByProject(id) : []);
    setWorkers(repos.workers.list());
    setRetainer(p?.retainer_id ? repos.retainers.get(p.retainer_id) : null);
    setOpportunity(p?.opportunity_id ? repos.opportunities.get(p.opportunity_id) : null);
    setProfitRow(id ? repos.finance.projectProfit(id) : null);
    setBalanceDueNet(id ? repos.finance.projectBalanceDueNet(id) : 0);
  }, [repos, id]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const isArchived = project != null && Number(project.archived) === 1;
  const currencyCode = repos.appSettings.getSnapshot().currency || "UGX";

  const openEditProject = useCallback(() => {
    if (!project) return;
    setEditName(project.name || "");
    setEditBudget(project.budget != null && project.budget !== "" ? String(project.budget) : "");
    setEditStatus(String(project.status || "active").toLowerCase() === "on_hold" ? "on_hold" : "active");
    setEditModal(true);
  }, [project]);

  const saveProjectEdit = useCallback(() => {
    if (!id || !project || !editName.trim()) return;
    const raw = editBudget.trim().replace(/,/g, "");
    const b = raw === "" ? null : Number(raw);
    try {
      repos.projects.update(
        id,
        {
          name: editName.trim(),
          budget: b,
          status: editStatus,
        },
        { expectedUpdatedAt: project.updated_at }
      );
      setEditModal(false);
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not save", "This project was changed elsewhere. Refreshing.");
        refresh();
        setEditModal(false);
      } else {
        Alert.alert("Could not save", String(e?.message || e));
      }
    }
  }, [id, project, editName, editBudget, editStatus, repos, refresh]);

  const confirmArchiveProject = useCallback(() => {
    if (!id || !project) return;
    Alert.alert("Archive project?", "It moves to Archived. You can restore it later from the project or list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: () => {
          try {
            repos.projects.update(id, { archived: true }, { expectedUpdatedAt: project.updated_at });
            router.back();
          } catch (e) {
            if (e instanceof LWWConflictError) {
              Alert.alert("Could not archive", "Refresh and try again.");
              refresh();
            } else {
              Alert.alert("Could not archive", String(e?.message || e));
            }
          }
        },
      },
    ]);
  }, [id, project, repos, router, refresh]);

  const unarchiveProject = useCallback(() => {
    if (!id || !project) return;
    try {
      repos.projects.update(id, { archived: false }, { expectedUpdatedAt: project.updated_at });
      refresh();
    } catch (e) {
      if (e instanceof LWWConflictError) {
        Alert.alert("Could not restore", "Refresh and try again.");
        refresh();
      } else {
        Alert.alert("Could not restore", String(e?.message || e));
      }
    }
  }, [id, project, repos, refresh]);

  useLayoutEffect(() => {
    if (!project) {
      navigation.setOptions({ title: "Project", headerRight: undefined });
      return;
    }
    navigation.setOptions({
      title: project.name || "Project",
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={openEditProject} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit project">
            <Text style={styles.headerLink}>Edit</Text>
          </Pressable>
          {!isArchived ? (
            <Pressable
              onPress={confirmArchiveProject}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Archive project"
            >
              <Text style={styles.headerLinkMuted}>Archive</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={unarchiveProject}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Restore project"
            >
              <Text style={styles.headerLink}>Restore</Text>
            </Pressable>
          )}
        </View>
      ),
    });
  }, [project, navigation, isArchived, openEditProject, confirmArchiveProject, unarchiveProject]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(isDone).length;
    return { total, done };
  }, [tasks]);

  const sections = useMemo(() => {
    const byDue = (a, b) => (Number(a.due_date) || 0) - (Number(b.due_date) || 0);
    const byUpdated = (a, b) => (Number(b.updated_at) || 0) - (Number(a.updated_at) || 0);
    const norm = (t) => normalizeTaskStatus(t.status);
    const todo = tasks
      .filter((t) => {
        const s = norm(t);
        return s === TASK_STATUS.todo || (s !== TASK_STATUS.doing && s !== TASK_STATUS.done);
      })
      .sort(byDue);
    const doing = tasks.filter((t) => norm(t) === TASK_STATUS.doing).sort(byDue);
    const doneSec = tasks.filter(isDone).sort(byUpdated);
    const out = [];
    if (todo.length) out.push({ title: "To do", data: todo });
    if (doing.length) out.push({ title: "Doing", data: doing });
    if (doneSec.length) out.push({ title: "Done", data: doneSec });
    return out;
  }, [tasks]);

  const assignModalAssignedIds = useMemo(() => {
    if (!assignTask) return new Set();
    return new Set(repos.taskWorkers.listWorkersForTask(assignTask.id).map((w) => w.id));
  }, [repos, assignTask?.id, tasks]);

  function setTaskStatus(task, nextStatus) {
    if (isArchived) return;
    const row = repos.tasks.get(task.id);
    repos.tasks.update(task.id, { status: nextStatus }, { expectedUpdatedAt: row.updated_at });
    refresh();
  }

  const scheduleHint = useMemo(() => {
    if (!project?.end_date) return null;
    const d = daysRelativeToEnd(project.end_date);
    if (d === null) return null;
    if (d === 0) return "Ends today";
    if (d > 0) return `${d} day${d === 1 ? "" : "s"} left (target end)`;
    return `${-d} day${-d === 1 ? "" : "s"} past target end`;
  }, [project?.end_date]);

  function openNewTask() {
    setTaskTitle("");
    setTaskDueDays("");
    setTaskPriority("");
    setTaskModal(true);
  }

  function saveTask() {
    if (!id || !taskTitle.trim() || isArchived) return;
    let due = null;
    const raw = taskDueDays.trim();
    if (raw !== "" && !Number.isNaN(Number(raw))) {
      const days = Number(raw);
      due = Date.now() + days * 86400000;
    }
    repos.tasks.insert({
      project_id: id,
      title: taskTitle.trim(),
      status: TASK_STATUS.todo,
      due_date: due,
      priority: taskPriority.trim() || null,
    });
    setTaskModal(false);
    refresh();
  }

  if (!id) {
    return (
      <View style={sharedStyles.screen}>
        <Text style={styles.muted}>Missing project.</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={sharedStyles.screen}>
        <Text style={styles.muted}>Project not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.shellHeader}>
        <View style={styles.shellRow}>
          <Text style={styles.statusPill}>{project.status || "active"}</Text>
          {project.budget != null ? (
            <Text style={styles.budget}>
              {formatMoney(project.budget, currencyCode)} budget
            </Text>
          ) : null}
        </View>
        {opportunity ? (
          <Text style={styles.shellLine}>Opportunity: {opportunity.name}</Text>
        ) : null}
        {retainer ? (
          <Text style={styles.shellLine}>
            Client deposit {formatMoney(retainer.balance, currencyCode)} available ·{" "}
            {formatMoney(retainer.total_amount, currencyCode)} original
          </Text>
        ) : null}
        <Text style={styles.shellLine}>
          Balance due (net of deposit) {formatMoney(balanceDueNet, currencyCode)}
        </Text>
        {profitRow ? (
          <Text style={[styles.shellLine, profitRow.profit < 0 && styles.profitNeg]}>
            Est. profit {formatMoney(profitRow.profit, currencyCode)} · collected {formatMoney(profitRow.collected, currencyCode)} · spent{" "}
            {formatMoney(profitRow.spent, currencyCode)}
          </Text>
        ) : null}
        {scheduleHint ? <Text style={styles.schedule}>{scheduleHint}</Text> : null}
        {isArchived ? (
          <Text style={styles.archivedBanner}>Archived — restore from the header to edit tasks or add new ones.</Text>
        ) : null}
        {stats.total > 0 ? (
          <ProgressBar done={stats.done} total={stats.total} />
        ) : (
          <Text style={styles.noTasksHeader}>No tasks yet — tap + to add one.</Text>
        )}
      </View>

      {tasks.length === 0 ? (
        <View style={styles.list}>
          <Text style={styles.listEmpty}>No tasks yet. Use + Add task to create work items.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          renderItem={({ item: t }) => {
            const due = formatDue(t.due_date);
            const overdue =
              t.due_date != null && Number(t.due_date) < Date.now() && !isDone(t);
            const assigned = repos.taskWorkers.listWorkersForTask(t.id);
            const cur = normalizeTaskStatus(t.status);
            return (
              <View style={styles.taskCard}>
                <View style={styles.taskTop}>
                  <Text style={styles.taskTitle}>{t.title || "Task"}</Text>
                  {isDone(t) ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/(drawer)/(tabs)/finance",
                          params: {
                            invoiceProjectId: id,
                            invoiceTaskTitle: t.title || "Services",
                          },
                        })
                      }
                      style={styles.invoiceBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Create invoice for completed task"
                    >
                      <Text style={styles.invoiceBtnText}>Invoice</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.statusChips}>
                  {[TASK_STATUS.todo, TASK_STATUS.doing, TASK_STATUS.done].map((st) => (
                    <Pressable
                      key={st}
                      disabled={isArchived}
                      onPress={() => setTaskStatus(t, st)}
                      style={[styles.statusChip, cur === st && styles.statusChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: cur === st }}
                      accessibilityLabel={`Set status ${TASK_STATUS_LABELS[st]}`}
                    >
                      <Text style={[styles.statusChipTxt, cur === st && styles.statusChipTxtOn]}>
                        {TASK_STATUS_LABELS[st]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.taskMetaRow}>
                  {due ? (
                    <Text style={[styles.taskMeta, overdue && styles.taskOverdue]}>Due {due}</Text>
                  ) : null}
                  {t.priority ? <Text style={styles.taskMeta}> · {t.priority}</Text> : null}
                  {isDone(t) ? <Text style={styles.taskDoneLabel}> · Completed</Text> : null}
                </View>
                {!isDone(t) ? (
                  <View style={styles.assignRow}>
                    <Text style={styles.assignText} numberOfLines={3}>
                      {assigned.length
                        ? `Assigned: ${assigned.map((w) => w.name ?? w.display_name).join(", ")}`
                        : "No assignees — add people under Team, then assign for overdue reminders."}
                    </Text>
                    <Pressable
                      onPress={() => !isArchived && setAssignTask(t)}
                      disabled={isArchived}
                      style={[styles.assignBtn, isArchived && styles.assignBtnDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel="Assign or unassign people on this task"
                    >
                      <Text style={styles.assignBtnText}>People</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          style={styles.list}
        />
      )}

      {!isArchived ? (
        <ScreenFab label="+ Add task" onPress={openNewTask} accessibilityLabel="Add task" />
      ) : null}

      <SimpleModal visible={editModal} title="Edit project" onClose={() => setEditModal(false)}>
        <FormField label="Name *" value={editName} onChangeText={setEditName} placeholder="Project name" />
        <FormField
          label={`Budget (${currencyCode})`}
          value={editBudget}
          onChangeText={setEditBudget}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />
        <Text style={styles.pickerLabel}>Status</Text>
        <View style={styles.segRow}>
          <Pressable
            style={[styles.segChip, editStatus === "active" && styles.segChipOn]}
            onPress={() => setEditStatus("active")}
          >
            <Text style={[styles.segChipTxt, editStatus === "active" && styles.segChipTxtOn]}>Active</Text>
          </Pressable>
          <Pressable
            style={[styles.segChip, editStatus === "on_hold" && styles.segChipOn]}
            onPress={() => setEditStatus("on_hold")}
          >
            <Text style={[styles.segChipTxt, editStatus === "on_hold" && styles.segChipTxtOn]}>On hold</Text>
          </Pressable>
        </View>
        <PrimaryButton title="Save" onPress={saveProjectEdit} disabled={!editName.trim()} />
      </SimpleModal>

      <SimpleModal visible={taskModal} title="New task" onClose={() => setTaskModal(false)}>
        <FormField label="Title *" value={taskTitle} onChangeText={setTaskTitle} placeholder="What needs doing?" />
        <FormField
          label="Due in (days)"
          value={taskDueDays}
          onChangeText={setTaskDueDays}
          placeholder="Optional — e.g. 7"
          keyboardType="number-pad"
        />
        <FormField label="Priority" value={taskPriority} onChangeText={setTaskPriority} placeholder="Optional" />
        <PrimaryButton title="Save task" onPress={saveTask} disabled={!taskTitle.trim()} />
      </SimpleModal>

      <SimpleModal visible={!!assignTask} title="People on this task" onClose={() => setAssignTask(null)}>
        {workers.length === 0 ? (
          <Text style={styles.muted}>Add team members in Drawer → Team, then pick people here.</Text>
        ) : (
          <>
            <Text style={styles.assignModalHint}>Tap a name to assign or remove. You can choose several people.</Text>
            {workers.map((w) => {
              const on = assignModalAssignedIds.has(w.id);
              return (
                <Pressable
                  key={w.id}
                  style={[styles.workerChip, on && styles.workerChipOn]}
                  onPress={() => {
                    if (!assignTask || isArchived) return;
                    if (on) repos.taskWorkers.unassign(assignTask.id, w.id);
                    else repos.taskWorkers.assign(assignTask.id, w.id);
                    refresh();
                  }}
                  disabled={isArchived}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={
                    on
                      ? `${w.name ?? w.display_name}, assigned — tap to remove`
                      : `${w.name ?? w.display_name} — tap to assign`
                  }
                >
                  <Text style={[styles.workerChipText, on && styles.workerChipTextOn]}>
                    {on ? "✓ " : ""}
                    {w.name ?? w.display_name}
                  </Text>
                </Pressable>
              );
            })}
            <PrimaryButton title="Done" onPress={() => setAssignTask(null)} />
          </>
        )}
      </SimpleModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14, marginRight: 4 },
  headerLink: { fontSize: 16, fontFamily: fonts.bodySemi, color: colors.primary },
  headerLinkMuted: { fontSize: 16, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  archivedBanner: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  voiceCard: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  voiceTitle: {
    fontSize: 13,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
    marginBottom: 4,
  },
  voiceHint: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginBottom: space.sm,
    lineHeight: 17,
  },
  voiceInput: {
    minHeight: 64,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.onBackground,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
    textAlignVertical: "top",
  },
  voiceBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  voiceBtnText: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  shellHeader: {
    paddingHorizontal: space.safe,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  shellRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  statusPill: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.primary,
    textTransform: "capitalize",
  },
  budget: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.onBackground },
  shellLine: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginTop: 8 },
  schedule: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    color: colors.financeWarning,
    marginTop: 8,
  },
  profitNeg: { color: colors.financeExpense, fontFamily: fonts.bodySemi },
  noTasksHeader: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 8,
  },
  assignRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  assignText: { flex: 1, fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant, lineHeight: 17 },
  assignBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  assignBtnText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.primary },
  assignBtnDisabled: { opacity: 0.45 },
  pickerLabel: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: space.sm,
    marginTop: space.sm,
  },
  segRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md, flexWrap: "wrap" },
  segChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  segChipOn: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primary,
  },
  segChipTxt: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  segChipTxtOn: { color: colors.primary },
  statusChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  statusChipOn: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primary,
  },
  statusChipTxt: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.onSecondaryVariant },
  statusChipTxtOn: { color: colors.primary },
  assignModalHint: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginBottom: space.md,
    lineHeight: 18,
  },
  workerChip: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  workerChipOn: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.primary,
  },
  workerChipText: { fontSize: 15, fontFamily: fonts.bodySemi, color: colors.onBackground },
  workerChipTextOn: { color: colors.primary },
  muted: { fontSize: 14, fontFamily: fonts.body, color: colors.onSecondaryVariant, marginBottom: space.sm, padding: space.safe },
  list: { flex: 1 },
  listContent: { paddingBottom: 120, paddingHorizontal: space.safe },
  sectionHead: {
    backgroundColor: colors.background,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  taskTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  taskTitle: { fontSize: 16, fontFamily: fonts.bodySemi, color: colors.onBackground, flex: 1 },
  invoiceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  invoiceBtnText: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.primary },
  taskMetaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  taskMeta: { fontSize: 12, fontFamily: fonts.body, color: colors.onSecondaryVariant },
  taskOverdue: { color: colors.financeWarning, fontFamily: fonts.bodySemi },
  taskDoneLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.financePositive },
  listEmpty: {
    paddingVertical: space.xl,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    textAlign: "center",
  },
  back: { paddingHorizontal: space.safe },
  backText: { fontSize: 16, fontFamily: fonts.bodySemi, color: colors.primary },
});
