import { useEffect, useRef, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInRight,
  SlideInLeft,
  ZoomIn,
  LightSpeedInRight,
  BounceIn,
  StretchInX,
  FlipInXUp,
  withSpring,
} from 'react-native-reanimated';

/**
 * Pre-configured Reanimated entering/exiting animations for consistent use across screens.
 *
 * Usage:
 *   <Animated.View entering={Animations.fadeIn.delay(100)}>
 *     ...
 *   </Animated.View>
 */
export const Animations = {
  fadeIn: FadeIn.duration(400).easing(Easing.out(Easing.ease)),
  fadeInDown: FadeInDown.duration(400).springify().damping(14),
  fadeInUp: FadeInUp.duration(400).springify().damping(14),
  slideInRight: SlideInRight.duration(350).springify().damping(16),
  slideInLeft: SlideInLeft.duration(350).springify().damping(16),
  zoomIn: ZoomIn.duration(350).springify().damping(12),
  bounceIn: BounceIn.duration(500),
  lightSpeed: LightSpeedInRight.duration(400),
  stretch: StretchInX.duration(350).springify().damping(15),
  flip: FlipInXUp.duration(400).springify().damping(14),
};

/**
 * Hook that provides a staggered animation function.
 * Useful for lists of items where each item should animate in sequentially.
 *
 * @param {number} staggerDelay - Delay in ms between each item (default: 80)
 * @returns {function(index: number): { entering: AnimatedEntry }}
 *
 * Usage:
 *   const stagger = useStagger(100);
 *   {items.map((item, i) => (
 *     <Animated.View entering={stagger(i)} key={item.id}>
 *       ...
 *     </Animated.View>
 *   ))}
 */
export function useStagger(staggerDelay = 80) {
  return useCallback(
    (index) => ({
      entering: Animations.fadeInDown.delay(index * staggerDelay),
    }),
    [staggerDelay]
  );
}

/**
 * Hook for adding a shimmer/skeleton-like pulse animation to a view.
 * Returns an animated style object.
 */
export function useShimmer() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.sin) })
    );
    const interval = setInterval(() => {
      opacity.value = withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.sin) })
      );
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
}

/**
 * Hook for a subtle scale-bounce animation on a value change.
 * Useful for like buttons, reaction buttons, etc.
 *
 * @param {any} trigger - When this value changes, the bounce triggers.
 * @returns {animatedStyle: AnimatedStyle}
 *
 * Usage:
 *   const { animatedStyle } = useBounceOnChange(reactionCount);
 *   <Animated.View style={animatedStyle}>...</Animated.View>
 */
export function useBounceOnChange(trigger) {
  const scale = useSharedValue(1);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (prevTrigger.current !== trigger) {
      prevTrigger.current = trigger;
      scale.value = withSequence(
        withTiming(1.3, { duration: 120 }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.5)) })
      );
    }
  }, [trigger]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

export default Animations;
