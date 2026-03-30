import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

const LOGO_MAX_WIDTH = 1200;
const LOGO_JPEG_QUALITY = 0.9;

/**
 * Copy a selected logo image into app storage on native; keep URI on web.
 * @param {string} sourceUri
 * @returns {Promise<string | null>}
 */
export async function persistBusinessLogoImage(sourceUri) {
  if (!sourceUri || typeof sourceUri !== "string") return null;
  if (Platform.OS === "web") return sourceUri;

  const base = FileSystem.documentDirectory;
  if (!base) return sourceUri;
  const dir = `${base}company-brand/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* exists */
  }

  const dest = `${dir}logo-${Date.now()}.jpg`;
  let fromUri = sourceUri;
  try {
    const out = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: LOGO_MAX_WIDTH } }],
      { compress: LOGO_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    fromUri = out.uri;
  } catch {
    /* fallback: raw copy */
  }
  await FileSystem.copyAsync({ from: fromUri, to: dest });
  if (fromUri !== sourceUri) {
    try {
      await FileSystem.deleteAsync(fromUri, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
  return dest;
}
