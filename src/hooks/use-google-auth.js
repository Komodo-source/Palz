import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Ensure any pending browser sessions are closed on mount
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID =
  '639212474409-8q2g4e4hf7jqa88o7i70fq7m7c8rgpli.apps.googleusercontent.com';

// Use a custom scheme redirect URI — works on iOS/Android via ASWebAuthenticationSession
// and Chrome Custom Tabs. The "palz" scheme is configured in app.json.
// ⚠️ Add this URI to Google Cloud Console → APIs & Services → Credentials →
//    Edit Web client ID → Authorized redirect URIs
const REDIRECT_URI = Platform.select({
  web: 'http://localhost:8081/auth/google/callback',
  default: 'palz://oauth2redirect',
});

// Build Google OAuth URL manually
function buildGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'id_token token',
    scope: 'openid profile email',
    nonce: Math.random().toString(36).substring(2, 15),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Parse the redirect URL fragment to extract tokens
function parseRedirectUrl(url) {
  try {
    // The redirect URL might be like:
    // palz://oauth2redirect#id_token=xxx&access_token=yyy&...
    const fragment = url.split('#')[1];
    if (!fragment) return {};

    const params = {};
    fragment.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    return params;
  } catch (e) {
    console.error('Failed to parse redirect URL:', e);
    return {};
  }
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // On web, Google sign-in via WebBrowser isn't supported — show a message
      if (Platform.OS === 'web') {
        Alert.alert(
          'Google Sign-In',
          'Google sign-in is available on the mobile app only. Please sign in with email instead.'
        );
        return null;
      }

      const authUrl = buildGoogleAuthUrl();

      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result?.type === 'success' && result.url) {
        const params = parseRedirectUrl(result.url);

        const idToken = params.id_token;

        if (idToken) {
          return idToken;
        }

        // Check for error response from Google
        if (params.error) {
          const errorDescriptions = {
            access_denied: 'Access was denied. Please try again.',
            invalid_scope: 'The requested permissions are invalid.',
            login_required: 'Please sign in to continue.',
          };
          setError(errorDescriptions[params.error] || `Google sign-in failed: ${params.error}`);
          return null;
        }

        setError('No ID token received from Google');
        return null;
      }

      if (result?.type === 'cancel') {
        // User cancelled — silently return null
        return null;
      }

      if (result?.type === 'error') {
        setError('Google sign-in failed. Please try again.');
        return null;
      }

      return null;
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Failed to connect to Google. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithGoogle,
    isLoading,
    error,
    isReady: true,
  };
}
