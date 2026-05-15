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
// DateTimePicker is native-only — lazy-require to avoid web bundle errors
let DateTimePicker = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import SHA256 from 'crypto-js/sha256';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';
import { isValidEmail } from '@/utils/validation';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi } from '@/services/api';

// Format date as YYYY-MM-DD
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function SignupScreen() {
  const { signup, googleLogin } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const googleAuth = useGoogleAuth();

  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [Prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(null); // Date object or null
  const [dateText, setDateText] = useState(''); // Raw text for web input
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const UpgradeStep = () => {
    if (!Prenom.trim() || !email.trim() || !userName.trim() || !fullName.trim()) {
      Alert.alert('Oopsie', 'Remplissez tous les champs');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }
    setStep(1);
  };

  const handleSignup = async () => {
    if (!fullName.trim() || !userName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Oopsie', 'Remplissez tous les champs');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Aïe', 'Ce mot de passe est trop court');
      return;
    }

    setLoading(true);
    try {
      // On web, parse raw date text if not yet parsed (no blur event)
      let finalDob = dateOfBirth;
      if (Platform.OS === 'web' && !finalDob && dateText.trim()) {
        const parsed = new Date(dateText.trim());
        if (!isNaN(parsed.getTime())) {
          finalDob = parsed;
        }
      }

      // Hash password with SHA-256 before sending
      const hashedPassword = SHA256(password).toString();

      await signup({
        surname: fullName.trim(),
        firstname: Prenom.trim(),
        user_name: userName.trim(),
        email: email.trim(),
        password: hashedPassword,
        date_of_birth: finalDob ? formatDate(finalDob) : undefined,
        phone: phone || undefined,
      });

      // First registration → go to personality questionnaire
      router.replace('/onboarding');
    } catch (err) {
      console.log('err', err);
      const msg = err.response?.data?.error || 'Signup failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    // On Android, the picker closes automatically after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setDateOfBirth(selectedDate);
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
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
            Créez votre compte et faites-vous de nouveaux amis !
          </Text>
        </View>

        {/* Step indicators */}
        <View style={styles.stepIndicator}>
          {[0, 1].map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                {
                  backgroundColor: step === s ? '#FF6B8A' : colors.backgroundSelected,
                },
              ]}
            />
          ))}
        </View>

        {step === 0 ? (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Nom *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundElement,
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                },
              ]}
              placeholder="Carpenter"
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={[styles.label, { color: colors.text }]}>Prénom *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundElement,
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                },
              ]}
              placeholder="Sabrina"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              value={Prenom}
              onChangeText={setPrenom}
            />

            <Text style={[styles.label, { color: colors.text }]}>Pseudo *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundElement,
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                },
              ]}
              placeholder="janedoe"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              value={userName}
              onChangeText={setUserName}
            />

            <Text style={[styles.label, { color: colors.text }]}>Email *</Text>
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
              placeholder="jane@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            {email.length > 0 && !isValidEmail(email) && (
              <Text style={styles.errorText}>Format d'email invalide</Text>
            )}

            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => UpgradeStep()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Mot de Passe *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundElement,
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                },
              ]}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Hashé avec SHA-256 avant envoi
            </Text>

            <Text style={[styles.label, { color: colors.text }]}>Date de Naissance</Text>
            {Platform.OS === 'web' ? (
              /* Web fallback: plain text input, parsed only on submit */
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundElement,
                    color: colors.text,
                    borderColor: colors.backgroundSelected,
                  },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                value={dateText}
                onChangeText={setDateText}
                onBlur={() => {
                  const parsed = new Date(dateText.trim());
                  if (!isNaN(parsed.getTime())) {
                    setDateOfBirth(parsed);
                  }
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.dateButton,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: colors.backgroundSelected,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: dateOfBirth ? colors.text : colors.textSecondary,
                      fontSize: 16,
                    }}
                  >
                    {dateOfBirth ? formatDate(dateOfBirth) : 'YYYY-MM-DD'}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={dateOfBirth || new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                    onChange={handleDateChange}
                  />
                )}

                {/* iOS: close button for inline picker */}
                {showDatePicker && Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.dateConfirmButton}
                    onPress={() => setShowDatePicker(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dateConfirmText}>Confirmer</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <Text style={[styles.label, { color: colors.text }]}>Numéro de Téléphone (optionel)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundElement,
                  color: colors.text,
                  borderColor: colors.backgroundSelected,
                },
              ]}
              placeholder="07 12 34 56 78"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.backButton, { borderColor: colors.backgroundSelected }]}
                onPress={() => setStep(0)}
                activeOpacity={0.8}
              >
                <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { flex: 1, opacity: loading ? 0.7 : 1 }]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.backgroundSelected }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.backgroundSelected }]} />
        </View>

        {/* Google Sign-Up */}
        <TouchableOpacity
          style={[styles.googleButton, { borderColor: colors.backgroundSelected }]}
          onPress={async () => {              const idToken = await googleAuth.signInWithGoogle();
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
                const msg = err.response?.data?.error || 'Google sign-up failed. Please try again.';
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
                Sign up with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {googleAuth.error && (
          <Text style={styles.googleError}>{googleAuth.error}</Text>
        )}

        <TouchableOpacity
          style={styles.linkContainer}
          onPress={() => router.back()}
        >
          <Text style={[styles.link, { color: colors.textSecondary }]}>
            Already have an account?{' '}
            <Text style={{ color: '#FF6B8A', fontWeight: '700' }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
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
    paddingVertical: Spacing.four,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  stepDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
  hint: {
    fontSize: 11,
    marginTop: -Spacing.one,
    fontStyle: 'italic',
  },
  dateButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dateConfirmButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF6B8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  nextButton: {
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
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  backButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: Spacing.four,
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
