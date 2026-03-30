import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, shadow, space } from "../theme/tokens";

export function FinanceNewMenu({ visible, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <Text style={styles.title}>New</Text>
          {[
            { key: "invoice", label: "Invoice" },
            { key: "expense", label: "Expense" },
            { key: "payment", label: "Payment" },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                onClose();
                onSelect(opt.key);
              }}
            >
              <Text style={styles.rowText}>{opt.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "center",
    padding: space.safe,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    zIndex: 1,
    ...shadow.ambient,
  },
  title: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.onSecondaryVariant,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: space.safe,
    paddingVertical: space.md,
  },
  row: { paddingVertical: 14, paddingHorizontal: space.safe },
  rowPressed: { backgroundColor: colors.surfaceBright },
  rowText: { fontSize: 17, fontFamily: fonts.bodyMedium, color: colors.onBackground },
  cancel: { paddingVertical: 14, alignItems: "center", marginTop: space.xs },
  cancelText: { fontSize: 16, fontFamily: fonts.body, color: colors.onSecondaryVariant },
});
