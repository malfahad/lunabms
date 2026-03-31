let registered = false;

export async function registerMediaServiceWorker() {
  if (registered) return;
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/media-sync-sw.js", { scope: "/" });
    registered = true;
    window.addEventListener("online", async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg?.active) reg.active.postMessage({ type: "MEDIA_SYNC_TRIGGER" });
        if (reg?.sync?.register) await reg.sync.register("media-sync");
      } catch {
        /* best effort */
      }
    });
  } catch {
    /* service worker is optional */
  }
}
