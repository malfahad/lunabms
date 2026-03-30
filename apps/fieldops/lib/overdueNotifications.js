import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let handlerSet = false;

function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Shows local notifications for overdue tasks (assigned workers only), at most once per task per worker per calendar day.
 * No-op on web. Remote FCM/APNs requires backend wiring (deferred).
 * @param {*} repos — `createRepos` result
 */
export async function runOverdueTaskLocalNotifications(repos) {
  if (Platform.OS === "web") return;
  ensureHandler();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") return;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("task-overdue", {
      name: "Task reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const since = dayStart.getTime();

  const overdue = repos.tasks.listOverdueWithWorkers();
  for (const row of overdue) {
    const { task, project_name: projectName, workers } = row;
    for (const worker of workers) {
      if (repos.notifications.hasOverdueReminderSince(task.id, worker.id, since)) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Overdue task",
          body: `${task.title || "Task"} — ${projectName || "Project"}`,
          data: { taskId: task.id, workerId: worker.id },
          ...(Platform.OS === "android" ? { android: { channelId: "task-overdue" } } : {}),
        },
        trigger: null,
      });
      repos.notifications.recordOverdueReminder(task.id, worker.id);
    }
  }
}
