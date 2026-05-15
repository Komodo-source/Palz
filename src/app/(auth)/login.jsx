import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import SHA256 from 'crypto-js/sha256';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';
import { isValidEmail } from '@/utils/validation';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi } from '@/services/api';

export default function LoginScreen() {
  const { login, googleLogin } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const googleAuth = useGoogleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Oopsie', 'Remplissez tous les champs');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }

    setLoading(true);
    try {
      // Hash password with SHA-256 before sending (must match signup flow)
      const hashedPassword = SHA256(password).toString();

      await login({ email: email.trim(), password: hashedPassword });
      router.replace('/(tabs)');
    } catch (err) {
      console.log(err)
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.logo, { color: colors.text }]}>Palz</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Welcome back! Sign in to continue.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              email.length > 0 && !isValidEmail(email) && styles.inputError,
              {
                backgroundColor: colors.backgroundElement,
                color: colors.text,
                borderColor: email.length > 0 && !isValidEmail(email)
                  ? '#FF4444'
                  : colors.backgroundSelected,
              },
            ]}
            placeholder="Enter your email"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          {email.length > 0 && !isValidEmail(email) && (
            <Text style={styles.errorText}>Invalid email format</Text>
          )}

          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.backgroundElement,
                color: colors.text,
                borderColor: colors.backgroundSelected,
              },
            ]}
            placeholder="Enter your password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.backgroundSelected }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.backgroundSelected }]} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.googleButton, { borderColor: colors.backgroundSelected }]}
            onPress={async () => {
              const idToken = await googleAuth.signInWithGoogle();
              if (!idToken) return;

              setLoading(true);
              try {
                const res = await authApi.googleAuth(idToken);
                const { user, token: newToken, isNewUser } = res.data;

                // Update auth context state
                await googleLogin(user, newToken);

                if (isNewUser) {
                  router.replace('/onboarding');
                } else {
                  router.replace('/(tabs)');
                }
              } catch (err) {
                console.error('Google auth error:', err);
                const msg = err.response?.data?.error || 'Google sign-in failed. Please try again.';
                Alert.alert('Error', msg);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || !googleAuth.isReady}
            activeOpacity={0.8}
          >
            {googleAuth.isLoading ? (
              <ActivityIndicator color="#666" />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color="#666" />
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {googleAuth.error && (
            <Text style={styles.googleError}>{googleAuth.error}</Text>
          )}

          <TouchableOpacity
            style={styles.linkContainer}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={[styles.link, { color: colors.textSecondary }]}>
              Don't have an account?{' '}
              <Text style={{ color: '#FF6B8A', fontWeight: '700' }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.six,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    marginTop: Spacing.one,
  },
  form: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: -Spacing.one,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: -Spacing.one,
  },
  button: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FF6B8A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  link: {
    fontSize: 14,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Google button
  googleButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  googleButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  googleError: {
    color: '#FF4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
