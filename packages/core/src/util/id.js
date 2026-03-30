/**
 * Offline-friendly IDs (UUID v4) without assuming Node-only `crypto` in Metro.
 */
function newId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  try {
    const { randomUUID } = require("crypto");
    return randomUUID();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

module.exports = { newId };
