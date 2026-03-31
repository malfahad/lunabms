const FALLBACK_API_BASE_URL = "http://localhost:8000";

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export function resolveApiBaseUrl() {
  // Prefer explicit project env var name requested by product.
  const apiBaseUrl =
    (typeof process !== "undefined" && process?.env?.API_BASE_URL) ||
    (typeof process !== "undefined" && process?.env?.EXPO_PUBLIC_API_BASE_URL) ||
    "";
  return normalizeBaseUrl(apiBaseUrl) || FALLBACK_API_BASE_URL;
}
