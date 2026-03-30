import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

const RECEIPT_MAX_WIDTH = 1600;
const RECEIPT_JPEG_QUALITY = 0.82;

/**
 * Copy a picked image into app storage (native: resize + JPEG compress) or return the picker URI (web).
 * @param {string} sourceUri
 * @returns {Promise<string | null>}
 */
export async function persistExpenseReceiptImage(sourceUri) {
  if (!sourceUri || typeof sourceUri !== "string") return null;
  if (Platform.OS === "web") {
    return sourceUri;
  }
  const base = FileSystem.documentDirectory;
  if (!base) return sourceUri;
  const dir = `${base}expense-receipts/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* exists */
  }
  const dest = `${dir}rc-${Date.now()}.jpg`;
  let fromUri = sourceUri;
  try {
    const out = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: RECEIPT_MAX_WIDTH } }],
      { compress: RECEIPT_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
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
