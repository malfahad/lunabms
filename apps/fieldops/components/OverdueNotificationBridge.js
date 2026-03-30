import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useRepos } from "../context/DatabaseContext";
import { runOverdueTaskLocalNotifications } from "../lib/overdueNotifications";

/** Runs when the app mounts and when returning to foreground (native only). */
export function OverdueNotificationBridge() {
  const repos = useRepos();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    function run() {
      runOverdueTaskLocalNotifications(repos).catch(() => {});
    }
    run();
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        run();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [repos]);

  return null;
}
