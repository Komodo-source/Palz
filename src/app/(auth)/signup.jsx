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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/auth';
import ConfettiCannon from '@/components/ConfettiCannon';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';
import { isValidEmail } from '@/utils/validation';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi, uploadApi, usersApi } from '@/services/api';
let DateTimePicker = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

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

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function SignupScreen() {
  const { signup, googleLogin } = useAuth();
  const colorScheme = useColorScheme();
  const googleAuth = useGoogleAuth();

  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [dateText, setDateText] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confettiFiring, setConfettiFiring] = useState(false);

  const pickProfilePhoto = () => {
    Alert.alert('Photo de profil', 'Choisis la source', [
      {
        text: 'Appareil photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
          });
          if (!result.canceled && result.assets?.[0]) setProfilePhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
          });
          if (!result.canceled && result.assets?.[0]) setProfilePhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const debugHandle = () => {
    router.replace('/onboarding');
  }

  const UpgradeStep = () => {
    if (!email.trim() || !userName.trim() || !fullName.trim()) {
      Alert.alert('Oups', 'Remplis tous les champs');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(userName.trim())) {
      Alert.alert('Pseudo invalide', 'Le pseudo ne peut contenir que des lettres, chiffres et underscores (pas d\'espaces ni de tirets).');
      return;
    }
    if (userName.trim().length < 3) {
      Alert.alert('Pseudo trop court', 'Le pseudo doit faire au moins 3 caractères.');
      return;
    }
    setStep(1);
  };

  const handleSignup = async () => {
    if (!fullName.trim() || !userName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Oups', 'Remplis tous les champs');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Email invalide', 'Veuillez entrer une adresse email valide.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Oups', 'Ce mot de passe est trop court (6 caractères minimum)');
      return;
    }

    setLoading(true);
    try {
      let finalDob = dateOfBirth;
      if (Platform.OS === 'web' && !finalDob && dateText.trim()) {
        const parsed = new Date(dateText.trim());
        if (!isNaN(parsed.getTime())) {
          finalDob = parsed;
        }
      }

      const newToken = await signup({
        full_name: fullName.trim(),
        user_name: userName.trim(),
        email: email.trim(),
        password,
        date_of_birth: finalDob ? formatDate(finalDob) : undefined,
        phone: phone || undefined,
      });

      console.log('[Signup] Token received:', newToken ? `${newToken.substring(0, 20)}...` : 'NULL/UNDEFINED');

      // Upload profile photo after account is created (token passed directly to avoid storage race)
      if (profilePhotoUri) {
        setUploadingPhoto(true);
        try {
          const ext = (profilePhotoUri.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)?.[1] ?? 'jpg').toLowerCase();
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          console.log('[Signup] Uploading photo with token:', newToken ? `${newToken.substring(0, 20)}...` : 'NULL');
          const { url } = await uploadApi.uploadImage({
            uri: profilePhotoUri,
            fileName: `profile.${ext}`,
            mimeType,
            token: newToken,
          });
          // Extract just the filename stored in Supabase
          const filename = url.includes('/') ? url.split('/').pop() : url;
          await usersApi.updateProfile({ profile_image: [filename] });
        } catch (photoErr) {
          console.warn('Profile photo upload failed:', photoErr);
          // Non-fatal — user can add photo from settings
        } finally {
          setUploadingPhoto(false);
        }
      }

      setConfettiFiring(true);
      setTimeout(() => router.replace('/onboarding'), 1200);
    } catch (err) {
      console.log('err', err);
      const msg = err.displayMessage || err.response?.data?.error || 'Inscription échouée. Réessaie.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (!event) return;
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ConfettiCannon firing={confettiFiring} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>Palz</Text>
          </View>
          <Text style={styles.subtitle}>
            Crée ton compte et commence à rencontrer des amis formidables !
          </Text>
        </View>

        {/* Step indicators */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 0 && styles.stepDotActive]} />
          <View style={[styles.stepDot, step === 1 && styles.stepDotActive]} />
        </View>

        {step === 0 ? (
          <View style={styles.form}>
            <Text style={styles.label}>Nom complet *</Text>
            <TextInput
              style={styles.input}
              placeholder="Sabrina Carpenter"
              placeholderTextColor={PALETTE.textLight}
              value={fullName}
              onChangeText={setFullName}
            />
            <TouchableOpacity
              onPress={() => debugHandle()}
            >
              <Text>test</Text>

            </TouchableOpacity>

            <Text style={styles.label}>Pseudo *</Text>
            <TextInput
              style={styles.input}
              placeholder="janedoe"
              placeholderTextColor={PALETTE.textLight}
              autoCapitalize="none"
              autoCorrect={false}
              value={userName}
              onChangeText={setUserName}
            />
            <Text style={styles.hint}>Lettres, chiffres et _ uniquement</Text>

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[
                styles.input,
                email.length > 0 && !isValidEmail(email) && styles.inputError,
              ]}
              placeholder="jane@example.com"
              placeholderTextColor={PALETTE.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            {email.length > 0 && !isValidEmail(email) && (
              <Text style={styles.errorText}>Format d'email invalide</Text>
            )}

            {/* Profile photo picker */}
            <Text style={styles.label}>Photo de profil (optionnel)</Text>
            <TouchableOpacity
              style={styles.photoPicker}
              onPress={pickProfilePhoto}
              activeOpacity={0.8}
            >
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={28} color={PALETTE.rose} />
                  <Text style={styles.photoPlaceholderText}>Ajouter une photo</Text>
                </View>
              )}
              {profilePhotoUri && (
                <View style={styles.photoEditBadge}>
                  <Ionicons name="pencil" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => UpgradeStep()}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Suivant</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Mot de passe *</Text>
            <TextInput
              style={styles.input}
              placeholder="6 caractères minimum"
              placeholderTextColor={PALETTE.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />


            <Text style={styles.label}>Date de naissance</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.input}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={PALETTE.textLight}
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
                  style={styles.input}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: dateOfBirth ? PALETTE.textDark : PALETTE.textLight, fontSize: 16 }}>
                    {dateOfBirth ? formatDate(dateOfBirth) : 'AAAA-MM-JJ'}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={dateOfBirth || new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                    onChange={handleDateChange}
                  />
                )}

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

