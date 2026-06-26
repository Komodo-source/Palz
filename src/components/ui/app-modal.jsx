import React, { useEffect } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { Radius, Shadow, Spacing } from '@/constants/theme';

/**
 * AppModal — themed modal with consistent overlay, slide animation,
 * backdrop tap-to-dismiss and hardware back support.
 *
 * Props:
 *   - visible      show/hide
 *   - onClose      required; called when user dismisses
 *   - dismissable  tap on backdrop closes (default true)
 *   - title        optional title rendered on a top bar
 *   - fullScreen   when true, expands to cover most of the screen
 *   - children     body content
 */
export function AppModal({
  visible,
  onClose,
  dismissable = true,
  title,
  fullScreen = false,
  children,
}) {
  const theme = useTheme();

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={dismissable ? onClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          />
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            entering={SlideInDown.duration(280).springify().damping(20)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.surface,
              fullScreen && styles.surfaceFull,
              {
                backgroundColor: theme.backgroundElement,
                borderRadius: fullScreen ? Radius.xl : Radius.xxl,
              },
              Shadow.modal,
            ]}
          >
            {title ? (
              <View
                style={[
                  styles.header,
                  { borderBottomColor: theme.border },
                ]}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 17,
                    fontWeight: '700',
                    textAlign: 'center',
                    paddingVertical: Spacing.three,
                    paddingHorizontal: Spacing.four,
                  }}
                >
                  {title}
                </Text>
              </View>
            ) : null}

            <View style={[styles.body, fullScreen && styles.bodyFull]}>
              {children}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  surface: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  surfaceFull: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  bodyFull: {
    flex: 1,
  },
});

export default AppModal;
