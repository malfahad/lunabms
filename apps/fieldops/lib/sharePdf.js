import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

/**
 * Renders HTML as PDF on iOS/Android (share sheet) or opens print / save-as-PDF on web.
 * @param {string} html Full HTML document
 * @param {string} [fileNameHint] Suggested base name for logs / future use
 */
export async function sharePdfFromHtml(html, fileNameHint = "document") {
  void fileNameHint;
  if (Platform.OS === "web") {
    openPrintWindow(html);
    return;
  }
  try {
    const { uri } = await Print.printToFileAsync({ html });
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Export PDF",
      });
    } else {
      Alert.alert("PDF created", "Sharing is not available on this device.");
    }
  } catch (e) {
    Alert.alert("Could not export PDF", String(e?.message || e));
  }
}

function openPrintWindow(html) {
  const w = globalThis.window?.open("", "_blank");
  if (!w) {
    Alert.alert("Pop-up blocked", "Allow pop-ups to print or save this document as PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 300);
}
