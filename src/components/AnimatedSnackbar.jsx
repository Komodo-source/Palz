import React, { useEffect, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PALETTE } from '@/constants/theme';

const VARIANTS = {
  success: {
    bg: '#10B981',
    icon: 'checkmark-circle',
    color: '#fff',
  },
  error: {
    bg: '#EF4444',
    icon: 'alert-circle',
    color: '#fff',
  },
  info: {
    bg: '#8B5CF6',
    icon: 'sparkles',
    color: '#fff',
  },
  warning: {
    bg: '#F59E0B',
    icon: 'warning',
    color: '#fff',
  },
  like: {
    bg: '#FF8FA3',
    icon: 'heart',
    color: '#fff',
  },
  default: {
    bg: '#3D332E',
    icon: 'notifications',
    color: '#fff',
  },
};

function AnimatedSnackbar({ message, variant = 'default', duration = 3000, onDismiss }) {
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  const config = VARIANTS[variant] || VARIANTS.default;

  useEffect(() => {
    // Slide in
    translateY.value = withTiming(0, {
      duration: 400,
      easing: Easing.out(Easing.back(1.2)),
    });
    opacity.value = withTiming(1, { duration: 300 });

    // Auto-dismiss
    const timeout = setTimeout(() => {
      translateY.value = withSequence(
        withTiming(-20, { duration: 150 }),
        withTiming(100, { duration: 300 }, (finished) => {
          if (finished && onDismiss) runOnJS(onDismiss)();
        })
      );
      opacity.value = withTiming(0, { duration: 400 });
    }, duration);

    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleDismiss = () => {
    translateY.value = withTiming(100, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished && onDismiss) runOnJS(onDismiss)();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.bg },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handleDismiss}
        activeOpacity={0.85}
      >
        <Ionicons name={config.icon} size={20} color={config.color} />
        <Text style={[styles.message, { color: config.color }]} numberOfLines={2}>
          {message}
        </Text>
        <Ionicons name="close" size={16} color={config.color} style={{ opacity: 0.7 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
});

export default AnimatedSnackbar;
