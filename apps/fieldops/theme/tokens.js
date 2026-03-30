/**
 * Digital Curator design tokens — aligned with /designsystem.md
 */

export const colors = {
  primary: "#00333f",
  primaryContainer: "#0e4b5a",
  background: "#f8f9ff",
  surface: "#f8f9ff",
  surfaceContainerLow: "#eff4ff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerHighest: "#d6e3fb",
  surfaceVariant: "#d6e3fb",
  /** Hover / lifted card target */
  surfaceBright: "#f3f6ff",
  secondaryContainer: "#cfe3eb",
  onSecondaryContainer: "#53666c",
  onBackground: "#0f1c2d",
  onSecondaryVariant: "#40484b",
  outlineVariant: "#c0c8cb",
  tertiaryContainer: "#613c13",
  onTertiaryFixed: "#2d1600",
  primaryFixed: "#b6ebfd",
  /** Data viz / progress emphasis */
  dataHighlight: "#b6ebfd",
  scrim: "rgba(15, 28, 45, 0.45)",
  onPrimary: "#ffffff",
  ghostFocus: "rgba(0, 51, 63, 0.4)",
  financePositive: "#0e4b5a",
  financeWarning: "#8a5a12",
  /** Money out — Finance Card (app_design) */
  financeExpense: "#b42323",
  /** Payments / collected line emphasis */
  financePayment: "#0f766e",
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  /** Safe horizontal inset (~2rem feel on phone) */
  safe: 24,
};

export const radius = {
  sm: 2,
  md: 6,
  lg: 12,
  xl: 16,
  full: 9999,
};

/** Post-load font family names (see theme/fonts.js) */
export const fonts = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  displaySemi: "Manrope_600SemiBold",
  displayBold: "Manrope_700Bold",
  displayExtraBold: "Manrope_800ExtraBold",
};

export const shadow = {
  ambient: {
    shadowColor: "#0f1c2d",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 12,
  },
};
