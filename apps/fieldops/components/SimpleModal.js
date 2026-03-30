import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, space } from "../theme/tokens";

export function SimpleModal({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
    paddingBottom: space.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.safe,
    paddingVertical: space.md,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
    flex: 1,
  },
  close: {
    fontSize: 20,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    padding: space.xs,
  },
  body: { padding: space.safe, paddingBottom: space.xxl },
});
