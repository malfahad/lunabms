/**
 * Environment tier for dev / stage / prod builds.
 * Use EXPO_PUBLIC_* so values are inlined in Expo (web + native).
 * For plain Node scripts, falls back to process.env.APP_ENV or "development".
 */
const RAW =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_APP_ENV) ||
  (typeof process !== "undefined" && process.env && process.env.APP_ENV) ||
  "development";

/**
 * @returns {'development' | 'staging' | 'production'}
 */
function getAppEnv() {
  if (RAW === "staging" || RAW === "production" || RAW === "development") {
    return RAW;
  }
  return "development";
}

const ENV_KEYS = Object.freeze({
  analyticsEnabled: "EXPO_PUBLIC_ANALYTICS_ENABLED",
  sentryDsn: "EXPO_PUBLIC_SENTRY_DSN",
});

module.exports = { getAppEnv, ENV_KEYS };
