import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/use-theme';
import { Radius, Typography } from '@/constants/theme';

/**
 * Input — themed text field with label, icons, error & helper text.
 *
 * Props follow TextInput with a few additions:
 *   - label           caption shown above the field
 *   - leftIcon        node rendered inside the field, on the left
 *   - rightIcon       node rendered inside the field, on the right
 *   - error           string shown below the field; turns border red-ish
 *   - helperText      muted helper shown below the field
 *   - containerStyle  overrides for the outer wrapper
 *   - secureToggle    shows a show/hide icon when secureTextEntry=true
 */
export function Input({
  label,
  leftIcon,
  rightIcon,
  error,
  helperText,
  containerStyle,
  style,
  secureTextEntry,
  secureToggle = false,
  accessibilityLabel,
  ...rest
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  const hasError = !!error;

  const borderColor = hasError
    ? '#FF6B6B'
    : focused
      ? theme.accent
      : theme.border;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: theme.text }, Typography.caption]}>
          {label}
        </Text>
      ) : null}

      {/*
        NOTE: the field's shadow/elevation is intentionally static. Toggling
        shadow or elevation on focus recreates the native view on the New
        Architecture (Fabric), which remounts the child TextInput and drops
        focus — producing a rapid focus/blur loop where the keyboard never
        stays open. Focus feedback is conveyed via borderColor only (a plain
        prop update that does NOT recreate the view).
      */}
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            borderColor,
            borderRadius: Radius.lg,
          },
        ]}
      >
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}

        <TextInput
          {...rest}
          secureTextEntry={secureToggle ? !reveal : secureTextEntry}
          placeholderTextColor={theme.textSecondary}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={accessibilityLabel ?? label}
          // NOTE: explicit `height: '100%'` is critical — without it, the TextInput's
          // tap target collapses to its intrinsic text height (~22px / ~32px Android),
          // which is much smaller than the 52px field. Tapping the top/bottom of the
          // visual field then misses the input entirely and focus never takes.
          style={[
            styles.input,
            Typography.body,
            { color: theme.text },
            style,
          ]}
        />

        {secureToggle ? (
          <Pressable
            onPress={() => setReveal((r) => !r)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <Ionicons
              name={reveal ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : rightIcon ? (
          <View style={styles.iconRight}>{rightIcon}</View>
        ) : null}
      </View>

      {(hasError || helperText) ? (
        <Text
          style={[
            styles.helper,
            Typography.caption,
            { color: hasError ? '#FF6B6B' : theme.textSecondary },
          ]}
        >
          {hasError ? error : helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
    gap: 8,
  },
  iconLeft: {
    marginRight: 2,
  },
  iconRight: {
    marginLeft: 2,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    // Android-only: removes the built-in font padding so the text sits
    // centered inside the 52px field instead of being vertically offset.
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : null),
  },
  helper: {
    marginLeft: 4,
    marginTop: 2,
  },
});

export default Input;
