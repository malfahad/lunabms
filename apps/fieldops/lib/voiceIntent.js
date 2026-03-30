/**
 * Simulated voice-to-intent: proposes marking a task done when the transcript
 * contains completion intent and matches an open task title (human confirms in UI).
 * @param {string} text
 * @param {Array<{ id: string, title?: string, status?: string }>} openTasks
 * @returns {{ ok: true, taskId: string, taskTitle: string } | { ok: false, reason: string }}
 */
export function proposeTaskCompletionFromText(text, openTasks) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  const intent = /\b(done|complete|finished|mark\s*(it\s*)?done)\b/i;
  if (!intent.test(raw)) return { ok: false, reason: "no_intent" };
  const lower = raw.toLowerCase();
  for (const task of openTasks) {
    const title = (task.title || "").trim().toLowerCase();
    if (title.length < 2) continue;
    if (lower.includes(title)) {
      return { ok: true, taskId: task.id, taskTitle: task.title || "Task" };
    }
  }
  return { ok: false, reason: "no_match" };
}
