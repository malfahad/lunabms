import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme/tokens";

export function ProgressBar({ done, total }) {
  const t = Math.max(total, 1);
  const pct = Math.min(100, Math.round((done / t) * 100));
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.caption}>
        {done}/{total} tasks
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.dataHighlight,
  },
  caption: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginTop: 4,
  },
});
