import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "../theme/tokens";

/**
 * @param {{ title: string; subtitle?: string; footer?: string }} props
 */
export function PlaceholderScreen({ title, subtitle, footer }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: space.safe,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
    marginBottom: space.sm,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    lineHeight: 22,
  },
  footer: {
    marginTop: space.xl,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
  },
});
