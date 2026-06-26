import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Radius, Shadow, Typography } from '@/constants/theme';

// Triggers a short vibration on press for tactile feedback.
// Falls back gracefully if Vibration is unavailable (e.g. some web surfaces).
function tapHaptic() {
  try { Vibration.vibrate(10); } catch (_) {}
}

const SIZES = {
  sm: { height: 36,  px: 14, fontSize: 14, radius: Radius.md, iconSize: 16 },
  md: { height: 48,  px: 18, fontSize: 15, radius: Radius.lg, iconSize: 18 },
  lg: { height: 56,  px: 22, fontSize: 17, radius: Radius.xl, iconSize: 20 },
};

/**
 * Button — the single source of truth for tappable CTAs.
 *
 * Variants:
 *   - primary   rose fill, white text (default brand action)
 *   - secondary neutral fill, dark text
 *   - outline   transparent, bordered
 *   - ghost     transparent, rose text
 *   - danger    error-tinted fill (for destructive flows)
 *
 * Size: sm | md | lg.
 * Loading replaces the label with a spinner; disabled greys everything out.
 * Pass `icon` (left) or `iconRight` for a leading/trailing icon.
 * Pass `haptic={false}` to disable the implicit vibration.
 */
export function Button({
  label,
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  fullWidth = true,
  haptic = true,
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}) {
  const theme = useTheme();
  const s = SIZES[size] ?? SIZES.md;

  const isDisabled = disabled || loading;
  const palette = variantPalette(variant, theme);

  return (
    <Pressable
      onPress={(e) => {
        if (isDisabled) return;
        if (haptic) tapHaptic();
        onPress?.(e);
      }}
      disabled={isDisabled}
      android_ripple={{ color: palette.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: s.radius,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          ...(palette.shadow ?? {}),
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={6}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          {(label || title) ? (
            <Text
              style={[
                styles.text,
                Typography.bodyLg,
                { color: palette.text, fontSize: s.fontSize },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {label ?? title}
            </Text>
          ) : null}
          {iconRight ? <View style={styles.icon}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

function variantPalette(variant, theme) {
  switch (variant) {
    case 'secondary':
      return {
        bg: theme.backgroundSelected,
        text: theme.text,
        border: 'transparent',
        ripple: theme.backgroundSelected,
        shadow: Shadow.none,
      };
    case 'outline':
      return {
        bg: 'transparent',
        text: theme.text,
        border: theme.border,
        ripple: theme.backgroundSelected,
        shadow: Shadow.none,
      };
    case 'ghost':
      return {
        bg: 'transparent',
        text: theme.accent,
        border: 'transparent',
        ripple: theme.backgroundSelected,
        shadow: Shadow.none,
      };
    case 'danger':
      return {
        bg: '#FF6B6B',
        text: '#fff',
        border: 'transparent',
        ripple: 'rgba(255,255,255,0.18)',
        shadow: Shadow.card,
      };
    case 'primary':
    default:
      return {
        bg: theme.accent,
        text: '#fff',
        border: 'transparent',
        ripple: 'rgba(255,255,255,0.18)',
        shadow: Shadow.glow,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default Button;
