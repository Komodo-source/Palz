import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/contexts/auth';
import { SnackbarProvider } from '@/contexts/snackbar';
import { useColorScheme } from '@/hooks/use-color-scheme';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

function RootNavigator() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const notifListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    // Handle tap on notification (app in background/killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      switch (data.type) {
        case 'message':
          if (data.conversation_id) router.push('/(tabs)/messages');
          break;
        case 'group_message':
        case 'rendezvous':
        case 'group_formed':
          router.push('/(tabs)/groups');
          break;
        case 'event_reminder':
          router.push('/(tabs)/');
          break;
        case 'wall_theme':
          router.push('/(tabs)/wall');
          break;
        default:
          break;
      }
    });

    return () => {
      responseListener.current?.remove();
      notifListener.current?.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={STRIPE_PK}
        merchantIdentifier="merchant.com.palz"
      >
        <AuthProvider>
          <SnackbarProvider>
            <RootNavigator />
          </SnackbarProvider>
        </AuthProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
