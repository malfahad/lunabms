import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radius, space } from "../theme/tokens";

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  autoCapitalize,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMulti,
          focused && styles.inputFocused,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSecondaryVariant}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: {
    fontSize: 12,
    fontFamily: fonts.bodySemi,
    color: colors.onSecondaryVariant,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.onBackground,
    backgroundColor: colors.surfaceContainerHighest,
  },
  inputFocused: {
    borderColor: colors.ghostFocus,
  },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
});
