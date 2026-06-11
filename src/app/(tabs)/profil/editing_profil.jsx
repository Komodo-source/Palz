import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  Dimensions,
  Modal,
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
import { useAuth } from '@/contexts/auth';
import { usersApi, uploadApi, getStorageUrl, constantDataApi } from '@/services/api';
import { parseDbJson } from '@/utils/parsers';
import { useSnackbar } from '@/contexts/snackbar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 16) / 3;

// ── Helpers ──
const extractFilename = (url) => {
  if (!url) return '';
  // Supabase storage URL: https://...supabase.co/storage/v1/object/public/{bucket}/{filename}
  if (url.includes('/storage/v1/object/public/')) {
    const parts = url.split('/storage/v1/object/public/');
    const pathParts = parts[1].split('/');
    return pathParts.slice(1).join('/'); // skip bucket name
  }
  // Legacy: /uploads/ paths
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    return parts[parts.length - 1];
  }
  return url;
};

// User fields coming from the API/storage are not guaranteed to be strings
// (objects here crash React with "Objects are not valid as a React child").
const asStr = (v) => (typeof v === 'string' ? v : '');

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
  const snackbar = useSnackbar();


  // ── Form state ──
  const [bio, setBio] = useState(asStr(user?.bio));
  const [work, setWork] = useState(asStr(user?.work));
  const [situation, setSituation] = useState(asStr(user?.situation));
  const [location, setLocation] = useState(asStr(user?.location) || asStr(user?.home_location));
  const [dateOfBirth, setDateOfBirth] = useState(asStr(user?.date_of_birth));
  const [ageMin, setAgeMin] = useState(user?.age_min || 18);
  const [ageMax, setAgeMax] = useState(user?.age_max || 40);
  const [showSituationPicker, setShowSituationPicker] = useState(false);

  // ── Zodiac ──
  const [zodiacSigns, setZodiacSigns] = useState([]);
  const [selectedZodiacId, setSelectedZodiacId] = useState(user?.astrology_sign_id || null);
  const [showZodiacPicker, setShowZodiacPicker] = useState(false);

  // ── Photos ──
  const [photos, setPhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // ── Location ──
  const [userLocation, setUserLocation] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // ── Prompt Q&A ──
  const [promptQuestion, setPromptQuestion] = useState(asStr(user?.prompt_question));
  const [promptAnswer, setPromptAnswer] = useState(asStr(user?.prompt_answer));
  const [showPromptPicker, setShowPromptPicker] = useState(false);

  // ── Labels (Vibe / Dispo / IRL) ──
  const [labels, setLabels] = useState(() => {
    const parsed = parseDbJson(user?.labels);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { vibe: parsed.vibe || [], dispo: parsed.dispo || [], irl: parsed.irl || [] };
    }
    return { vibe: [], dispo: [], irl: [] };
  });

  // ── Audio / Fun Fact ──
  const [isRecording, setIsRecording] = useState(false);
  const justStartedRef = useRef(false); // prevents auto-stop effect from firing before recorder state syncs
  const [recordedAudioUri, setRecordedAudioUri] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [voiceFunFactChanged, setVoiceFunFactChanged] = useState(false);

  // expo-audio hooks — recorder and player managed by component lifecycle
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(recordedAudioUri ? { uri: recordedAudioUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  // Stable waveform bar heights — computed once so they don't jump on re-render
  const waveHeights = useRef([...Array(20)].map(() => Math.random() * 16 + 4)).current;

  // ── Save state ──
  const [isSaving, setIsSaving] = useState(false);
  const saveOpacity = useRef(new Animated.Value(0)).current;

  // Track mounted state to prevent setState after unmount (prevents crashes)
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Reset audio mode on unmount to release microphone
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []);

  // ── Init: sync form state once user data arrives ──
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!didInitRef.current && user) {
      didInitRef.current = true;
      setBio(asStr(user.bio));
      setWork(asStr(user.work));
      setSituation(asStr(user.situation));
      setLocation(asStr(user.location) || asStr(user.home_location));
      setDateOfBirth(asStr(user.date_of_birth));
      if (user.age_min) setAgeMin(user.age_min);
      if (user.age_max) setAgeMax(user.age_max);
      if (user.astrology_sign_id) setSelectedZodiacId(user.astrology_sign_id);

      const parsedPhotos = parseDbJson(user.profile_image);
      if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
        setPhotos(parsedPhotos.map((url, index) => ({
          id: `existing_${index}`,
          uri: getStorageUrl(url),
          isExisting: true,
        })));
      }

      if (user.voice_fun_fact) {
        setRecordedAudioUri(getStorageUrl(user.voice_fun_fact));
      }

      if (user.prompt_question) setPromptQuestion(asStr(user.prompt_question));
      if (user.prompt_answer) setPromptAnswer(asStr(user.prompt_answer));
      if (user.labels) {
        const parsed = parseDbJson(user.labels);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setLabels({ vibe: parsed.vibe || [], dispo: parsed.dispo || [], irl: parsed.irl || [] });
        }
      }

      if (user.latitude && user.longitude) {
        setUserLocation({
          latitude: parseFloat(user.latitude),
          longitude: parseFloat(user.longitude),
        });
      }
    }

    console.log("information_user", user);
  }, [user]);

  // Load zodiac signs once
  useEffect(() => {
    constantDataApi.getZodiacSigns().then((res) => {
      setZodiacSigns(res.data?.astrology || []);
    }).catch(() => {});
  }, []);

  // ── Sync isPlayingAudio with player status ──
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setIsPlayingAudio(false);
    }
  }, [playerStatus.didJustFinish]);

  // ── Auto-stop: fires when native recorder stops (max duration, error, etc.) ──
  useEffect(() => {
    if (recordingState.isRecording) {
      // Recorder is genuinely active — clear the startup guard
      justStartedRef.current = false;
      return;
    }
    // Only call stopRecording if we didn't just start (guard prevents instant false-stop)
    if (isRecording && !justStartedRef.current) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingState.isRecording, isRecording]);

  // ── Photo picking ──
  const launchPicker = async (source) => {
    let permissionResult;
    if (source === 'camera') {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission requise',
        source === 'camera'
          ? 'Accorde l\'accès à l\'appareil photo pour prendre une photo.'
          : 'Accorde l\'accès à tes photos pour personnaliser ton profil.'
      );
      return;
    }

    const pickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      uploadPhoto(uri);
    }
  };

  const pickImage = () => {
    if (photos.length >= 4) {
      Alert.alert('Maximum atteint', 'Tu peux ajouter jusqu\'à 4 photos sur ton profil.');
      return;
    }

    Alert.alert('Ajouter une photo', 'Choisis la source', [
      { text: 'Appareil photo', onPress: () => launchPicker('camera') },
      { text: 'Galerie', onPress: () => launchPicker('library') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (uri) => {
    setIsUploadingPhoto(true);
    try {
      const ext = (uri.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)?.[1] ?? 'jpg').toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const { url } = await uploadApi.uploadImage({
        uri,
        fileName: `photo.${ext}`,
        mimeType,
      });

      if (url?.reposnse?.nsfw){
        Alert.alert("Aïe", "Votre photos contient des éléments explicites\nAttention ce type de post peut mener à des sanctions\nPour tout faux positif veuillez contacter support@copines-app.fr", [{
            text: "OK",
            }
        ])
      }

      if (isMounted.current) {
        setPhotos((prev) => [...prev, {
          id: `new_${Date.now()}`,
          uri,
          uploadedUrl: url,
          isExisting: false,
        }]);
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      const message = err?.message?.includes('Not Found') || err?.message?.includes('404')
        ? 'Le serveur de téléchargement n\'est pas disponible. Réessaie plus tard !'
        : 'Impossible d\'uploader la photo. Réessaie !';
      if (isMounted.current) Alert.alert('Oups', message);
    } finally {
      if (isMounted.current) setIsUploadingPhoto(false);
    }
  };

  const removePhoto = (photoId) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // ── Location ──
  const getCurrentLocation = useCallback(async () => {
    if (!isMounted.current) return;
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (isMounted.current) {
          Alert.alert('Permission requise', 'Active la localisation pour partager ta ville.');
        }
        return;
      }

      let location;
      try {
        // Try GPS first
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (gpsErr) {
        // Google Play Services error (code 20) or other GPS failures
        console.warn('GPS failed, trying last known location:', gpsErr.message);
        try {
          location = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
          if (!location && isMounted.current) {
            Alert.alert(
              'Localisation indisponible',
              'Impossible d\'accéder au GPS. Vérifie que les services de localisation sont activés ou réessaie plus tard.'
            );
            return;
          }
        } catch (lastKnownErr) {
          console.error('Last known location error:', lastKnownErr);
          if (isMounted.current) {
            Alert.alert(
              'Localisation indisponible',
              'Les services de localisation ne sont pas disponibles. Vérifie tes paramètres Google Play Services.'
            );
          }
          return;
        }
      }

      if (!location || !isMounted.current) return;

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      // Reverse geocode to get city name
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (isMounted.current) {
          const city = geocode?.city || geocode?.region || '';
          Alert.alert('Localisation mise à jour !', city ? `Tu es à ${city}` : 'Position enregistrée.');
        }
      } catch (geoErr) {
        console.warn('Reverse geocode failed:', geoErr.message);
        // Location coords are still saved even if city lookup fails
        if (isMounted.current) {
          Alert.alert('Position enregistrée !', 'Ta position a bien été mise à jour.');
        }
      }
    } catch (err) {
      console.error('Location error:', err);
      if (isMounted.current) {
        Alert.alert('Oups', 'Impossible de récupérer ta position.');
      }
    } finally {
      if (isMounted.current) setIsFetchingLocation(false);
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

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      justStartedRef.current = true; // guard: native recorder state hasn't synced yet
      recorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording start error:', err);
      Alert.alert('Oups', "Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    try {
      await recorder.stop();
    } catch {
      // Recorder may have auto-stopped — that's fine
    }

    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}

    // URI is a property on the recorder object, available after stop
    const uri = recorder.uri;
    if (!uri) {
      if (isMounted.current) Alert.alert('Oups', "L'enregistrement a échoué. Réessaie !");
      return;
    }
    if (isMounted.current) {
      setRecordedAudioUri(uri);
      await uploadAudio(uri);
    }
  };

  const uploadAudio = async (uri) => {
    if (!isMounted.current) return;
    setIsUploadingAudio(true);
    try {
      const { url } = await uploadApi.uploadAudio({
        uri,
        fileName: 'fun_fact.m4a',
        mimeType: 'audio/m4a',
      });
      if (isMounted.current) {
        setRecordedAudioUri(url);
        setVoiceFunFactChanged(true);
      }
    } catch (err) {
      console.error('Audio upload error:', err);
      if (isMounted.current) {
        Alert.alert('Oups', "L'enregistrement est sauvegardé mais n'a pas pu être uploadé.");
      }
    } finally {
      if (isMounted.current) setIsUploadingAudio(false);
    }
  };

  const playAudio = async () => {
    if (playerStatus.playing) {
      player.pause();
      setIsPlayingAudio(false);
    } else if (recordedAudioUri) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
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

      if (bio !== (user?.bio || '')) updateData.bio = bio;
      if (work !== (user?.work || '')) updateData.work = work;
      if (situation !== (user?.situation || '')) updateData.situation = situation;
      if (location !== (user?.location || user?.home_location || '')) updateData.location = location;
      if (dateOfBirth !== (user?.date_of_birth || '')) updateData.date_of_birth = dateOfBirth;
      if (ageMin !== (user?.age_min || 18)) updateData.age_min = ageMin;
      if (ageMax !== (user?.age_max || 40)) updateData.age_max = ageMax;
      if (selectedZodiacId && selectedZodiacId !== user?.astrology_sign_id) {
        updateData.astrology_sign_id = selectedZodiacId;
      }

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

      // Prompt Q&A
      if (promptQuestion !== (user?.prompt_question || '')) updateData.prompt_question = promptQuestion || null;
      if (promptAnswer !== (user?.prompt_answer || '')) updateData.prompt_answer = promptAnswer || null;

      // Labels
      const origLabels = user?.labels && typeof user.labels === 'object' ? user.labels : { vibe: [], dispo: [], irl: [] };
      if (JSON.stringify(labels) !== JSON.stringify(origLabels)) updateData.labels = labels;

      // Voice fun fact — only include when changed
      if (voiceFunFactChanged) {
        updateData.voice_fun_fact = recordedAudioUri
          ? extractFilename(recordedAudioUri)
          : null;
      }

      // Location
      if (userLocation) {
        updateData.latitude = userLocation.latitude;
        updateData.longitude = userLocation.longitude;
      }

      if (Object.keys(updateData).length === 0) {
        Alert.alert('Info', 'Aucune modification à sauvegarder.');
        router.back();
        return;
      }

      await usersApi.updateProfile(updateData);
      await refreshUser();

      snackbar.success('Profil mis à jour ✓', 2000);

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
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profil/settings')}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={PALETTE.rose} />
          </TouchableOpacity>
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

        {/* ── Prompt Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Mon prompt</Text>
          </View>
          <Text style={styles.sectionHint}>Réponds à une question pour te démarquer</Text>
          <TouchableOpacity style={styles.situationSelector} onPress={() => setShowPromptPicker(true)} activeOpacity={0.7}>
            <Text style={[styles.situationText, !promptQuestion && styles.placeholderText]} numberOfLines={1}>
              {promptQuestion || 'Choisis une question…'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={PALETTE.rose} />
          </TouchableOpacity>
          {promptQuestion ? (
            <TextInput
              style={[styles.textArea, { marginTop: 10 }]}
              placeholder="Ta réponse (150 caractères max)…"
              placeholderTextColor={PALETTE.textLight}
              value={promptAnswer}
              onChangeText={setPromptAnswer}
              multiline
              numberOfLines={3}
              maxLength={150}
              textAlignVertical="top"
            />
          ) : null}
          {promptAnswer.length > 0 && <Text style={styles.charCount}>{promptAnswer.length}/150</Text>}
        </View>

        {/* Prompt picker modal */}
        <Modal visible={showPromptPicker} transparent animationType="slide" onRequestClose={() => setShowPromptPicker(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPromptPicker(false)}>
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Choisis une question</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  'Mon week-end idéal…',
                  'On me dit souvent que…',
                  'Je cherche quelqu\'un pour…',
                  'Ma chanson du moment c\'est…',
                  'Je suis vraiment fière de…',
                  'Mon guilty pleasure c\'est…',
                  'La prochaine aventure sur ma liste…',
                  'Je rigole toujours quand…',
                  'Deux vérités et un mensonge…',
                  'La chose que j\'adorerais partager avec une amie…',
                  'Mon super-pouvoir secret c\'est…',
                  'Ce qui me rend unique dans un groupe…',
                ].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.zodiacOption, promptQuestion === q && styles.situationOptionSelected]}
                    onPress={() => { setPromptQuestion(q); setShowPromptPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.situationOptionText, promptQuestion === q && styles.situationOptionTextSelected]}>{q}</Text>
                    {promptQuestion === q && <Ionicons name="checkmark" size={16} color={PALETTE.rose} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Labels Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Mes étiquettes</Text>
          </View>
          <Text style={styles.sectionHint}>Choisis jusqu'à 3 par catégorie</Text>
          {[
            { key: 'vibe', title: 'Vibe', color: '#CC3D5E', bg: '#FFF0F3', options: ['Créative','Sportive','Homebody','Spontanée','Ambitieuse','Artiste','Voyageuse','Bookworm','Foodie','Geek'] },
            { key: 'dispo', title: 'Dispo', color: '#0369A1', bg: '#E0F2FE', options: ['Soirées','Brunchs','Voyages','Sport','Musées/Expos','Concerts','Apéros','Randos','Cinéma','Yoga'] },
            { key: 'irl', title: 'IRL', color: '#6D28D9', bg: '#E8D5F5', options: ['Chien','Chat','Voiture','Propriétaire','Locataire','Non-fumeur','Végétarienne','Étudiante','Freelance','Télétravail'] },
          ].map(({ key, title, color, bg, options }) => (
            <View key={key} style={{ marginBottom: 14 }}>
              <Text style={[styles.labelCategoryTitle, { color }]}>{title}</Text>
              <View style={styles.labelsWrap}>
                {options.map((opt) => {
                  const selected = labels[key]?.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.labelChip, { backgroundColor: selected ? bg : 'transparent', borderColor: selected ? color : '#DDD' }]}
                      onPress={() => {
                        setLabels((prev) => {
                          const arr = prev[key] || [];
                          if (arr.includes(opt)) return { ...prev, [key]: arr.filter((x) => x !== opt) };
                          if (arr.length >= 3) return prev;
                          return { ...prev, [key]: [...arr, opt] };
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.labelChipText, { color: selected ? color : PALETTE.textMid }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
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

        {/* ── City Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="home-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Ma ville</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Ex: Paris, Lyon, Bordeaux..."
            placeholderTextColor={PALETTE.textLight}
            value={location}
            onChangeText={setLocation}
            maxLength={100}
          />
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

        {/* ── Age Range Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Tranche d'âge recherchée</Text>
          </View>
          <Text style={styles.sectionHint}>Âge des personnes que tu souhaites rencontrer</Text>
          <View style={styles.ageRangeRow}>
            <View style={styles.ageRangeBox}>
              <Text style={styles.ageRangeLabel}>Minimum</Text>
              <View style={styles.ageRangeControls}>
                <TouchableOpacity
                  style={styles.ageBtn}
                  onPress={() => setAgeMin((a) => Math.max(18, a - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={PALETTE.rose} />
                </TouchableOpacity>
                <Text style={styles.ageRangeValue}>{ageMin}</Text>
                <TouchableOpacity
                  style={styles.ageBtn}
                  onPress={() => setAgeMin((a) => Math.min(ageMax - 1, a + 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={PALETTE.rose} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.ageRangeDash}>
              <Text style={styles.ageRangeDashText}>–</Text>
            </View>
            <View style={styles.ageRangeBox}>
              <Text style={styles.ageRangeLabel}>Maximum</Text>
              <View style={styles.ageRangeControls}>
                <TouchableOpacity
                  style={styles.ageBtn}
                  onPress={() => setAgeMax((a) => Math.max(ageMin + 1, a - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={PALETTE.rose} />
                </TouchableOpacity>
                <Text style={styles.ageRangeValue}>{ageMax}</Text>
                <TouchableOpacity
                  style={styles.ageBtn}
                  onPress={() => setAgeMax((a) => Math.min(99, a + 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={PALETTE.rose} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={styles.ageRangeTrack}>
            <View style={{ flex: Math.max(0, ageMin - 18), backgroundColor: 'transparent' }} />
            <View style={[styles.ageRangeFill, { flex: Math.max(1, ageMax - ageMin) }]} />
            <View style={{ flex: Math.max(0, 99 - ageMax), backgroundColor: 'transparent' }} />
          </View>
        </View>

        {/* ── Date of Birth Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Date de naissance</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="AAAA-MM-JJ  (ex: 1998-07-15)"
            placeholderTextColor={PALETTE.textLight}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numeric"
            maxLength={10}
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

        {/* ── Zodiac Section ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={20} color={PALETTE.rose} />
            <Text style={styles.sectionTitle}>Signe astrologique</Text>
          </View>

          <TouchableOpacity
            style={styles.situationSelector}
            onPress={() => setShowZodiacPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.situationText,
              !selectedZodiacId && styles.placeholderText,
            ]}>
              {selectedZodiacId
                ? (zodiacSigns.find((z) => z.id === selectedZodiacId)?.name || 'Signe sélectionné')
                : 'Choisis ton signe...'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={PALETTE.rose} />
          </TouchableOpacity>
        </View>

        {/* Zodiac picker modal */}
        <Modal
          visible={showZodiacPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowZodiacPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowZodiacPicker(false)}
          >
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Choisis ton signe</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {zodiacSigns.map((sign) => (
                  <TouchableOpacity
                    key={sign.id}
                    style={[
                      styles.zodiacOption,
                      selectedZodiacId === sign.id && styles.situationOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedZodiacId(sign.id);
                      setShowZodiacPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.situationOptionText,
                      selectedZodiacId === sign.id && styles.situationOptionTextSelected,
                    ]}>
                      {sign.name}
                    </Text>
                    {selectedZodiacId === sign.id && (
                      <Ionicons name="checkmark" size={16} color={PALETTE.rose} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>



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
            <TouchableOpacity
              style={styles.premiumLock}
              onPress={() => router.push('/(tabs)/profil/payement_page')}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={26} color="#7B61A8" />
              <Text style={styles.premiumLockText}>
                Passe en Premium pour débloquer les fun facts vocales
              </Text>
              <View style={styles.premiumLockBtn}>
                <Text style={styles.premiumLockBtnText}>Devenir Premium</Text>
              </View>
            </TouchableOpacity>
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
                      {waveHeights.map((h, i) => (
                        <View
                          key={i}
                          style={[
                            styles.waveBar,
                            { height: h },
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
              ) : (
                <Pressable
                  style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                >
                  {isRecording ? (
                    <>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordButtonText}>
                        {formatDuration(Math.floor(recordingState.durationMillis / 1000))} · Relâcher pour arrêter
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="mic" size={24} color={PALETTE.white} />
                      <Text style={styles.recordButtonText}>Maintenir pour enregistrer</Text>
                    </>
                  )}
                </Pressable>
              )}
              {isUploadingAudio && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color={PALETTE.rose} size="small" />
                  <Text style={styles.uploadingText}>Upload de l&apos;audio...</Text>
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
        <Animated.View style={[styles.successOverlay, { opacity: saveOpacity }]} pointerEvents="none">
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
  labelCategoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  labelsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  labelChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  labelChipText: {
    fontSize: 13,
    fontWeight: '600',
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

  recordButtonActive: {
    backgroundColor: '#c0392b',
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
  premiumLockBtn: {
    backgroundColor: '#7B61A8',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  premiumLockBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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

  // ── Zodiac modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: PALETTE.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.textDark,
    textAlign: 'center',
    marginBottom: 16,
  },
  zodiacOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.rosePale,
    borderRadius: 12,
    marginBottom: 2,
  },

  // ── Age Range ──
  ageRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  ageRangeBox: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.rosePale,
    borderRadius: 16,
    paddingVertical: 14,
  },
  ageRangeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ageRangeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ageBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  ageRangeValue: {
    fontSize: 26,
    fontWeight: '800',
    color: PALETTE.rose,
    minWidth: 34,
    textAlign: 'center',
  },
  ageRangeDash: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageRangeDashText: {
    fontSize: 22,
    fontWeight: '300',
    color: PALETTE.textLight,
  },
  ageRangeTrack: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: PALETTE.rosePale,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  ageRangeFill: {
    height: 4,
    backgroundColor: PALETTE.rose,
  },
});
