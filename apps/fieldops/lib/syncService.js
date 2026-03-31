import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { getLibrarySnapshot, hydrateLibraryFromPostAttachments, parseMediaIdbKey } from "./webMediaLibrary";
import { resolveApiBaseUrl } from "./apiBaseUrl";

const SYNC_BUSINESS_KEY = "sync_business_name";
const SYNC_BUSINESS_USERNAME_KEY = "sync_business_username";
const SYNC_EMAIL_KEY = "sync_email";
const SYNC_ACCESS_TOKEN_KEY = "sync_access_token";
const SYNC_REFRESH_TOKEN_KEY = "sync_refresh_token";
const SYNC_CURSOR_KEY = "sync_cursor";
const SYNC_TENANT_ID_KEY = "sync_tenant_id";
const SYNC_EMAIL_VERIFIED_KEY = "sync_email_verified";
const SYNC_LICENSE_EXPIRES_AT_KEY = "sync_license_expires_at";
const COMPANY_LOGO_URL_KEY = "company_logo_url";
const COMPANY_LOGO_LOCAL_URL_KEY = "company_logo_local_url";

const DEFAULT_BASE_URL = resolveApiBaseUrl();
const AUTO_INTERVAL_MS = 15000;

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function appSettingGet(repos, key, fallback = "") {
  try {
    const v = repos.appSettings.get(key);
    return v == null || v === "" ? fallback : String(v);
  } catch {
    return fallback;
  }
}

function appSettingSet(repos, key, value) {
  repos.appSettings.set(key, value == null ? "" : String(value));
}

function mimeTypeFromUri(uri) {
  const u = String(uri || "").toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function logoFileNameFromUri(uri) {
  const clean = String(uri || "").split("?")[0];
  const part = clean.split("/").pop() || "logo.jpg";
  if (part.includes(".")) return part;
  return `${part}.jpg`;
}

function stableHash(input) {
  let h = 0;
  const s = String(input || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function readConfig(repos) {
  return {
    baseUrl: DEFAULT_BASE_URL,
    businessName: appSettingGet(repos, SYNC_BUSINESS_KEY, ""),
    businessUsername: appSettingGet(repos, SYNC_BUSINESS_USERNAME_KEY, ""),
    email: appSettingGet(repos, SYNC_EMAIL_KEY, ""),
    accessToken: appSettingGet(repos, SYNC_ACCESS_TOKEN_KEY, ""),
    refreshToken: appSettingGet(repos, SYNC_REFRESH_TOKEN_KEY, ""),
    tenantId: appSettingGet(repos, SYNC_TENANT_ID_KEY, ""),
    emailVerified: appSettingGet(repos, SYNC_EMAIL_VERIFIED_KEY, "") === "1",
    licenseExpiresAt: appSettingGet(repos, SYNC_LICENSE_EXPIRES_AT_KEY, ""),
    cursor: Number(appSettingGet(repos, SYNC_CURSOR_KEY, "0")) || 0,
  };
}

function firstErrorMessage(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const msg = firstErrorMessage(item);
      if (msg) return msg;
    }
    return "";
  }
  if (typeof value === "object") {
    if (typeof value.detail === "string" && value.detail.trim()) return value.detail;
    if (typeof value.error === "string" && value.error.trim()) return value.error;
    if (Array.isArray(value.non_field_errors)) {
      const msg = firstErrorMessage(value.non_field_errors);
      if (msg) return msg;
    }
    for (const key of Object.keys(value)) {
      const msg = firstErrorMessage(value[key]);
      if (msg) return msg;
    }
  }
  return "";
}

async function postJson(url, payload, accessToken) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = firstErrorMessage(body) || `HTTP ${res.status}`;
    const err = new Error(String(detail));
    err.status = res.status;
    err.body = body;
    err.gate = typeof body?.gate === "string" ? body.gate : "";
    err.cta = typeof body?.cta === "string" ? body.cta : "";
    throw err;
  }
  return body;
}

function readLicenseExpiresAtHeader(headers) {
  if (!headers?.get) return "";
  const value =
    headers.get("licenseExpiresAt") ||
    headers.get("x-license-expires-at") ||
    headers.get("X-License-Expires-At") ||
    "";
  return String(value || "").trim();
}

function saveLicenseExpiresAtFromHeaders(repos, headers) {
  const value = readLicenseExpiresAtHeader(headers);
  if (!value) return false;
  appSettingSet(repos, SYNC_LICENSE_EXPIRES_AT_KEY, value);
  return true;
}

