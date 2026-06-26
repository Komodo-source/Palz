import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Spacing, Typography } from '@/constants/theme';

/**
 * EmptyState — full-page friendly placeholder used by every list screen.
 *
 * Props:
 *   - icon          Ionicons name (will be tinted with the accent color)
 *   - iconNode      custom React node used instead of the icon
 *   - title         bold headline (required)
 *   - subtitle      supporting copy
 *   - action        { label, onPress, variant? } — auto-wired Button
 *   - secondaryAction same shape as `action`, rendered below
 *   - compact       reduces padding for in-card use
 */
export function EmptyState({
  icon = 'sparkles-outline',
  iconNode,
  title,
  subtitle,
  action,
  secondaryAction,
  compact = false,
  style,
}) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: theme.backgroundSelected,
            width: compact ? 64 : 96,
            height: compact ? 64 : 96,
            borderRadius: compact ? 32 : 48,
          },
        ]}
      >
        {iconNode ?? (
          <Ionicons
            name={icon}
            size={compact ? 30 : 44}
            color={theme.accent}
          />
        )}
      </View>

      {title ? (
        <Text
          style={[
            styles.title,
            compact ? Typography.h3 : Typography.h2,
            { color: theme.text },
          ]}
        >
          {title}
        </Text>
      ) : null}

      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            Typography.body,
            { color: theme.textSecondary },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}

      {action ? (
        <Button
          label={action.label}
          variant={action.variant ?? 'primary'}
          size="md"
          fullWidth={false}
          onPress={action.onPress}
          icon={action.icon}
          accessibilityLabel={action.label}
        />
      ) : null}

      {secondaryAction ? (
        <Button
          label={secondaryAction.label}
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={secondaryAction.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: 14,
  },
  wrapCompact: {
    paddingVertical: Spacing.three,
    gap: 10,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
  },
});

export default EmptyState;