{/*
            <Text style={styles.label}>Téléphone (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="07 12 34 56 78"
              placeholderTextColor={PALETTE.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
*/}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep(0)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={20} color={PALETTE.textDark} />
                <Text style={styles.backButtonText}>Retour</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { flex: 1, opacity: loading || uploadingPhoto ? 0.7 : 1 }]}
                onPress={handleSignup}
                disabled={loading || uploadingPhoto}
                activeOpacity={0.8}
              >
                {loading || uploadingPhoto ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    {uploadingPhoto && <Text style={[styles.buttonText, { fontSize: 13 }]}>Photo...</Text>}
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Créer mon compte</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-Up */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={async () => {
            const idToken = await googleAuth.signInWithGoogle();
            if (!idToken) return;

            setLoading(true);
            try {
              const res = await authApi.googleAuth(idToken);
              const { user, token: newToken, isNewUser } = res.data;

              await googleLogin(user, newToken);

              if (isNewUser) {
                router.replace('/onboarding');
              } else {
                router.replace('/(tabs)');
              }
            } catch (err) {
              console.error('Google auth error:', err);
              const msg = err.response?.data?.error || 'Inscription Google échouée.';
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
                S'inscrire avec Google
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
          <Text style={styles.link}>
            Déjà un compte ?{' '}
            <Text style={styles.linkHighlight}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
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
    marginBottom: 28,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: {
    fontSize: 30,
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.border,
  },
  stepDotActive: {
    backgroundColor: PALETTE.rose,
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
    justifyContent: 'center',
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
  hint: {
    fontSize: 11,
    marginTop: -6,
    fontStyle: 'italic',
    color: PALETTE.textLight,
    marginLeft: 4,
  },
  dateConfirmButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    height: 56,
    borderRadius: 18,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backButton: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 20,
    backgroundColor: PALETTE.white,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.textDark,
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

  // Photo picker
  photoPicker: {
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  photoPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: PALETTE.rose,
  },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: PALETTE.roseLight,
    borderStyle: 'dashed',
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderText: {
    fontSize: 10,
    color: PALETTE.rose,
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
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
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

  // Google
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
    marginTop: 8,
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
