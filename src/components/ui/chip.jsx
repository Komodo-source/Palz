import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Radius, Typography } from '@/constants/theme';

/**
 * Chip — small tag-style component for interests, filters, RSVP badges...
 *
 * Props:
 *   - label      string shown inside
 *   - variant    'default' | 'accent' | 'success' | 'warning' | 'outline'
 *   - size       'sm' | 'md'
 *   - selected   stronger background to indicate active filter
 *   - icon       small node to render left of the label
 *   - onPress    makes the chip tappable
 */
export function Chip({
  label,
  variant = 'default',
  size = 'sm',
  selected = false,
  icon,
  onPress,
  style,
  ...rest
}) {
  const theme = useTheme();
  const palette = paletteFor(variant, theme, selected);
  const s = SIZES[size] ?? SIZES.sm;

  const Inner = (
    <View
      style={[
        styles.base,
        {
          paddingHorizontal: s.px,
          paddingVertical: s.py,
          borderRadius: Radius.pill,
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          Typography.caption,
          { color: palette.fg, fontWeight: '700', fontSize: s.fontSize },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return Inner;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...rest}
    >
      {Inner}
    </Pressable>
  );
}

const SIZES = {
  sm: { px: 10, py: 4, fontSize: 12 },
  md: { px: 14, py: 6, fontSize: 13 },
};

function paletteFor(variant, theme, selected) {
  switch (variant) {
    case 'accent':
      return {
        bg: selected ? theme.accent : theme.backgroundSelected,
        fg: selected ? '#fff' : theme.accent,
        border: 'transparent',
      };
    case 'success':
      return {
        bg: selected ? '#10B981' : 'rgba(16,185,129,0.12)',
        fg: selected ? '#fff' : '#10B981',
        border: 'transparent',
      };
    case 'warning':
      return {
        bg: selected ? '#F59E0B' : 'rgba(245,158,11,0.14)',
        fg: selected ? '#fff' : '#B45309',
        border: 'transparent',
      };
    case 'outline':
      return {
        bg: 'transparent',
        fg: theme.text,
        border: theme.border,
      };
    case 'default':
    default:
      return {
        bg: theme.backgroundElement,
        fg: theme.text,
        border: theme.border,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
});

export default Chip;
