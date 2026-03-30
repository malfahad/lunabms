import { StyleSheet, Text, View } from "react-native";
import { EmptyIllustration } from "./illustrations/EmptyIllustrations";
import { PrimaryButton } from "./PrimaryButton";
import { colors, fonts, space } from "../theme/tokens";

/** Empty list: illustration, title, message, optional primary CTA. */
export function ListEmptyState({ variant = "generic", title, message, ctaLabel, onCta }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.art}>
        <EmptyIllustration variant={variant} width={200} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {ctaLabel && onCta ? (
        <View style={styles.cta}>
          <PrimaryButton title={ctaLabel} onPress={onCta} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    minHeight: 320,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.safe,
    paddingVertical: space.xl,
    paddingBottom: space.xxl,
  },
  art: { marginBottom: space.lg },
  title: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
    color: colors.onBackground,
    textAlign: "center",
    marginBottom: space.sm,
  },
  message: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  cta: { width: "100%", maxWidth: 280, marginTop: space.lg },
});
