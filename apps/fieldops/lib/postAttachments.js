import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as Linking from "expo-linking";
import {
  MEDIA_STATUS_LOCAL,
  deleteMediaObject,
  getMediaObject,
  makeMediaIdbKey,
  parseMediaIdbKey,
  putMediaObject,
  removeLibraryItem,
  triggerMediaSyncWorker,
  upsertLibraryItem,
} from "./webMediaLibrary";

const ATTACH_DIR = `${FileSystem.documentDirectory || ""}post-attachments/`;
export const MAX_ATTACH_BATCH_BYTES = 100 * 1024 * 1024;
export const MAX_ATTACH_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;

function normalizeName(name, fallback = "attachment") {
  const clean = String(name || fallback).trim().replace(/[^\w.\- ]+/g, "_");
  return clean || fallback;
}

function extFromName(name) {
  const n = String(name || "");
  const i = n.lastIndexOf(".");
  if (i <= 0) return "";
  return n.slice(i + 1).toLowerCase();
}

function classifyAttachment(mimeType, name) {
  const mime = String(mimeType || "").toLowerCase();
  const ext = extFromName(name);
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (mime.startsWith("video/") || ["mp4", "mov", "m4v", "webm", "avi"].includes(ext)) return "video";
  return "document";
}

function uniqId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveSize(uri, explicitSize) {
  if (Number.isFinite(explicitSize) && explicitSize >= 0) return Number(explicitSize);
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return Number(info?.size || 0);
  } catch {
    return 0;
  }
}

function formatPicked(items) {
  return items.map((a) => ({
    uri: a.uri,
    fileName: normalizeName(a.fileName || a.name || `attachment-${uniqId()}`),
    mimeType: String(a.mimeType || ""),
    fileSize: Number(a.fileSize || a.size || 0),
    attachmentType: classifyAttachment(a.mimeType, a.fileName || a.name),
  }));
}

export async function pickMediaAttachments() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: 0,
  });
  if (res.canceled) return [];
  return formatPicked(Array.isArray(res.assets) ? res.assets : []).filter((row) => row.attachmentType !== "document");
}

export async function pickDocumentAttachments() {
  const res = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: "*/*",
  });
  if (res.canceled) return [];
  return formatPicked(Array.isArray(res.assets) ? res.assets : []);
}

export async function saveAttachmentToStorage(draft, options = {}) {
  if (Platform.OS === "web") {
    const resp = await fetch(draft.uri);
    if (!resp.ok) throw new Error("Unable to read selected file.");
    const blob = await resp.blob();
    const idbKey = makeMediaIdbKey();
    await putMediaObject(idbKey, blob);
    const mimeType = String(draft.mimeType || blob.type || "");
    const fileSize = Number(blob.size || draft.fileSize || 0);
    const attachmentType = draft.attachmentType || classifyAttachment(mimeType, draft.fileName);
    await upsertLibraryItem({
      idbKey,
      attachmentId: String(options.attachmentId || ""),
      storageUri: `idb://media/${idbKey}`,
      fileName: normalizeName(draft.fileName),
      mimeType,
      fileSize,
      attachmentType,
      status: MEDIA_STATUS_LOCAL,
      uploadUrl: String(options.uploadUrl || "").trim(),
      accessToken: String(options.accessToken || "").trim(),
      createdAt: Date.now(),
    });
    await triggerMediaSyncWorker();
    return {
      storageUri: `idb://media/${idbKey}`,
      fileName: normalizeName(draft.fileName),
      mimeType,
      fileSize,
      attachmentType,
    };
  }
  if (!FileSystem.documentDirectory) throw new Error("Attachment storage is unavailable.");
  await FileSystem.makeDirectoryAsync(ATTACH_DIR, { intermediates: true });
  const ext = extFromName(draft.fileName);
  const outName = `${uniqId()}-${normalizeName(draft.fileName, "attachment")}`;
  const outPath = `${ATTACH_DIR}${ext ? outName : `${outName}`}`;
  await FileSystem.copyAsync({ from: draft.uri, to: outPath });
  const size = await resolveSize(outPath, draft.fileSize);
  return {
    storageUri: outPath,
    fileName: normalizeName(draft.fileName),
    mimeType: String(draft.mimeType || ""),
    fileSize: size,
    attachmentType: draft.attachmentType || classifyAttachment(draft.mimeType, draft.fileName),
  };
}

export async function computeDraftBytes(drafts) {
  let sum = 0;
  for (const d of drafts) {
    sum += await resolveSize(d.uri, d.fileSize);
  }
  return sum;
}

export async function openAttachment(uri) {
  const target = String(uri || "");
  if (!target) return;
  const mediaKey = parseMediaIdbKey(target);
  if (mediaKey) {
    const blob = await getMediaObject(mediaKey);
    if (!blob) throw new Error("Attachment not found in local library.");
    if (typeof URL === "undefined") throw new Error("Preview is not available.");
    const objectUrl = URL.createObjectURL(blob);
    if (typeof window !== "undefined" && window.open) window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }
  try {
    await Linking.openURL(target);
  } catch {
    // best effort
  }
}

export async function downloadAttachment(uri, fileName = "attachment") {
  const target = String(uri || "");
  if (!target) return;
  const mediaKey = parseMediaIdbKey(target);
  if (mediaKey) {
    const blob = await getMediaObject(mediaKey);
    if (!blob) throw new Error("Attachment not found in local library.");
    if (typeof URL === "undefined") throw new Error("Download is not available.");
    const objectUrl = URL.createObjectURL(blob);
    if (typeof document !== "undefined") {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      a.rel = "noopener";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5_000);
    return;
  }
  if (Platform.OS !== "web") {
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(target, { dialogTitle: fileName });
        return;
      }
    } catch {
      // fallback to openURL
    }
  }
  await openAttachment(target);
}

export async function deleteAttachmentFile(uri) {
  const target = String(uri || "");
  if (!target) return;
  const mediaKey = parseMediaIdbKey(target);
  if (mediaKey) {
    await deleteMediaObject(mediaKey);
    await removeLibraryItem(mediaKey);
    return;
  }
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    // best effort
  }
}

export function describeAttachmentSize(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
