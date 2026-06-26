import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';

/**
 * Avatar — round image with initials fallback.
 *
 * Props:
 *   - uri    remote image URL (pass null/undefined to use fallback)
 *   - name   used to derive initials fallback ("Léa Martin" → "LM")
 *   - size   numeric size in pt (default 48)
 *   - ring   show subtle ring around avatar
 *   - style  override styles for the outer view
 */
export function Avatar({ uri, name = '', size = 48, ring = false, style, ...rest }) {
  const theme = useTheme();

  const initials = computeInitials(name);
  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundSelected,
          borderWidth: ring ? 2 : 0,
          borderColor: theme.background,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={name ? `Avatar de ${name}` : 'Avatar'}
      {...rest}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          transition={250}
        />
      ) : initials ? (
        <Text style={{ color: theme.accent, fontSize, fontWeight: '800' }}>
          {initials}
        </Text>
      ) : (
        // Empty fallback: a soft pill so the avatar is never blank.
        <View
          style={{
            width: fontSize,
            height: fontSize,
            borderRadius: fontSize / 2,
            backgroundColor: theme.accent,
            opacity: 0.35,
          }}
        />
      )}
    </View>
  );
}

export function computeInitials(name) {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default Avatar;
