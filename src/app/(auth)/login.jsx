import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { useSnackbar } from '@/contexts/snackbar';
import { Radius, Typography } from '@/constants/theme';
import { isValidEmail } from '@/utils/validation';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi } from '@/services/api';
import storage from '@/services/storage';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginScreen() {
  const { login, googleLogin } = useAuth();
  const googleAuth = useGoogleAuth();
  const theme = useTheme();
  const snackbar = useSnackbar();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    storage.getItem('remembered_email').then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

  const emailError =
    emailTouched && email.length > 0 && !isValidEmail(email)
      ? "Format d'email invalide"
      : null;

  const handleLogin = async () => {
    setEmailTouched(true);

    if (!email.trim() || !password.trim()) {
      snackbar.warning('Remplis tous les champs');
      return;
    }

    if (!isValidEmail(email.trim())) {
      snackbar.warning('Adresse email invalide');
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });

      if (rememberMe) {
        await storage.setItem('remembered_email', email.trim());
        await storage.setItem('remembered_credentials', JSON.stringify({ email: email.trim(), password }));
      } else {
        await storage.removeItem('remembered_email');
        await storage.removeItem('remembered_credentials');
      }

      router.replace('/(tabs)/wall');
    } catch (err) {
      const msg = err.response?.data?.error || 'Connexion échouée. Réessaie.';
      snackbar.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const idToken = await googleAuth.signInWithGoogle();
    if (!idToken) return;

    setLoading(true);
    try {
      const res = await authApi.googleAuth(idToken);
      if (!res?.data) throw new Error('Réponse API invalide');
      const { user, token: newToken, isNewUser } = res.data;

      await googleLogin(user, newToken);

      if (isNewUser) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.error('Google auth error:', err);
      const msg = err.response?.data?.error || 'La connexion Google a échoué.';
      snackbar.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.subtitle, { color: theme.textSecondary }, Typography.body]}>
            Heureuse de te revoir ! Connecte-toi pour retrouver tes amis.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            placeholder="ton@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            leftIcon={
              <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
            }
            accessibilityLabel="Adresse email"
          />

          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="Ton mot de passe"
            secureTextEntry
            secureToggle
            leftIcon={
              <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
            }
            accessibilityLabel="Mot de passe"
          />

          {/* Remember me */}
          <Pressable
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberMe }}
            accessibilityLabel="Se souvenir de moi"
          >
            <View
              style={[
                styles.checkbox,
                { borderRadius: 7, borderColor: rememberMe ? theme.accent : theme.border },
                rememberMe && { backgroundColor: theme.accent },
              ]}
            >
              {rememberMe && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={[styles.rememberText, { color: theme.textSecondary }]}>
              Se souvenir de moi
            </Text>
          </Pressable>

          <Button
            label="Se connecter"
            variant="primary"
            size="lg"
            onPress={handleLogin}
            loading={loading}
            icon={<Ionicons name="log-in-outline" size={18} color="#fff" />}
            accessibilityLabel="Se connecter"
            style={{ marginTop: 4 }}
          />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textSecondary }]}>ou</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Google Sign-In (custom-styled to mirror Google branding) */}
          <Pressable
            onPress={handleGoogle}
            disabled={loading || !googleAuth.isReady}
            style={({ pressed }) => [
              styles.googleButton,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderRadius: Radius.lg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continuer avec Google"
          >
            {googleAuth.isLoading ? (
              <ActivityIndicator color={theme.textSecondary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={theme.text} />
                <Text style={[styles.googleButtonText, { color: theme.text }, Typography.bodyLg]}>
                  Continuer avec Google
                </Text>
              </>
            )}
          </Pressable>

          {googleAuth.error ? (
            <Text style={styles.googleError}>{googleAuth.error}</Text>
          ) : null}

          <Pressable
            style={styles.linkContainer}
            onPress={() => router.push('/(auth)/signup')}
            accessibilityRole="link"
            accessibilityLabel="Pas encore de compte ? Créer un compte"
          >
            <Text style={[styles.link, { color: theme.textSecondary }]}>
              Pas encore de compte ?{' '}
              <Text style={{ color: theme.accent, fontWeight: '700' }}>
                Créer un compte
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  form: {
    gap: 14,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  link: {
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  googleButton: {
    height: 52,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  googleButtonText: {
    fontWeight: '600',
  },
  googleError: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
