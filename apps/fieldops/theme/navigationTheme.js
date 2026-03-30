import { DefaultTheme } from "@react-navigation/native";
import { colors } from "./tokens";

/** React Navigation surfaces — no harsh divider colors */
export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surfaceContainerLow,
    text: colors.onBackground,
    border: colors.surfaceContainerLow,
    notification: colors.primaryContainer,
  },
};
