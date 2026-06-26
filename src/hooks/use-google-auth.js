import { useState } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

// Use your actual Client IDs here
const GOOGLE_CLIENT_ID = '639212474409-8q2g4e4hf7jqa88o7i70fq7m7c8rgpli.apps.googleusercontent.com';
const IOS_CLIENT_ID = '639212474409-dot90ob53out5l72i6fncon8mhods19q.apps.googleusercontent.com';

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Let Expo handle the PKCE flow / custom app schemes.
  const [request, , promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });



  const signInWithGoogle = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Notice', 'Google sign-in is available on the mobile app only.');
      return null;
    }

    if (!request) return null;

    setIsLoading(true);
    setError(null);

    try {
      const result = await promptAsync();

      if (result?.type === 'success') {
        const idToken =
          result.authentication?.idToken ?? result.params?.id_token ?? null;
        if (!idToken) {
          setError('Aucun jeton reçu de Google.');
          return null;
        }
        return idToken;
      }

      if (result?.type === 'error') {
        setError(result.error?.message || 'La connexion Google a échoué.');
      }
      // 'dismiss' / 'cancel' → silently return null
      return null;
    } catch (err) {
      setError(err?.message || 'La connexion Google a échoué.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { signInWithGoogle, isLoading, error, isReady: !!request };
}
