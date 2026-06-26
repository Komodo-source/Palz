import React, { useMemo, useEffect } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = [
  '#C4325E', '#E07A95', '#C4325E', '#A78BFA',
  '#F59E0B', '#FCD34D', '#10B981', '#6EE7B7',
  '#C4325E', '#93C5FD', '#EC4899', '#F9A8D4',
  '#FB923C', '#FDE68A', '#C4325E', '#C4B5FD',
];

function Particle({ cx, cy, tx, ty, color, pw, ph, delay, spin }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1900 + delay * 0.4, easing: Easing.out(Easing.quad) })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const gravity = 650 * p * p;
    const opacity =
      p < 0.08 ? p / 0.08 : p > 0.6 ? Math.max(0, (1 - p) / 0.4) : 1;
    return {
      opacity,
      transform: [
        { translateX: cx + tx * p },
        { translateY: cy + ty * p + gravity },
        { rotate: `${spin * p}deg` },
        { scale: Math.max(0.01, 1 - p * 0.5) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: pw,
          height: ph,
          backgroundColor: color,
          borderRadius: 2,
        },
        animStyle,
      ]}
    />
  );
}

export default function ConfettiCannon({ firing }) {
  const particles = useMemo(() => {
    if (!firing) return [];
    return Array.from({ length: 65 }, (_, i) => ({
      id: i,
      cx: W * 0.1 + Math.random() * W * 0.8,
      cy: H * 0.42,
      tx: (Math.random() - 0.5) * W * 1.6,
      ty: -(Math.random() * 380 + 160),
      color: COLORS[i % COLORS.length],
      pw: 5 + Math.random() * 7,
      ph: 9 + Math.random() * 6,
      delay: Math.floor(Math.random() * 450),
      spin: (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 500),
    }));
  }, [firing]);

  if (!firing) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}
    </View>
  );
}
