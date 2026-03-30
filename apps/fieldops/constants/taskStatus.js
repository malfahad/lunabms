/** Canonical task workflow statuses (legacy `open` is treated as todo). */
export const TASK_STATUS = {
  todo: "todo",
  doing: "doing",
  done: "done",
};

export const TASK_STATUS_LABELS = {
  [TASK_STATUS.todo]: "To do",
  [TASK_STATUS.doing]: "Doing",
  [TASK_STATUS.done]: "Done",
};

/** @param {string | null | undefined} status */
export function normalizeTaskStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "open") return TASK_STATUS.todo;
  return s;
}

/** @param {string | null | undefined} status */
export function isTaskDoneStatus(status) {
  return normalizeTaskStatus(status) === TASK_STATUS.done;
}
