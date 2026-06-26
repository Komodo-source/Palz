import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Radius, Shadow, Spacing } from '@/constants/theme';

/**
 * Card — a themed surface for grouped content.
 *
 * Props:
 *   - variant   'flat' | 'card' | 'floating' | 'outlined' (default 'card')
 *   - padding   Spacing token key (one/two/three/four) or a raw number
 *   - radius    Radius token key or a raw number
 *   - style     additional style for the inner surface
 *   - onPress   enables Pressable behavior with subtle active feedback
 */
export function Card({
  variant = 'card',
  padding = 'three',
  radius = 'lg',
  style,
  children,
  onPress,
  ...rest
}) {
  const theme = useTheme();
  const pad = typeof padding === 'number' ? padding : (Spacing[padding] ?? Spacing.three);
  const rad = typeof radius === 'number' ? radius : (Radius[radius] ?? Radius.lg);

  // Pick a shadow whose colour tracks the active theme so it stays visible
  // on the dark background (where the static '#000' would disappear).
  const shadow = useMemo(() => {
    const base = SHADOWS[variant] ?? Shadow.card;
    return { ...base, shadowColor: theme.shadowColor ?? base.shadowColor };
  }, [variant, theme.shadowColor]);

  const bg = variant === 'outlined' ? 'transparent' : theme.backgroundElement;
  const borderColor = variant === 'outlined' ? theme.border : 'transparent';

  const baseStyle = {
    backgroundColor: bg,
    borderRadius: rad,
    padding: pad,
    borderColor,
    borderWidth: variant === 'outlined' ? 1 : 0,
    ...shadow,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.base,
          baseStyle,
          { opacity: pressed ? 0.95 : 1 },
          style,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.base, baseStyle, style]} {...rest}>
      {children}
    </View>
  );
}

const SHADOWS = {
  flat: Shadow.none,
  card: Shadow.card,
  floating: Shadow.floating,
  outlined: Shadow.none,
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default Card;
