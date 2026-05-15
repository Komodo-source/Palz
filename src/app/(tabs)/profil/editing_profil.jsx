import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { usersApi, uploadApi, getUploadBaseUrl } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 16) / 3; 

// ── Helpers ──
const extractFilename = (url) => {
  if (!url) return '';
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    return parts[parts.length - 1];
  }
  return url;
};

const getFullUploadUrl = (storedUrl) => {
  const base = getUploadBaseUrl().replace('/api', '');
  if (storedUrl.startsWith('http')) return storedUrl;
  if (storedUrl.startsWith('/uploads/')) return `${base}${storedUrl}`;
  return `${base}/uploads/${storedUrl}`;
};

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
  cardBg: '#FFFFFF',
  success: '#98D8AA',
  error: '#FF6B6B',
  shadow: '#FFB5C2',
};

const SITUATION_OPTIONS = [
  { label: 'En couple', value: 'couple' },
  { label: 'Célibataire', value: 'celibataire' },
  { label: 'En recherche', value: 'recherche' },
  { label: 'Divorcé(e)', value: 'divorce' },
  { label: "C'est compliqué", value: 'complique' },
];

export default function ProfileEditingScreen() {
  const { user, refreshUser } = useAuth();

  // ── Form state ──
  const [bio, setBio] = useState(user?.bio || '');
  const [work, setWork] = useState(user?.work || '');
  const [situation, setSituation] = useState(user?.situation || '');
  const [showSituationPicker, setShowSituationPicker] = useState(false);

  // ── Photos ──
  const [photos, setPhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // ── Location ──
  const [userLocation, setUserLocation] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // ── Audio / Fun Fact ──
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [voiceFunFactChanged, setVoiceFunFactChanged] = useState(false);

  // expo-audio hooks — recorder and player managed by component lifecycle
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(recordedAudioUri || null);
  const playerStatus = useAudioPlayerStatus(player);

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false);
  const saveOpacity = useRef(new Animated.Value(0)).current;

  // ── Init ──
  useEffect(() => {
    initializePhotos();
    checkExistingAudio();
  }, []);

  // ── Sync isPlayingAudio with player status ──
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setIsPlayingAudio(false);
    }
  }, [playerStatus.didJustFinish]);

  // ── Auto-stop recording: detect when native recorder stops ──
  useEffect(() => {
    if (isRecording && !recordingState.isRecording) {
      stopRecording();
    }
  }, [recordingState.isRecording, isRecording]);

  const initializePhotos = () => {
    if (user?.profile_image && Array.isArray(user.profile_image) && user.profile_image.length > 0) {
      const existingPhotos = user.profile_image.map((url, index) => ({
        id: `existing_${index}`,
        uri: getFullUploadUrl(url),
        isExisting: true,
      }));
      setPhotos(existingPhotos);
    }
  };

  const checkExistingAudio = () => {
    if (user?.voice_fun_fact) {
      setRecordedAudioUri(getFullUploadUrl(user.voice_fun_fact));
    }
  };

  // ── Photo picking ──
  const pickImage = async () => {
    if (photos.length >= 4) {
      Alert.alert('Maximum atteint', 'Tu peux ajouter jusqu\'à 4 photos sur ton profil.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Accorde l\'accès à tes photos pour personnaliser ton profil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      uploadPhoto(uri);
    }
  };

  const uploadPhoto = async (uri) => {
    setIsUploadingPhoto(true);
    try {
      const ext = uri.split('.').pop() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const { url } = await uploadApi.uploadImage({
        uri,
        fileName: `photo.${ext}`,
        mimeType,
      });

      setPhotos((prev) => [...prev, {
        id: `new_${Date.now()}`,
        uri,
        uploadedUrl: url,
        isExisting: false,
      }]);
    } catch (err) {
      console.error('Photo upload error:', err);
      Alert.alert('Oups', 'Impossible d\'uploader la photo. Réessaie !');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = (photoId) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // ── Location ──
  const getCurrentLocation = useCallback(async () => {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Active la localisation pour partager ta ville.');
        setIsFetchingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      // Reverse geocode to get city name
      const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode) {
        const city = geocode.city || geocode.region || '';
        Alert.alert('Localisation mise à jour !', city ? `Tu es à ${city}` : 'Position enregistrée.');
      }
    } catch (err) {
      console.error('Location error:', err);
      Alert.alert('Oups', 'Impossible de récupérer ta position.');
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  // ── Audio Recording ──
  const startRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Active le micro pour enregistrer ta fun fact vocale.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record({ forDuration: 30 });

      setIsRecording(true);
    } catch (err) {
      console.error('Recording start error:', err);
      Alert.alert('Oups', "Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
      });

      const uri = recorder.uri;
      setRecordedAudioUri(uri);

      // Auto-upload after recording
      if (uri) uploadAudio(uri);
    } catch (err) {
      console.error('Recording stop error:', err);
      setIsRecording(false);
    }
  };

  const uploadAudio = async (uri) => {
    setIsUploadingAudio(true);
    try {
      const { url } = await uploadApi.uploadAudio({
        uri,
        fileName: 'fun_fact.m4a',
        mimeType: 'audio/m4a',
      });
      setRecordedAudioUri(url);
      setVoiceFunFactChanged(true);
    } catch (err) {
      console.error('Audio upload error:', err);
      Alert.alert('Oups', "L'enregistrement est sauvegardé mais n'a pas pu être uploadé.");
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const playAudio = () => {
    if (playerStatus.playing) {
      player.pause();
      setIsPlayingAudio(false);
    } else if (recordedAudioUri) {
      player.play();
      setIsPlayingAudio(true);
    }
  };

  const deleteAudio = () => {
    if (playerStatus.playing) {
      player.pause();
    }
    setRecordedAudioUri(null);
    setVoiceFunFactChanged(true);
    setIsPlayingAudio(false);
  };

  // ── Save ──
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData = {};

      if (bio !== user?.bio) updateData.bio = bio;
      if (work !== user?.work) updateData.work = work;
      if (situation !== user?.situation) updateData.situation = situation;

      // Build profile_image array: all stored as just the filename
      const newPhotoUrls = photos
        .filter((p) => !p.isExisting && p.uploadedUrl)
        .map((p) => extractFilename(p.uploadedUrl));
      const existingPhotoUrls = photos
        .filter((p) => p.isExisting)
        .map((p) => extractFilename(p.uri));

      const allPhotos = [...existingPhotoUrls, ...newPhotoUrls];
      if (JSON.stringify(allPhotos) !== JSON.stringify(user?.profile_image || [])) {
        updateData.profile_image = allPhotos;
      }

      // Voice fun fact — only include when changed
      if (voiceFunFactChanged) {
        updateData.voice_fun_fact = recordedAudioUri
          ? extractFilename(recordedAudioUri)
          : null;
      }

      // Location
      if (userLocation) {
        updateData.latitude = String(userLocation.latitude);
        updateData.longitude = String(userLocation.longitude);
      }

      if (Object.keys(updateData).length === 0) {
        Alert.alert('Info', 'Aucune modification à sauvegarder.');
        router.back();
        return;
      }

      await usersApi.updateProfile(updateData);
      await refreshUser();

      // Success animation
      Animated.timing(saveOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Oups 🥺', 'Erreur lors de la sauvegarde. Réessaie !');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const secsRem = secs % 60;
    return `${mins}:${secsRem.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={PALETTE.rose} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.subtitle}>
          Personnalise ton univers
        </Text>

        {/* ── Photos Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Mes photos</Text>
            <Text style={styles.photoCount}>{photos.length}/4</Text>
          </View>

          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => removePhoto(photo.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={12} color={PALETTE.white} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 4 && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={pickImage}
                disabled={isUploadingPhoto}
                activeOpacity={0.7}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator color={PALETTE.rose} size="small" />
                ) : (
                  <>
                    <Ionicons name="add" size={22} color={PALETTE.rose} />
                    <Text style={styles.addPhotoLabel}>Ajouter</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Bio Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>À propos de moi</Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Parle un peu de toi, de tes passions, de ce que tu cherches..."
            placeholderTextColor={PALETTE.textLight}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>

        {/* ── Work Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Mon métier</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ex: Designer, Étudiante, Ingénieure..."
            placeholderTextColor={PALETTE.textLight}
            value={work}
            onChangeText={setWork}
            maxLength={100}
          />
        </View>

        {/* ── Situation Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Ma situation</Text>
          </View>

          <TouchableOpacity
            style={styles.situationSelector}
            onPress={() => setShowSituationPicker(!showSituationPicker)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.situationText,
              !situation && styles.placeholderText,
            ]}>
              {situation
                ? SITUATION_OPTIONS.find((o) => o.value === situation)?.label || situation
                : 'Choisis ta situation...'}
            </Text>
            <Ionicons
              name={showSituationPicker ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={PALETTE.rose}
            />
          </TouchableOpacity>

          {showSituationPicker && (
            <View style={styles.situationDropdown}>
              {SITUATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.situationOption,
                    situation === option.value && styles.situationOptionSelected,
                  ]}
                  onPress={() => {
                    setSituation(option.value);
                    setShowSituationPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.situationOptionText,
                    situation === option.value && styles.situationOptionTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Location Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Ma localisation</Text>
          </View>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={getCurrentLocation}
            disabled={isFetchingLocation}
            activeOpacity={0.7}
          >
            {isFetchingLocation ? (
              <ActivityIndicator color={PALETTE.white} size="small" />
            ) : (
              <>
                <Ionicons name="location" size={18} color={PALETTE.white} />
                <Text style={styles.locationButtonText}>
                  {userLocation ? 'Position mise à jour !' : 'Mettre à jour ma position'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {userLocation && (
            <Text style={styles.locationDetail}>
              Lat: {userLocation.latitude.toFixed(4)} · Lon: {userLocation.longitude.toFixed(4)}
            </Text>
          )}
        </View>

        {/* ── Audio Fun Fact (Premium) ── */}
        <View style={[styles.card, styles.premiumCard]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mic-outline" size={20} color="#7B61A8" />
            <Text style={styles.sectionTitle}>Fun fact vocale</Text>
            {!user?.is_premium && (
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={10} color="#7B61A8" style={{ marginRight: 3 }} />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionHint}>
            Enregistre une petite anecdote amusante de 30 secondes max !
          </Text>

          {!user?.is_premium ? (
            <View style={styles.premiumLock}>
              <Ionicons name="lock-closed" size={24} color={PALETTE.textMid} />
              <Text style={styles.premiumLockText}>
                Passe en Premium pour débloquer les fun facts vocales
              </Text>
            </View>
          ) : (
            <View style={styles.audioSection}>
              {recordedAudioUri ? (
                <View style={styles.audioPlayer}>
                  <TouchableOpacity
                    style={[styles.playButton, isPlayingAudio && styles.playButtonActive]}
                    onPress={playAudio}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isPlayingAudio ? 'pause' : 'play'}
                      size={18}
                      color={isPlayingAudio ? '#7B61A8' : PALETTE.white}
                    />
                  </TouchableOpacity>
                  <View style={styles.audioInfo}>
                    <Text style={styles.audioLabel}>
                      {isPlayingAudio ? 'En écoute...' : 'Ta fun fact'}
                    </Text>
                    <View style={styles.audioWave}>
                      {[...Array(20)].map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.waveBar,
                            { height: Math.random() * 16 + 4 },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteAudioBtn}
                    onPress={deleteAudio}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={PALETTE.rose} />
                  </TouchableOpacity>
                </View>
              ) : isRecording ? (
                <View style={styles.recordingContainer}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                  </View>
                  <Text style={styles.recordingText}>
                    Enregistrement... {formatDuration(Math.floor(recordingState.durationMillis / 1000))}
                  </Text>
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={stopRecording}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="stop" size={14} color={PALETTE.white} />
                    <Text style={styles.stopButtonText}> Stop</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={startRecording}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mic" size={24} color={PALETTE.white} />
                  <Text style={styles.recordButtonText}>Appuyer pour enregistrer</Text>
                </TouchableOpacity>
              )}
              {isUploadingAudio && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color={PALETTE.rose} size="small" />
                  <Text style={styles.uploadingText}>Upload de l'audio...</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Save Button ── */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={PALETTE.white} size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={17} color={PALETTE.white} />
              <Text style={styles.saveButtonText}> Sauvegarder</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Prends ton temps pour créer un beau profil
        </Text>

        {/* ── Success overlay ── */}
        <Animated.View style={[styles.successOverlay, { opacity: saveOpacity }]}>
          <Ionicons name="flower-outline" size={64} color={PALETTE.rose} />
          <Text style={styles.successText}>Profil mis à jour !</Text>
        </Animated.View>
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
    paddingBottom: 60,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
    backgroundColor: PALETTE.white,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.rosePale,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.textDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    color: PALETTE.textMid,
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  // ── Cards ──
  card: {
    backgroundColor: PALETTE.white,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 22,
    padding: 20,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  premiumCard: {
    borderWidth: 1.5,
    borderColor: PALETTE.lavender,
    backgroundColor: PALETTE.lavenderPale,
  },

  // ── Section Headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.textDark,
    flex: 1,
  },
  sectionHint: {
    fontSize: 13,
    color: PALETTE.textMid,
    marginBottom: 12,
    lineHeight: 18,
  },
  photoCount: {
    fontSize: 13,
    color: PALETTE.textLight,
    fontWeight: '600',
  },

  // ── Inputs ──
  input: {
    backgroundColor: PALETTE.rosePale,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: PALETTE.textDark,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  textArea: {
    backgroundColor: PALETTE.rosePale,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: PALETTE.textDark,
    minHeight: 110,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: PALETTE.textLight,
    marginTop: 6,
    marginRight: 4,
  },

  // ── Photos ──
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
    borderRadius: 14,
    backgroundColor: PALETTE.rosePale,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },

  addPhotoBtn: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PALETTE.roseLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.rosePale,
    gap: 4,
  },
  addPhotoLabel: {
    fontSize: 11,
    color: PALETTE.rose,
    fontWeight: '600',
  },

  // ── Situation ──
  situationSelector: {
    backgroundColor: PALETTE.rosePale,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  situationText: {
    fontSize: 15,
    color: PALETTE.textDark,
    fontWeight: '500',
  },
  placeholderText: {
    color: PALETTE.textLight,
    fontWeight: '400',
  },

  situationDropdown: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    overflow: 'hidden',
  },
  situationOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.rosePale,
  },
  situationOptionSelected: {
    backgroundColor: PALETTE.rosePale,
  },
  situationOptionText: {
    fontSize: 15,
    color: PALETTE.textDark,
  },
  situationOptionTextSelected: {
    fontWeight: '700',
    color: PALETTE.rose,
  },

  // ── Location ──
  locationButton: {
    backgroundColor: PALETTE.rose,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  locationButtonText: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: '600',
  },
  locationDetail: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    color: PALETTE.textLight,
  },

  // ── Audio / Fun Fact ──
  audioSection: {
    gap: 10,
  },
  recordButton: {
    backgroundColor: PALETTE.rose,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  recordButtonText: {
    color: PALETTE.white,
    fontSize: 15,
    fontWeight: '600',
  },
  recordingContainer: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: PALETTE.error,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PALETTE.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PALETTE.white,
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    color: PALETTE.textDark,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: PALETTE.error,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stopButtonText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  audioPlayer: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: PALETTE.lavender,
  },

  audioInfo: {
    flex: 1,
    gap: 6,
  },
  audioLabel: {
    fontSize: 13,
    color: PALETTE.textMid,
    fontWeight: '500',
  },
  audioWave: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 20,
  },
  waveBar: {
    width: 3,
    backgroundColor: PALETTE.roseLight,
    borderRadius: 2,
  },
  deleteAudioBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  uploadingText: {
    fontSize: 12,
    color: PALETTE.textMid,
  },
  premiumBadge: {
    backgroundColor: PALETTE.lavender,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B61A8',
  },
  premiumLock: {
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  premiumLockText: {
    fontSize: 13,
    color: PALETTE.textMid,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Save ──
  saveButton: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: PALETTE.rose,
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: PALETTE.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    color: PALETTE.textLight,
    fontStyle: 'italic',
  },

  // ── Success Overlay ──
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 249, 245, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  successText: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.rose,
  },
});
