import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/auth';
import ConfettiCannon from '@/components/ConfettiCannon';
import { useTheme } from '@/hooks/use-theme';
import { useSnackbar } from '@/contexts/snackbar';
import { Radius, Typography } from '@/constants/theme';
import { isValidEmail } from '@/utils/validation';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi, uploadApi, usersApi } from '@/services/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

let DateTimePicker = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const TOTAL_STEPS = 2;

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ── Password strength scoring ─────────────────────────────────────
function scorePassword(pwd) {
  if (!pwd) return { score: 0, label: 'Vide', tone: '#9A9A9A' };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
  const map = [
    { label: 'Trop court', tone: '#9A9A9A' },
    { label: 'Faible',     tone: '#FF6B6B' },
    { label: 'Correct',    tone: '#F59E0B' },
    { label: 'Bien',       tone: '#10B981' },
    { label: 'Excellent',  tone: '#10B981' },
    { label: 'Excellent',  tone: '#10B981' },
  ];
  return { score, ...map[score] };
}

export default function SignupScreen() {
  const { signup, googleLogin } = useAuth();
  const theme = useTheme();
  const googleAuth = useGoogleAuth();
  const snackbar = useSnackbar();

  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [dateText, setDateText] = useState('');
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confettiFiring, setConfettiFiring] = useState(false);
  const [touched, setTouched] = useState({});

  const pwdStrength = scorePassword(password);

  const errors = {
    fullName: !fullName.trim() && touched.fullName ? 'Indique ton prénom et nom' : null,
    userName: !userName.trim() && touched.userName
      ? 'Choisis un pseudo'
      : userName.trim() && !/^[a-zA-Z0-9_]+$/.test(userName.trim()) && touched.userName
        ? 'Lettres, chiffres et _ uniquement'
        : userName.trim().length > 0 && userName.trim().length < 3 && touched.userName
          ? '3 caractères minimum'
          : null,
    email: !email.trim() && touched.email
      ? 'Indique ton email'
      : email.length > 0 && !isValidEmail(email) && touched.email
        ? "Format d'email invalide"
        : null,
    password: password.length > 0 && password.length < 6 && touched.password
      ? '6 caractères minimum'
      : null,
  };

  const pickProfilePhoto = async (source) => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        snackbar.warning('Autorise l\'accès à l\'appareil photo');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]) setProfilePhotoUri(result.assets[0].uri);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        snackbar.warning('Autorise l\'accès à la galerie');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]) setProfilePhotoUri(result.assets[0].uri);
    }
  };

  const goToStep1 = () => {
    setTouched((t) => ({ ...t, fullName: true, userName: true, email: true }));
    if (!fullName.trim() || !userName.trim() || !email.trim()) {
      snackbar.warning('Remplis les champs obligatoires');
      return;
    }
    if (!isValidEmail(email.trim())) {
      snackbar.warning('Adresse email invalide');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(userName.trim())) {
      snackbar.warning('Pseudo : lettres, chiffres et _ uniquement');
      return;
    }
    if (userName.trim().length < 3) {
      snackbar.warning('Pseudo trop court (3 caractères min)');
      return;
    }
    setStep(1);
  };

  const handleSignup = async () => {
    setTouched((t) => ({ ...t, password: true }));
    if (!fullName.trim() || !userName.trim() || !email.trim() || !password.trim()) {
      snackbar.warning('Remplis tous les champs');
      return;
    }
    if (!isValidEmail(email.trim())) {
      snackbar.warning('Adresse email invalide');
      return;
    }
    if (password.length < 6) {
      snackbar.warning('Mot de passe trop court (6 caractères min)');
      return;
    }

    setLoading(true);
    try {
      let finalDob = dateOfBirth;
      if (Platform.OS === 'web' && !finalDob && dateText.trim()) {
        const parsed = new Date(dateText.trim());
        if (!isNaN(parsed.getTime())) finalDob = parsed;
      }

      const newToken = await signup({
        full_name: fullName.trim(),
        user_name: userName.trim(),
        email: email.trim(),
        password,
        date_of_birth: finalDob ? formatDate(finalDob) : undefined,
      });

      if (profilePhotoUri) {
        setUploadingPhoto(true);
        try {
          const ext = (profilePhotoUri.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)?.[1] ?? 'jpg').toLowerCase();
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const { url } = await uploadApi.uploadImage({
            uri: profilePhotoUri,
            fileName: `profile.${ext}`,
            mimeType,
            token: newToken,
          });
          const filename = url.includes('/') ? url.split('/').pop() : url;
          await usersApi.updateProfile({ profile_image: [filename] });
        } catch (photoErr) {
          console.warn('Profile photo upload failed:', photoErr);
        } finally {
          setUploadingPhoto(false);
        }
      }

      setConfettiFiring(true);
      snackbar.success('Bienvenue chez Copines !');
      setTimeout(() => router.replace('/onboarding'), 600);
    } catch (err) {
      console.log('err', err);
      const msg = err.displayMessage || err.response?.data?.error || 'Inscription échouée. Réessaie.';
      snackbar.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (!event) return;
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) setDateOfBirth(selectedDate);
    else if (event.type === 'dismissed') setShowDatePicker(false);
  };

  const handleGoogle = async () => {
    const idToken = await googleAuth.signInWithGoogle();
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await authApi.googleAuth(idToken);
      const { user, token: newToken, isNewUser } = res.data;
      await googleLogin(user, newToken);
      if (isNewUser) router.replace('/onboarding');
      else router.replace('/(tabs)');
    } catch (err) {
      console.error('Google auth error:', err);
      snackbar.error(err.response?.data?.error || 'Inscription Google échouée.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ConfettiCannon firing={confettiFiring} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: theme.accent }]}>Copines</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }, Typography.body]}>
            Crée ton compte et commence à rencontrer des amis formidables !
          </Text>
        </View>

        {/* Visible progress bar (Étape X / 2) */}
        <ProgressBar step={step} total={TOTAL_STEPS} accent={theme.accent} />

        {step === 0 ? (
          <View style={styles.form}>
            <Input
              label="Nom complet *"
              value={fullName}
              onChangeText={setFullName}
              onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
              placeholder="Sabrina Carpenter"
              autoCapitalize="words"
              error={errors.fullName}
              accessibilityLabel="Nom complet"
            />

            <Input
              label="Pseudo *"
              value={userName}
              onChangeText={setUserName}
              onBlur={() => setTouched((t) => ({ ...t, userName: true }))}
              placeholder="janedoe"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.userName}
              helperText="Lettres, chiffres et _ uniquement"
              accessibilityLabel="Pseudo"
            />

            <Input
              label="Email *"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="jane@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              accessibilityLabel="Email"
            />

            {/* Photo picker — Alert.alert is intentional here (discrete user choice). */}
            <Text style={[styles.label, { color: theme.text }]}>Photo de profil (optionnel)</Text>
            <View style={styles.photoRow}>
              <Pressable
                style={[styles.photoPicker, { borderRadius: 45 }]}
                onPress={() =>
                  Alert.alert('Photo de profil', 'Choisis la source', [
                    { text: 'Appareil photo', onPress: () => pickProfilePhoto('camera') },
                    { text: 'Galerie', onPress: () => pickProfilePhoto('gallery') },
                    { text: 'Annuler', style: 'cancel' },
                  ])
                }
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une photo de profil"
              >
                {profilePhotoUri ? (
                  <Image source={{ uri: profilePhotoUri }} style={[styles.photoPreview, { borderColor: theme.accent }]} />
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: theme.backgroundSelected, borderColor: theme.accentLight }]}>
                    <Ionicons name="camera-outline" size={28} color={theme.accent} />
                    <Text style={[styles.photoPlaceholderText, { color: theme.accent }]}>Ajouter</Text>
                  </View>
                )}
                {profilePhotoUri ? (
                  <View style={[styles.photoEditBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
                    <Ionicons name="pencil" size={12} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Input
              label="Mot de passe *"
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder="6 caractères minimum"
              secureTextEntry
              secureToggle
              error={errors.password}
              accessibilityLabel="Mot de passe"
            />

            {/* Password strength meter */}
            {password.length > 0 ? (
              <View style={styles.strengthWrap} accessibilityLabel={`Force du mot de passe : ${pwdStrength.label}`}>
                <View style={[styles.strengthBarBg, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        backgroundColor: pwdStrength.tone,
                        width: `${Math.max(10, pwdStrength.score * 20)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[Typography.caption, { color: pwdStrength.tone, fontWeight: '700' }]}>
                  {pwdStrength.label}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: theme.text }]}>Date de naissance</Text>
            {Platform.OS === 'web' ? (
              <Input
                value={dateText}
                onChangeText={setDateText}
                onBlur={() => {
                  const parsed = new Date(dateText.trim());
                  if (!isNaN(parsed.getTime())) setDateOfBirth(parsed);
                }}
                placeholder="AAAA-MM-JJ"
              />
            ) : (
              <>
                <Pressable
                  style={[
                    styles.dateTrigger,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                      borderRadius: Radius.lg,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choisir une date de naissance"
                >
                  <Text style={{
                    color: dateOfBirth ? theme.text : theme.textSecondary,
                    fontSize: 16,
                  }}>
                    {dateOfBirth ? formatDate(dateOfBirth) : 'AAAA-MM-JJ'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                </Pressable>

                {showDatePicker && DateTimePicker ? (
                  <DateTimePicker
                    value={dateOfBirth || new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="light"
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                    onChange={handleDateChange}
                  />
                ) : null}

                {showDatePicker && Platform.OS === 'ios' ? (
                  <Button
                    label="Confirmer la date"
                    variant="primary"
                    size="md"
                    onPress={() => setShowDatePicker(false)}
                  />
                ) : null}
              </>
            )}
          </View>
        )}

        {/* Step navigation */}
        <View style={[styles.stepNav, { marginTop: 18 }]}>
          {step === 1 && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => setStep(0)}
              icon={<Ionicons name="chevron-back" size={18} color={theme.text} />}
              accessibilityLabel="Revenir à l&apos;étape précédente"
              fullWidth={false}
            />
          )}

          <Button
            variant="primary"
            size="lg"
            onPress={step === 0 ? goToStep1 : handleSignup}
            loading={loading || uploadingPhoto}
            label={step === 0 ? 'Suivant' : 'Créer mon compte'}
            icon={
              step === 0 ? <Ionicons name="arrow-forward" size={18} color="#fff" />
                       : <Ionicons name="sparkles" size={18} color="#fff" />
            }
          />
        </View>

        {/* Divider */}
        <View style={[styles.dividerRow, { marginTop: 16 }]}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>ou</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        {/* Google */}
        <Pressable
          style={[
            styles.googleButton,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement, borderRadius: Radius.lg },
          ]}
          onPress={handleGoogle}
          disabled={loading || !googleAuth.isReady}
          accessibilityRole="button"
          accessibilityLabel="S'inscrire avec Google"
        >
          {googleAuth.isLoading ? (
            <ActivityIndicator color={theme.textSecondary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={theme.text} />
              <Text style={[styles.googleButtonText, { color: theme.text }, Typography.bodyLg]}>
                S'inscrire avec Google
              </Text>
            </>
          )}
        </Pressable>

        {googleAuth.error ? (
          <Text style={styles.googleError}>{googleAuth.error}</Text>
        ) : null}

        <Pressable
          style={styles.linkContainer}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="link"
          accessibilityLabel="Déjà un compte ? Se connecter"
        >
          <Text style={[styles.link, { color: theme.textSecondary }]}>
            Déjà un compte ?{' '}
            <Text style={{ color: theme.accent, fontWeight: '700' }}>Se connecter</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Small subcomponents kept inline (keeps the file diff scoped) ──

function ProgressBar({ step, total, accent }) {
  const theme = useTheme();
  const pct = Math.round(((step + 1) / total) * 100);
  return (
    <View
      style={[styles.progressWrap, { backgroundColor: theme.border }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Étape ${step + 1} sur ${total}`}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: accent, width: `${pct}%` },
        ]}
      />
      <Text style={[Typography.caption, styles.progressLabel, { color: theme.textSecondary }]}>
        Étape {step + 1} / {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  form: {
    gap: 12,
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  photoPicker: {
    position: 'relative',
  },
  photoPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -2,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  dateTrigger: {
    height: 54,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNav: {
    flexDirection: 'row',
    gap: 10,
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
    marginTop: 8,
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
  progressWrap: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    position: 'absolute',
    right: 0,
    top: 8,
    fontWeight: '700',
  },
});
