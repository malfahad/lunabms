const FALLBACK_API_BASE_URL = "http://localhost:8000";

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export function resolveApiBaseUrl() {
  // 1) Build-time env vars (mobile/web local dev and CI builds).
  const envBaseUrl =
    (typeof process !== "undefined" && process?.env?.API_BASE_URL) ||
    (typeof process !== "undefined" && process?.env?.EXPO_PUBLIC_API_BASE_URL) ||
    "";
  const fromEnv = normalizeBaseUrl(envBaseUrl);
  if (fromEnv) return fromEnv;

  // 2) Runtime-injected config for static web hosts (post-build configurable).
  const runtimeBaseUrl =
    (typeof window !== "undefined" && window?.__APP_CONFIG__?.API_BASE_URL) ||
    (typeof window !== "undefined" && window?.API_BASE_URL) ||
    "";
  const fromRuntime = normalizeBaseUrl(runtimeBaseUrl);
  if (fromRuntime) return fromRuntime;

  // 3) Web prod fallback: same-origin API (reverse-proxy setups).
  if (typeof window !== "undefined" && window?.location?.origin) {
    const origin = normalizeBaseUrl(window.location.origin);
    if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) return origin;
  }

  // 4) Local fallback.
  return FALLBACK_API_BASE_URL;
}