export function createSyncService({ repos, inboundApplier, localDatasetArchive = null }) {
  let timer = null;
  const listeners = new Set();
  const state = {
    running: false,
    authenticated: false,
    lastSyncAt: 0,
    lastError: "",
    pending: 0,
    failed: 0,
    profile: {
      baseUrl: DEFAULT_BASE_URL,
      businessName: "",
      businessUsername: "",
      email: "",
      tenantId: "",
      emailVerified: false,
      licenseExpiresAt: "",
    },
  };

  function emit() {
    for (const fn of listeners) {
      try {
        fn({ ...state });
      } catch {
        /* ignore */
      }
    }
  }

  function updateFromSettings() {
    const cfg = readConfig(repos);
    state.profile = {
      baseUrl: cfg.baseUrl,
      businessName: cfg.businessName,
      businessUsername: cfg.businessUsername,
      email: cfg.email,
      tenantId: cfg.tenantId,
      emailVerified: cfg.emailVerified,
      licenseExpiresAt: cfg.licenseExpiresAt,
    };
    state.authenticated = Boolean(cfg.accessToken || cfg.refreshToken);
    state.pending = repos.syncOutbound.countPending();
    state.failed = repos.syncOutbound.countFailed();
  }

  function clearLocalSession() {
    appSettingSet(repos, SYNC_ACCESS_TOKEN_KEY, "");
    appSettingSet(repos, SYNC_REFRESH_TOKEN_KEY, "");
    appSettingSet(repos, SYNC_TENANT_ID_KEY, "");
    appSettingSet(repos, SYNC_BUSINESS_KEY, "");
    appSettingSet(repos, SYNC_BUSINESS_USERNAME_KEY, "");
    appSettingSet(repos, SYNC_EMAIL_KEY, "");
    appSettingSet(repos, SYNC_EMAIL_VERIFIED_KEY, "");
    appSettingSet(repos, SYNC_LICENSE_EXPIRES_AT_KEY, "");
    appSettingSet(repos, SYNC_CURSOR_KEY, "0");
    state.lastSyncAt = 0;
    state.lastError = "";
    updateFromSettings();
    emit();
  }

  function isAuthFailure(error) {
    return Number(error?.status || 0) === 401;
  }

  async function reconcileUploadedLibraryToPostAttachments() {
    if (Platform.OS !== "web") return;
    const snapshot = await getLibrarySnapshot();
    const items =
      snapshot?.items && typeof snapshot.items === "object" ? Object.values(snapshot.items) : [];
    const rows = repos.postAttachments?.listAll?.() || [];
    const byAttachmentId = new Map(rows.map((row) => [String(row?.id || ""), row]));
    const byIdbKey = new Map();
    for (const row of rows) {
      const key = parseMediaIdbKey(row?.storage_uri);
      if (key) byIdbKey.set(key, row);
    }
    for (const it of items) {
      const attachmentId = String(it?.attachmentId || "").trim();
      const remoteUrl = String(it?.remoteUrl || "").trim();
      const idbKey = String(it?.idbKey || "").trim();
      if (!remoteUrl) continue;
      const row = (attachmentId && byAttachmentId.get(attachmentId)) || (idbKey && byIdbKey.get(idbKey)) || null;
      if (!row) continue;
      if (String(row.storage_uri || "").trim() === remoteUrl) continue;
      try {
        const updated = repos.postAttachments.update(
          row.id,
          {
            storage_uri: remoteUrl,
            mime_type: it?.mimeType ?? row.mime_type,
            file_size: it?.fileSize ?? row.file_size,
            file_name: it?.fileName ?? row.file_name,
          },
          { expectedUpdatedAt: row.updated_at }
        );
        if (updated?.id) byAttachmentId.set(String(updated.id), updated);
      } catch {
        // best effort; race with inbound changes can happen.
      }
    }
  }

  async function ensureLogoLocalFromRemote() {
    const remote = appSettingGet(repos, COMPANY_LOGO_URL_KEY, "").trim();
    const local = appSettingGet(repos, COMPANY_LOGO_LOCAL_URL_KEY, "").trim();
    if (!remote) {
      if (local) appSettingSet(repos, COMPANY_LOGO_LOCAL_URL_KEY, "");
      return "";
    }
    if (Platform.OS === "web") {
      if (local !== remote) appSettingSet(repos, COMPANY_LOGO_LOCAL_URL_KEY, remote);
      return remote;
    }
    if (local && local.startsWith("file://")) return local;
    if (!FileSystem.documentDirectory) return remote;
    const ext = (() => {
      const uri = remote.toLowerCase().split("?")[0];
      if (uri.endsWith(".png")) return "png";
      if (uri.endsWith(".webp")) return "webp";
      if (uri.endsWith(".gif")) return "gif";
      return "jpg";
    })();
    const dir = `${FileSystem.documentDirectory}company-brand/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      /* exists */
    }
    const dest = `${dir}logo-sync-${stableHash(remote)}.${ext}`;
    try {
      const out = await FileSystem.downloadAsync(remote, dest);
      if (out?.uri) {
        appSettingSet(repos, COMPANY_LOGO_LOCAL_URL_KEY, out.uri);
        return out.uri;
      }
    } catch {
      /* ignore transient fetch failures */
    }
    return local || "";
  }

  async function refreshAccessTokenIfNeeded() {
    const cfg = readConfig(repos);
    if (cfg.accessToken) return cfg.accessToken;
    if (!cfg.refreshToken) throw new Error("Not authenticated");
    const body = await postJson(`${cfg.baseUrl}/api/auth/token/refresh/`, { refresh: cfg.refreshToken });
    const token = String(body.access || "");
    if (!token) throw new Error("Token refresh failed");
    appSettingSet(repos, SYNC_ACCESS_TOKEN_KEY, token);
    updateFromSettings();
    emit();
    return token;
  }

  async function withAutoRefresh(fn) {
    try {
      return await fn(await refreshAccessTokenIfNeeded());
    } catch (e) {
      if (e?.status === 401) {
        const cfg = readConfig(repos);
        if (!cfg.refreshToken) throw e;
        let nextAccess = "";
        try {
          const refreshed = await postJson(`${cfg.baseUrl}/api/auth/token/refresh/`, { refresh: cfg.refreshToken });
          nextAccess = String(refreshed.access || "");
        } catch (refreshErr) {
          clearLocalSession();
          throw refreshErr;
        }
        if (!nextAccess) {
          clearLocalSession();
          throw e;
        }
        appSettingSet(repos, SYNC_ACCESS_TOKEN_KEY, nextAccess);
        updateFromSettings();
        emit();
        try {
          return await fn(nextAccess);
        } catch (retryErr) {
          if (isAuthFailure(retryErr)) clearLocalSession();
          throw retryErr;
        }
      }
      throw e;
    }
  }

  function setAuthSettings({
    businessName,
    businessUsername,
    email,
    emailVerified = false,
    licenseExpiresAt = "",
    tokens,
    tenantId = "",
  }) {
    appSettingSet(repos, SYNC_BUSINESS_KEY, businessName || businessUsername || "");
    appSettingSet(repos, SYNC_BUSINESS_USERNAME_KEY, businessUsername || "");
    appSettingSet(repos, SYNC_EMAIL_KEY, (email || "").toLowerCase());
    appSettingSet(repos, SYNC_EMAIL_VERIFIED_KEY, emailVerified ? "1" : "0");
    appSettingSet(repos, SYNC_LICENSE_EXPIRES_AT_KEY, licenseExpiresAt || "");
    appSettingSet(repos, SYNC_ACCESS_TOKEN_KEY, tokens?.access || "");
    appSettingSet(repos, SYNC_REFRESH_TOKEN_KEY, tokens?.refresh || "");
    appSettingSet(repos, SYNC_TENANT_ID_KEY, tenantId || "");
  }

  async function register({ businessName, businessUsername, email, password, confirmPassword }) {
    const body = await postJson(`${DEFAULT_BASE_URL}/api/auth/register/`, {
      business_name: businessName,
      business_username: businessUsername,
      email: email.toLowerCase(),
      password,
      confirm_password: confirmPassword,
    });
    return body;
  }

  async function login({ businessUsername, email, password }) {
    const body = await postJson(`${DEFAULT_BASE_URL}/api/auth/login/`, {
      business_username: businessUsername,
      email: email.toLowerCase(),
      password,
    });
    const tenantId = String(body.tenant_id || "").trim();
    let restored = false;
    if (tenantId && localDatasetArchive?.restoreTenantIfArchived) {
      try {
        restored = await localDatasetArchive.restoreTenantIfArchived(tenantId);
      } catch {
        restored = false;
      }
    }
    setAuthSettings({
      businessName: body.business_name || "",
      businessUsername: body.business_username || businessUsername,
      email: body.email || email,
      emailVerified: Boolean(body.email_verified),
      licenseExpiresAt: String(body.license_expires_at || ""),
      tokens: body,
      tenantId,
    });
    if (body?.logo_url) appSettingSet(repos, COMPANY_LOGO_URL_KEY, String(body.logo_url));
    if (!restored) appSettingSet(repos, SYNC_CURSOR_KEY, "0");
    updateFromSettings();
    emit();
    await syncNow();
    return body;
  }

  async function resendVerificationEmail({ businessUsername, email }) {
    return postJson(`${DEFAULT_BASE_URL}/api/auth/verify-email/resend/`, {
      business_username: businessUsername,
      email: email.toLowerCase(),
    });
  }

  async function verifyEmail({ uid, token }) {
    const body = await postJson(`${DEFAULT_BASE_URL}/api/auth/verify-email/`, { uid, token });
    if (body?.access || body?.refresh) {
      const tenantId = String(body.tenant_id || "").trim();
      let restored = false;
      if (tenantId && localDatasetArchive?.restoreTenantIfArchived) {
        try {
          restored = await localDatasetArchive.restoreTenantIfArchived(tenantId);
        } catch {
          restored = false;
        }
      }
      setAuthSettings({
        businessName: body.business_name || "",
        businessUsername: body.business_username || "",
        email: body.email || "",
        emailVerified: Boolean(body.email_verified),
        licenseExpiresAt: String(body.license_expires_at || ""),
        tokens: body,
        tenantId,
      });
      if (body?.logo_url) appSettingSet(repos, COMPANY_LOGO_URL_KEY, String(body.logo_url));
      if (!restored) appSettingSet(repos, SYNC_CURSOR_KEY, "0");
      updateFromSettings();
      emit();
      await syncNow();
    }
    return body;
  }

  async function forgotPassword({ email }) {
    return postJson(`${DEFAULT_BASE_URL}/api/auth/password/forgot/`, {
      email: email.toLowerCase(),
    });
  }

  async function resetPassword({ businessUsername, email, newPassword, confirmNewPassword }) {
    return postJson(`${DEFAULT_BASE_URL}/api/auth/password/reset/`, {
      business_username: businessUsername,
      email: email.toLowerCase(),
      new_password: newPassword,
      confirm_new_password: confirmNewPassword,
    });
  }

  async function logout() {
    const cfg = readConfig(repos);
    try {
      if (cfg.refreshToken) {
        await postJson(`${cfg.baseUrl}/api/auth/logout/`, { refresh: cfg.refreshToken });
      }
    } catch {
      /* backend logout failures should not block local sign-out */
    }
    clearLocalSession();
  }

  async function uploadLogo(logoUri) {
    const cfg = readConfig(repos);
    if (!logoUri || typeof logoUri !== "string") throw new Error("Logo file is required.");
    return withAutoRefresh(async (token) => {
      const form = new FormData();
      if (Platform.OS === "web") {
        const res = await fetch(logoUri);
        if (!res.ok) throw new Error("Unable to read selected logo file.");
        const blob = await res.blob();
        form.append("logo", blob, logoFileNameFromUri(logoUri));
      } else {
        form.append("logo", {
          uri: logoUri,
          name: logoFileNameFromUri(logoUri),
          type: mimeTypeFromUri(logoUri),
        });
      }
      const resp = await fetch(`${cfg.baseUrl}/api/branding/logo/upload/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = firstErrorMessage(body) || `HTTP ${resp.status}`;
        const err = new Error(String(detail));
        err.status = resp.status;
        throw err;
      }
      const remoteUrl = String(body?.logo_url || "").trim();
      if (!remoteUrl) throw new Error("Logo upload succeeded but no logo URL was returned.");
      appSettingSet(repos, COMPANY_LOGO_URL_KEY, remoteUrl);
      await ensureLogoLocalFromRemote();
      return body;
    });
  }

  function rowToPayload(row) {
    return {
      id: row.id,
      op: row.op,
      entity: row.entity,
      entity_id: row.entity_id,
      payload_json: safeJsonParse(row.payload_json, null),
      flags_json: safeJsonParse(row.flags_json, null),
      created_at: Number(row.created_at || 0),
    };
  }

  async function pushPending(token, cfg) {
    const items = repos.syncOutbound.listPending(500);
    if (!items.length) return { pushed: 0 };
    const tenantName = cfg.businessName || cfg.businessUsername;
    const url = `${cfg.baseUrl}/api/sync/push/`;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        business_name: tenantName,
        changes: items.map(rowToPayload),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = firstErrorMessage(body) || `HTTP ${res.status}`;
      const err = new Error(String(detail));
      err.status = res.status;
      err.body = body;
      err.gate = typeof body?.gate === "string" ? body.gate : "";
      err.cta = typeof body?.cta === "string" ? body.cta : "";
      throw err;
    }
    const didUpdateLicense = saveLicenseExpiresAtFromHeaders(repos, res.headers);
    if (didUpdateLicense) updateFromSettings();
    const statusByQueueId = new Map((body?.results || []).map((x) => [x.queue_id, x.status]));
    for (const row of items) {
      const status = statusByQueueId.get(row.id);
      if (status === "applied" || status === "duplicate" || status === "stale") repos.syncOutbound.markDone(row.id);
      else repos.syncOutbound.markFailed(row.id, status || "push_failed");
    }
    return { pushed: items.length };
  }

  async function pullInbound(token, cfg) {
    const tenantName = cfg.businessName || cfg.businessUsername;
    const limit = 500;
    let cursor = cfg.cursor;
    let totalPulled = 0;
    let totalApplied = 0;
    let page = 0;
    const MAX_PAGES_PER_CYCLE = 20;

    while (page < MAX_PAGES_PER_CYCLE) {
      const url = `${cfg.baseUrl}/api/sync/pull/?business_name=${encodeURIComponent(tenantName)}&cursor=${cursor}&limit=${limit}`;
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = firstErrorMessage(body) || `HTTP ${res.status}`;
        const err = new Error(String(detail));
        err.status = res.status;
        throw err;
      }
      const didUpdateLicense = saveLicenseExpiresAtFromHeaders(repos, res.headers);
      if (didUpdateLicense) updateFromSettings();
      const changes = Array.isArray(body?.changes) ? body.changes : [];
      for (const ch of changes) {
        const res = inboundApplier.applyChange({
          op: ch.op,
          entity: ch.entity,
          entity_id: ch.entity_id,
          payload: ch.payload ?? null,
          lww_ts: ch.lww_ts,
        });
        if (res?.applied) totalApplied += 1;
      }
      totalPulled += changes.length;
      const nextCursor = Number(body?.next_cursor ?? cursor);
      if (!Number.isFinite(nextCursor) || nextCursor <= cursor) break;
      cursor = nextCursor;
      appSettingSet(repos, SYNC_CURSOR_KEY, String(cursor));
      page += 1;
      if (changes.length < limit) break;
    }
    if (Platform.OS === "web") {
      try {
        await hydrateLibraryFromPostAttachments(repos.postAttachments?.listAll?.() || []);
      } catch {
        // hydrate is best effort; pull should still succeed.
      }
    }
    await ensureLogoLocalFromRemote();
    return { pulled: totalPulled, applied: totalApplied, cursor };
  }

  async function syncNow() {
    if (state.running) return { skipped: true, reason: "already_running" };
    updateFromSettings();
    const cfg = readConfig(repos);
    if ((!cfg.businessName && !cfg.businessUsername) || (!cfg.accessToken && !cfg.refreshToken)) {
      state.authenticated = false;
      emit();
      return { skipped: true, reason: "not_authenticated" };
    }
    state.running = true;
    state.lastError = "";
    emit();
    try {
      if (Platform.OS === "web") {
        await reconcileUploadedLibraryToPostAttachments();
      }
      const result = await withAutoRefresh(async (token) => {
        const pushStats = await pushPending(token, cfg);
        const pullStats = await pullInbound(token, cfg);
        return { ...pushStats, ...pullStats };
      });
      updateFromSettings();
      state.running = false;
      state.authenticated = true;
      state.lastSyncAt = Date.now();
      emit();
      return result;
    } catch (e) {
      state.running = false;
      state.lastError = e instanceof Error ? e.message : String(e);
      if (isAuthFailure(e)) clearLocalSession();
      updateFromSettings();
      emit();
      throw e;
    }
  }

  function start() {
    if (timer) return;
    updateFromSettings();
    emit();
    timer = setInterval(() => {
      syncNow().catch(() => {
        /* keep retrying */
      });
    }, AUTO_INTERVAL_MS);
    setTimeout(() => {
      syncNow().catch(() => {
        /* ignore */
      });
    }, 1000);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener({ ...state });
    return () => listeners.delete(listener);
  }

  function getState() {
    return { ...state };
  }

  updateFromSettings();

  return {
    start,
    stop,
    syncNow,
    register,
    login,
    resendVerificationEmail,
    verifyEmail,
    forgotPassword,
    resetPassword,
    uploadLogo,
    logout,
    subscribe,
    getState,
    updateFromSettings,
  };
}
