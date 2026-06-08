import React, { useState, useEffect } from 'react';
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

import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';
import { isValidEmail } from '@/utils/validation';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi } from '@/services/api';
import storage from '@/services/storage';

const PALETTE = {
  rose: '#FF8FA3',
  roseLight: '#FFB5C2',
  rosePale: '#FFF0F3',
  lavender: '#E8D5F5',
  lavenderPale: '#F8F4FF',
  cream: '#FFF9F5',
  white: '#FFFFFF',
  textDark: '#4A3728',
  textMid: '#7A6B60',
  textLight: '#B0A098',
  border: '#F0E0E0',
};

export default function LoginScreen() {
  const { login, googleLogin } = useAuth();
  const colorScheme = useColorScheme();
  const googleAuth = useGoogleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    storage.getItem('remembered_email').then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Oups', 'Remplis tous les champs');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
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

      router.replace('/(tabs)');
    } catch (err) {
      const msg = err.response?.data?.error || 'Connexion échouée. Réessaie.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>

          <Text style={styles.subtitle}>
            Heureuse de te revoir ! Connecte-toi pour retrouver tes amis.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[
              styles.input,
              email.length > 0 && !isValidEmail(email) && styles.inputError,
            ]}
            placeholder="ton@email.com"
            placeholderTextColor={PALETTE.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          {email.length > 0 && !isValidEmail(email) && (
            <Text style={styles.errorText}>Format d'email invalide</Text>
          )}

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Ton mot de passe"
            placeholderTextColor={PALETTE.textLight}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Remember me */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={12} color={PALETTE.white} />}
            </View>
            <Text style={styles.rememberText}>Se souvenir de moi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in" size={18} color="#fff" />
                <Text style={styles.buttonText}>Se connecter</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={async () => {
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
                Alert.alert('Erreur', msg);
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
                  Continuer avec Google
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
            <Text style={styles.link}>
              Pas encore de compte ?{' '}
              <Text style={styles.linkHighlight}>Créer un compte</Text>
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
    backgroundColor: PALETTE.cream,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: PALETTE.rose,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: PALETTE.textMid,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.textDark,
    marginBottom: -4,
  },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: PALETTE.white,
    color: PALETTE.textDark,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: -6,
    marginLeft: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -2,
    marginBottom: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: PALETTE.roseLight,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: PALETTE.rose,
    borderColor: PALETTE.rose,
  },
  rememberText: {
    fontSize: 14,
    color: PALETTE.textMid,
    fontWeight: '500',
  },
  button: {
    height: 56,
    borderRadius: 18,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    shadowColor: PALETTE.rose,
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
    marginTop: 16,
  },
  link: {
    fontSize: 15,
    color: PALETTE.textMid,
  },
  linkHighlight: {
    color: PALETTE.rose,
    fontWeight: '700',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.border,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.textLight,
  },

  // Google button
  googleButton: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: PALETTE.white,
  },
  googleButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  googleError: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
