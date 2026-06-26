import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AuthProvider } from '@/contexts/auth';
import { SnackbarProvider } from '@/contexts/snackbar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PoppinsFonts, applyDefaultFont } from '@/utils/fonts';

// Make Poppins the app-wide default font before any text renders.
applyDefaultFont();
SplashScreen.preventAutoHideAsync().catch(() => {});

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
        case 'premium_expiring':
          router.push('/(tabs)/profil/payement_page');
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
  const [fontsLoaded] = useFonts(PoppinsFonts);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    // react-native-purchases is native-only — skip on web and Expo Go
    if (Platform.OS === 'web') return;
    if (Constants.appOwnership === 'expo') return;

    const apiKey = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_APPLE_API_KEY
      : process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY;

    if (!apiKey) return;

    import('react-native-purchases').then(({ default: Purchases }) => {
      Purchases.configure({ apiKey });
    }).catch(() => {});
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SnackbarProvider>
          <RootNavigator />
        </SnackbarProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
