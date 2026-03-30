import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

function mimeTypeFromUri(uri) {
  const u = String(uri || "").toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read image blob"));
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Resolve any selected image URI into an embeddable data URI for PDF HTML.
 * @param {string | null | undefined} uri
 * @returns {Promise<string | null>}
 */
export async function loadImageAsDataUri(uri) {
  const src = String(uri || "").trim();
  if (!src) return null;
  if (src.startsWith("data:image/")) return src;

  if (Platform.OS !== "web" && src.startsWith("file://")) {
    try {
      const b64 = await FileSystem.readAsStringAsync(src, { encoding: FileSystem.EncodingType.Base64 });
      if (!b64) return null;
      return `data:${mimeTypeFromUri(src)};base64,${b64}`;
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUri = await blobToDataUri(blob);
    return dataUri || null;
  } catch {
    return null;
  }
}
