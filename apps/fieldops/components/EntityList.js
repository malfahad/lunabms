import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ListEmptyState } from "./ListEmptyState";
import { colors, fonts, space } from "../theme/tokens";

export function EntityList({
  data,
  empty,
  emptyLabel,
  renderRow,
  keyField = "id",
  ListHeaderComponent,
  onRowPress,
}) {
  const ListEmptyComponent =
    empty != null ? (
      <ListEmptyState {...empty} />
    ) : (
      <ListEmptyState
        variant="generic"
        title={emptyLabel?.trim() ? emptyLabel : "Nothing here yet"}
        message={
          emptyLabel?.trim()
            ? "Use the primary action (usually +) to add your first entry."
            : "Add an item to get started."
        }
      />
    );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item[keyField])}
      renderItem={({ item, index }) => {
        const inner = (
          <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
            <Text style={styles.rowText}>{renderRow(item)}</Text>
          </View>
        );
        if (onRowPress) {
          return (
            <Pressable style={styles.rowPress} onPress={() => onRowPress(item)} accessibilityRole="button">
              {inner}
            </Pressable>
          );
        }
        return inner;
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={data.length === 0 ? [styles.list, styles.listEmpty] : styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  listEmpty: { flexGrow: 1 },
  rowPress: { alignSelf: "stretch" },
  row: {
    paddingVertical: space.sm,
    paddingHorizontal: space.safe,
    backgroundColor: colors.surface,
  },
  rowAlt: {
    backgroundColor: colors.surfaceContainerLow,
  },
  rowText: { fontSize: 15, fontFamily: fonts.body, color: colors.onBackground },
});
