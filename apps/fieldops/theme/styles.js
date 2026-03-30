import { StyleSheet } from "react-native";
import { colors, fonts, radius, space } from "./tokens";

/** Shared patterns used across screens (chips, segments, labels) */
export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickerLabel: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: space.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: space.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginBottom: space.md,
  },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    maxWidth: "100%",
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.onSecondaryContainer,
  },
  chipTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bodySemi,
  },
  seg: {
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.md,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: "center",
  },
  segBtnOn: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  segTxt: {
    fontSize: 14,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
  },
  segTxtOn: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
  },
  hint: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.onSecondaryVariant,
    marginBottom: space.md,
  },
});
