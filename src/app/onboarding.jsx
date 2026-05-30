import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated as RNAnimated,
  Platform,
  ScrollView,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';
import { usersApi, constantDataApi, uploadApi } from '@/services/api';
import { COMPATIBILITY_QUESTIONS, getDefaultAnswers } from '@/utils/compatibility';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import ConfettiCannon from '@/components/ConfettiCannon';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 64) / 3;

// ── Palette douce et féminine ──
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
  { label: 'Célibataire', value: 'celibataire', icon: 'sparkles' },
  { label: 'En couple', value: 'couple', icon: 'heart' },
  { label: 'En recherche', value: 'recherche', icon: 'search' },
  { label: 'Divorcé(e)', value: 'divorce', icon: 'flower' },
  { label: 'C\'est compliqué', value: 'complique', icon: 'pulse' },
];

const TOTAL_STEPS = 11; // zodiac(0) + sports(1) + hobbies(2) + photos(3) + location(4) + situation(5) + relation(6) + compat(7-9) + video(10)



function extractFilename(url) {
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
}

// ── Step components ──

function ZodiacStep({ zodiacSigns, selectedId, onSelect }) {
  const zodiacIcons = {
    'Bélier': 'flame',
    'Taureau': 'leaf',
    'Gémeaux': 'infinite',
    'Cancer': 'water',
    'Lion': 'sunny',
    'Vierge': 'sparkles',
    'Balance': 'scale',
    'Scorpion': 'skull',
    'Sagittaire': 'arrow-forward',
    'Capricorne': 'mountain',
    'Verseau': 'rainy',
    'Poissons': 'fish',
  };

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name="star" size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>Ton signe astro</Text>
        <Text style={styles.stepSubtitle}>Quel est ton signe du zodiaque ?</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
        <View style={styles.optionGrid}>
          {zodiacSigns.map((sign, idx) => {
            const id = typeof sign === 'object' ? sign.id : idx;
            const name = typeof sign === 'object' ? sign.name : sign;
            const isSelected = selectedId === id;
            const iconName = zodiacIcons[name] || 'star';
            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => onSelect(id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.optionIconWrap,
                  isSelected && styles.optionIconWrapSelected,
                ]}>
                  <Ionicons name={iconName} size={24} color={isSelected ? PALETTE.white : PALETTE.rose} />
                </View>
                <Text style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
                ]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function MultiSelectStep({ title, subtitle, icon, items, selected, onToggle, searchPlaceholder }) {
  const [search, setSearch] = useState('');

  const filtered = items.filter((item) => {
    const name = typeof item === 'string' ? item : (item.title || '');
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name={icon} size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
        <Text style={styles.selectionCount}>{selected.length} sélectionné(s)</Text>
      </View>

      <View style={[styles.searchBar, { borderColor: PALETTE.border }]}>
        <Ionicons name="search" size={18} color={PALETTE.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder || 'Rechercher...'}
          placeholderTextColor={PALETTE.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
        <View style={styles.chipContainer}>
          {filtered.map((item) => {
            const name = typeof item === 'string' ? item : (item.title || '');
            const isSelected = selected.includes(name);
            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected,
                ]}
                onPress={() => onToggle(name)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}>{name}</Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={16} color={PALETTE.white} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            );
          })}
          {filtered.length === 0 && (
            <Text style={styles.emptySearch}>Aucun résultat</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PhotosStep({ photos, onAddPhoto, onRemovePhoto, isUploading }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name="camera" size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>Tes photos</Text>
        <Text style={styles.stepSubtitle}>Ajoute jusqu'à 4 photos pour ton profil</Text>
        <Text style={styles.selectionCount}>{photos.length}/4</Text>
      </View>

      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => onRemovePhoto(index)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={12} color={PALETTE.white} />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 4 && (
          <TouchableOpacity
            style={styles.addPhotoBtn}
            onPress={onAddPhoto}
            disabled={isUploading}
            activeOpacity={0.7}
          >
            {isUploading ? (
              <ActivityIndicator color={PALETTE.rose} size="small" />
            ) : (
              <>
                <Ionicons name="add" size={28} color={PALETTE.rose} />
                <Text style={styles.addPhotoLabel}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.photoHint}>
        {photos.length === 0 ? 'Des photos naturelles et souriantes sont les meilleures ! 🌸' : 'Tu peux en ajouter ou modifier plus tard'}
      </Text>
    </View>
  );
}

function LocationStep({ location, isFetching, onGetLocation, onSkip }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name="location" size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>Ta localisation</Text>
        <Text style={styles.stepSubtitle}>Partage ta position pour trouver des amis près de chez toi</Text>
      </View>

      <View style={styles.locationContent}>
        <View style={styles.locationIllustration}>
          <Ionicons name="earth" size={80} color={PALETTE.roseLight} />
        </View>

        {location ? (
          <View style={[styles.locationSuccess, { backgroundColor: PALETTE.rosePale }]}>
            <Ionicons name="checkmark-circle" size={24} color={PALETTE.success} />
            <Text style={styles.locationSuccessText}>Position enregistrée !</Text>
            <Text style={styles.locationCoords}>
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={onGetLocation}
            disabled={isFetching}
            activeOpacity={0.7}
          >
            {isFetching ? (
              <ActivityIndicator color={PALETTE.white} size="small" />
            ) : (
              <>
                <Ionicons name="navigate" size={22} color={PALETTE.white} />
                <Text style={styles.locationButtonText}>Activer ma position</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!location && (
          <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
            <Text style={styles.skipLink}>Passer cette étape</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SituationStep({ selected, onSelect }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name="heart" size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>Ta situation</Text>
        <Text style={styles.stepSubtitle}>Quelle est ta situation actuelle ?</Text>
      </View>

      <View style={styles.situationList}>
        {SITUATION_OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.situationCard,
                isSelected && styles.situationCardSelected,
              ]}
              onPress={() => onSelect(option.value)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.situationIconWrap,
                isSelected && styles.situationIconWrapSelected,
              ]}>
                <Ionicons name={option.icon} size={22} color={isSelected ? PALETTE.white : PALETTE.rose} />
              </View>
              <Text style={[
                styles.situationLabel,
                isSelected && styles.situationLabelSelected,
              ]}>{option.label}</Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color={PALETTE.rose} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Main Screen ──
export default function OnboardingScreen() {
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Data from backend
  const [zodiacSigns, setZodiacSigns] = useState([]);
  const [sportsList, setSportsList] = useState([]);
  const [hobbiesList, setHobbiesList] = useState([]);

  // Form state
  const [zodiacSignId, setZodiacSignId] = useState(null);
  const zodiacSignName = zodiacSignId != null
    ? (() => {
        const found = zodiacSigns.find(s => String(typeof s === 'object' ? s.id : s) === String(zodiacSignId));
        return typeof found === 'object' ? found.name : (found || '');
      })()
    : '';
  const [selectedSports, setSelectedSports] = useState([]);
  const [selectedHobbies, setSelectedHobbies] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [situation, setSituation] = useState('');
  const [typeSearchOptions, setTypeSearchOptions] = useState([]);
  const [selectedTypeSearch, setSelectedTypeSearch] = useState(null);

  const [videoVerified, setVideoVerified] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);


  // Compatibility answers
  const [compatAnswers, setCompatAnswers] = useState(getDefaultAnswers());

  // Animation
  const slideAnim = useRef(new RNAnimated.Value(0)).current;
  const progressAnim = useRef(new RNAnimated.Value(0)).current;
  const resultOpacity = useRef(new RNAnimated.Value(0)).current;



  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Accorde l'accès à la caméra pour enregistrer la vidéo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 15,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setIsUploadingVideo(true);
      try {
        await uploadApi.uploadVideo({
          uri: asset.uri,
          fileName: `verification_${Date.now()}.mp4`,
          mimeType: 'video/mp4',
        });
        setVideoVerified(true);
      } catch (err) {
        console.error('Video upload error:', err);
        Alert.alert('Oups', "Impossible d'envoyer la vidéo. Réessaie !");
      } finally {
        setIsUploadingVideo(false);
      }
    }
  };


  function CheckIfWomen() {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
            <Ionicons name="videocam" size={32} color={PALETTE.rose} />
          </View>
          <Text style={styles.stepTitle}>Confirmation d'identité</Text>
          <Text style={styles.stepSubtitle}>
            Une courte vidéo pour vérifier ton identité
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
          <Text style={styles.subtitleConfirmation}>
            Enregistre une courte vidéo en suivant ces instructions :
          </Text>
          <Text style={styles.instruction}>• Bouge la tête de gauche à droite, 2 secondes de chaque côté</Text>
          <Text style={styles.instruction}>• Montre 3 doigts devant ton visage</Text>
          <Text style={styles.instruction}>• Assure-toi d'être dans un endroit bien éclairé</Text>

          <View style={styles.videoActionWrap}>
            {isUploadingVideo ? (
              <View style={styles.videoStatusWrap}>
                <ActivityIndicator color={PALETTE.rose} size="large" />
                <Text style={styles.videoStatusText}>Envoi en cours...</Text>
              </View>
            ) : videoVerified ? (
              <View style={styles.videoStatusWrap}>
                <Ionicons name="checkmark-circle" size={56} color={PALETTE.success} />
                <Text style={[styles.videoStatusText, { color: PALETTE.success }]}>
                  Vidéo envoyée avec succès !
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.recordButton} onPress={recordVideo} activeOpacity={0.8}>
                <Ionicons name="videocam" size={22} color={PALETTE.white} />
                <Text style={styles.recordButtonText}>Enregistrer ma vidéo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.instruction, { marginTop: 16, color: PALETTE.textLight, fontStyle: 'italic' }]}>
            Cette vidéo sera supprimée après vérification par notre équipe.
          </Text>

          {!videoVerified && !isUploadingVideo && (
            <TouchableOpacity onPress={() => setVideoVerified(true)} style={styles.skipVideoBtn}>
              <Text style={styles.skipLink}>Passer cette étape</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }


  // Load backend data
  useEffect(() => {
    async function loadData() {
      try {
        const [zodiacRes, sportsRes, hobbiesRes, typeRes] = await Promise.all([
          constantDataApi.getZodiacSigns(),
          constantDataApi.getSports(),
          constantDataApi.getHobbies(),
          constantDataApi.getTypeSearch(),
        ]);
        setZodiacSigns((zodiacRes.data?.astrology || []).map((s) => ({ id: s.id, name: s.name })));
        setSportsList((sportsRes.data?.sports || []).map((s) => s.title));
        // Extract data safely — backend keys vary
        const hobbiesData = hobbiesRes.data || {};
        const hobbiesArr = hobbiesData.hobbies || hobbiesData.sports || hobbiesData.data || [];
        setHobbiesList(Array.isArray(hobbiesArr) ? hobbiesArr.map((s) => s.title || s) : []);

        const typeData = typeRes.data || {};
        const typeArr = typeData.search_types || typeData.type_search || typeData.data || [];
        console.log(typeData);
        setTypeSearchOptions(Array.isArray(typeArr) ? typeArr : []);
      } catch (err) {
        console.error('Failed to load constants:', err?.message || err);
        // Fallback data
        setZodiacSigns(['Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge', 'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons']);
        setSportsList(['Foot', 'Danse', 'Yoga', 'Natation', 'Running', 'Tennis', 'Escalade', 'Vélo', 'Musculation', 'Pilates', 'Boxe', 'Surf']);
        setHobbiesList(['Lecture', 'Cuisine', 'Voyages', 'Photographie', 'Dessin', 'Musique', 'Cinéma', 'Jardinage', 'Jeux vidéo', 'Théâtre', 'Écriture', 'Bricolage']);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const animateIn = useCallback(() => {
    slideAnim.setValue(30);
    RNAnimated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    animateIn();
  }, [step, animateIn]);

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
      quality: 0.8,
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

      setPhotos((prev) => [...prev, { uri, uploadedUrl: url }]);
    } catch (err) {
      console.error('Photo upload error:', err);
      Alert.alert('Oups', 'Impossible d\'uploader la photo. Réessaie !');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Location ──
  const getCurrentLocation = useCallback(async () => {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Active la localisation pour partager ta ville.');
        return;
      }

      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (gpsErr) {
        console.warn('GPS failed, trying last known location:', gpsErr?.message || gpsErr);
        try {
          location = await Location.getLastKnownPositionAsync({ maxAge: 300000 });
          if (!location) {
            Alert.alert('Localisation indisponible', 'Impossible d\'accéder au GPS. Réessaie plus tard.');
            return;
          }
        } catch (lastKnownErr) {
          console.error('Last known location error:', lastKnownErr?.message || lastKnownErr);
          Alert.alert('Localisation indisponible', 'Les services de localisation ne sont pas disponibles.');
          return;
        }
      }

      if (!location) return;

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      Alert.alert('Position enregistrée !', 'Ta localisation a bien été mise à jour.');
    } catch (err) {
      console.error('Location error:', err);
      Alert.alert('Oups', 'Impossible de récupérer ta position.');
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  // ── Navigation ──
  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      RNAnimated.timing(progressAnim, {
        toValue: ((step + 1) / TOTAL_STEPS) * 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      handleFinish();
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep(step - 1);
      RNAnimated.timing(progressAnim, {
        toValue: ((step - 1) / TOTAL_STEPS) * 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [step]);

  // Map step index to section
  // 0: zodiac, 1: sports, 2: hobbies, 3: photos, 4: location, 5: situation, 6: relation, 7-9: compatibility
  const getStepData = () => {
    const compatIdx = step - 7;
    if (step === 0) {
      return {
        canProceed: zodiacSignId != null,
        component: (
          <ZodiacStep
            zodiacSigns={zodiacSigns}
            selectedId={zodiacSignId}
            onSelect={setZodiacSignId}
          />
        ),
      };
    }
    if (step === 1) {
      return {
        canProceed: selectedSports.length > 0,
        component: (
          <MultiSelectStep
            title="Tes sports préférés"
            subtitle="Sélectionne les sports que tu aimes"
            icon="barbell"
            items={sportsList}
            selected={selectedSports}
            onToggle={(name) => {
              setSelectedSports((prev) =>
                prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
              );
            }}
            searchPlaceholder="Chercher un sport..."
          />
        ),
      };
    }
    if (step === 2) {
      return {
        canProceed: selectedHobbies.length > 0,
        component: (
          <MultiSelectStep
            title="Tes loisirs"
            subtitle="Qu'est-ce que tu aimes faire ?"
            icon="color-palette"
            items={hobbiesList}
            selected={selectedHobbies}
            onToggle={(name) => {
              setSelectedHobbies((prev) =>
                prev.includes(name) ? prev.filter((h) => h !== name) : [...prev, name]
              );
            }}
            searchPlaceholder="Chercher un loisir..."
          />
        ),
      };
    }
    if (step === 3) {
      return {
        canProceed: photos.length > 0,
        component: (
          <PhotosStep
            photos={photos}
            onAddPhoto={pickImage}
            onRemovePhoto={removePhoto}
            isUploading={isUploadingPhoto}
          />
        ),
      };
    }
    if (step === 4) {
      return {
        canProceed: !!userLocation,
        component: (
          <LocationStep
            location={userLocation}
            isFetching={isFetchingLocation}
            onGetLocation={getCurrentLocation}
            onSkip={() => {
              handleNext();
            }}
          />
        ),
      };
    }
    if (step === 5) {
      return {
        canProceed: !!situation,
        component: (
          <SituationStep
            selected={situation}
            onSelect={setSituation}
          />
        ),
      };
    }
    if (step === 6) {
      return {
        canProceed: selectedTypeSearch !== null,
        component: (
          <RelationshipStep
            options={typeSearchOptions}
            selected={selectedTypeSearch}
            onSelect={setSelectedTypeSearch}
          />
        ),
      };
    }
    if (step === 10) {
      return {
        canProceed: videoVerified,
        component: <CheckIfWomen />,
      };
    }
    if (compatIdx >= 0 && compatIdx < COMPATIBILITY_QUESTIONS.length) {
      const q = COMPATIBILITY_QUESTIONS[compatIdx];
      const val = compatAnswers[q.id];
      return {
        canProceed: true,
        component: (
          <CompatibilityCard
            question={q}
            value={val}
            onValueChange={(newVal) => {
              setCompatAnswers((prev) => ({ ...prev, [q.id]: newVal }));
            }}
          />
        ),
      };
    }
    return { canProceed: true, component: null };
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Build update data
      const updateData = {};

      if (zodiacSignId != null) updateData.astrology_sign_id = zodiacSignId;

      // Interests JSON stores only compatibility answers
      updateData.interests = { ...compatAnswers };

      // Sports and hobbies go to their own junction tables
      if (selectedSports.length > 0) updateData.sports = selectedSports;
      if (selectedHobbies.length > 0) updateData.hobbies = selectedHobbies;

      // Photos
      const photoUrls = photos
        .filter((p) => p.uploadedUrl)
        .map((p) => extractFilename(p.uploadedUrl));
      if (photoUrls.length > 0) {
        updateData.profile_image = photoUrls;
      }

      // Location
      if (userLocation) {
        updateData.latitude = userLocation.latitude;
        updateData.longitude = userLocation.longitude;
      }

      // Situation
      if (situation) updateData.situation = situation;

      // Type de relation recherchée
      if (selectedTypeSearch !== null) {
        updateData.id_type_searched = selectedTypeSearch;
      }

      console.log('Saving onboarding data:', updateData);

      await usersApi.updateProfile(updateData);
      await refreshUser();

      setShowResult(true);
      RNAnimated.timing(resultOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (err) {
      console.error('Save onboarding error:', err);
      console.error('Detaisls :', err);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: PALETTE.cream }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
        <Text style={[styles.loadingText, { color: PALETTE.textMid }]}>
          On prépare ton onboarding...
        </Text>
      </View>
    );
  }

  // ── Result overlay ──
  if (showResult) {
    return (
      <View style={[styles.container, { backgroundColor: PALETTE.cream }]}>
        <RNAnimated.View style={[styles.resultContainer, { opacity: resultOpacity }]}>
          <View style={styles.resultContent}>
            <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale, width: 100, height: 100, borderRadius: 50 }]}>
              <Ionicons name="sparkles" size={48} color={PALETTE.rose} />
            </View>
            <Text style={styles.resultTitle}>Bienvenue sur Palz !</Text>
            <Text style={styles.resultSubtitle}>
              Ton profil est tout prêt. On te trouve des amis géniaux !
            </Text>
            <View style={[styles.resultCard, { backgroundColor: PALETTE.white }]}>
              <Text style={styles.resultLabel}>Signe astro</Text>
              <Text style={styles.resultValue}>{zodiacSignName || '—'}</Text>
              <View style={[styles.divider, { backgroundColor: PALETTE.border }]} />
              <Text style={styles.resultLabel}>Sports</Text>
              <Text style={styles.resultValue}>{selectedSports.slice(0, 3).join(', ') || '—'}</Text>
              <View style={[styles.divider, { backgroundColor: PALETTE.border }]} />
              <Text style={styles.resultLabel}>Loisirs</Text>
              <Text style={styles.resultValue}>{selectedHobbies.slice(0, 3).join(', ') || '—'}</Text>
            </View>
            <Text style={styles.resultTagline}>
              Prépare-toi à rencontrer des gens formidables... ✨
            </Text>
          </View>
        </RNAnimated.View>
        <ConfettiCannon firing={showResult} />
      </View>
    );
  }

  // ── Saving state ──
  if (saving) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: PALETTE.cream }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
        <Text style={[styles.loadingText, { color: PALETTE.textMid }]}>
          On enregistre ton profil...
        </Text>
      </View>
    );
  }

  const stepInfo = getStepData();

  // Label for progress
  const stepLabels = [
    'Astro', 'Sports', 'Loisirs', 'Photos', 'Localisation', 'Situation', 'Relation',
    'Énergie', 'Planning', 'Conversation', 'Vérification',
  ];

  return (
    <View style={[styles.container, { backgroundColor: PALETTE.cream }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={step > 0 ? handleBack : () => router.replace('/(tabs)')}
          activeOpacity={0.7}
          style={styles.topBarButton}
        >
          <Ionicons
            name={step > 0 ? 'chevron-back' : 'close'}
            size={22}
            color={PALETTE.textMid}
          />
        </TouchableOpacity>
        <Text style={[styles.stepCounter, { color: PALETTE.textLight }]}>
          {stepLabels[step] || ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: PALETTE.border }]}>
        <RNAnimated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Step content */}
      <RNAnimated.View
        style={[
          styles.contentArea,
          {
            opacity: slideAnim.interpolate({
              inputRange: [0, 30],
              outputRange: [1, 0],
            }),
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                }),
              },
            ],
          },
        ]}
      >
        {stepInfo.component}
      </RNAnimated.View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Step dots */}
        <View style={styles.dotsContainer}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dotIndicator,
                {
                  backgroundColor: i === step ? PALETTE.rose : PALETTE.border,
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Done button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !stepInfo.canProceed && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!stepInfo.canProceed || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {step < TOTAL_STEPS - 1 ? 'Continuer' : 'Terminer'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={PALETTE.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Relationship Type Step ──
function RelationshipStep({ options, selected, onSelect }) {
  const [animScale] = useState(() => new RNAnimated.Value(1));
  console.log(options);

  if (!options || options.length === 0) {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <View style={[styles.iconCircle, { backgroundColor: PALETTE.lavenderPale }]}>
            <Ionicons name="heart-circle" size={32} color={PALETTE.rose} />
          </View>
          <Text style={styles.stepTitle}>Type de relation</Text>
          <Text style={styles.stepSubtitle}>Que recherches-tu sur Palz ?</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={PALETTE.rose} />
        </View>
      </View>
    );
  }

  const getIconForTitle = (title) => {
    const iconMap = {
      'Amitié': 'people',
      'Relation sérieuse': 'heart',
      'Rencontres légères': 'chatbubbles',
      'Amitié & plus': 'sparkles',
      'Sorties': 'cafe',
    };
    return iconMap[title] || 'search';
  };

  const getColorForTitle = (title) => {
    const colorMap = {
      'Amitié': PALETTE.lavender,
      'Relation sérieuse': PALETTE.rose,
      'Rencontres légères': '#FFD6A5',
      'Amitié & plus': '#B5D8E8',
      'Sorties': '#C8E6C9',
    };
    return colorMap[title] || PALETTE.roseLight;
  };

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.lavenderPale }]}>
          <Ionicons name="heart-circle" size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>Que recherches-tu ?</Text>
        <Text style={styles.stepSubtitle}>
          Choisis le type de relation qui te correspond
        </Text>
      </View>

      <View style={styles.relationContainer}>
        {options.map((option, index) => {
          const isSelected = selected === option.id;
          const accentColor = getColorForTitle(option.title);

          return (
            <TouchableOpacity
              key={option.id || index}
              style={[
                styles.relationCard,
                isSelected && {
                  borderColor: accentColor,
                  backgroundColor: isSelected ? accentColor + '20' : PALETTE.white,
                  shadowColor: accentColor,
                  shadowOpacity: 0.25,
                  elevation: isSelected ? 8 : 2,
                },
              ]}
              onPress={() => {
                RNAnimated.sequence([
                  RNAnimated.timing(animScale, {
                    toValue: 0.95,
                    duration: 80,
                    useNativeDriver: true,
                  }),
                  RNAnimated.timing(animScale, {
                    toValue: 1,
                    duration: 80,
                    useNativeDriver: true,
                  }),
                ]).start();
                onSelect(option.id);
              }}
              activeOpacity={0.85}
            >
              {/* Icône décorative */}
              <View style={[
                styles.relationIconWrap,
                {
                  backgroundColor: isSelected ? accentColor : accentColor + '40',
                  shadowColor: accentColor,
                  shadowOpacity: isSelected ? 0.4 : 0.1,
                },
              ]}>
                <Ionicons
                  name={getIconForTitle(option.title)}
                  size={28}
                  color={isSelected ? PALETTE.white : accentColor}
                />
              </View>

              <View style={styles.relationTextWrap}>
                <Text style={[
                  styles.relationTitle,
                  isSelected && { color: accentColor },
                ]}>
                  {option.title}
                </Text>
                {option.description && (
                  <Text style={styles.relationDesc}>
                    {option.description}
                  </Text>
                )}
              </View>

              {isSelected && (
                <View style={[styles.relationCheck, { backgroundColor: accentColor }]}>
                  <Ionicons name="checkmark" size={18} color={PALETTE.white} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.relationHint}>
        Tu pourras modifier ce choix plus tard dans tes paramètres
      </Text>
    </View>
  );
}

// ── Value labels (outside component for perf) ──
const VALUE_LABELS = {
  social_energy: {
    1: "J'apprécie mes moments de calme",
    2: 'Je préfère les petites rencontres',
    3: 'Les interactions sociales me fatiguent',
    4: "C'est parfois sympa, mais souvent épuisant",
    5: 'Ça dépend des jours',
    6: "J'aime bien sortir",
    7: "Les gens me donnent de l'énergie",
    8: "J'adore les bonnes fêtes",
    9: 'Je ne me lasse presque jamais des gens',
    10: 'Ne nous arrêtons jamais !',
  },
  planning_style: {
    1: 'Je planifie tout',
    2: 'Les routines me rassurent',
    3: "J'aime savoir à l'avance",
    4: 'Mieux vaut planifier',
    5: 'Je me laisse porter par le courant',
    6: "La spontanéité, c'est sympa",
    7: 'À la dernière minute, ça marche',
    8: 'Les surprises me stimulent',
    9: 'Des plans ? Quels plans ?',
    10: 'Je fais tout au feeling !',
  },
  conversation_depth: {
    1: "Les petites discussions, c'est sympa",
    2: 'Ça permet de garder les choses simples',
    3: 'Je préfère les discussions légères',
    4: "Le décontracté, c'est confortable",
    5: 'Les deux ont leur place',
    6: "J'aime aller au fond des choses",
    7: 'Les discussions qui ont du sens brillent',
    8: 'Les conversations profondes me dynamisent',
    9: "J'ai soif de profondeur",
    10: "Parlons de l'univers !",
  },
};

// ── Compatibility Question Card ──
function CompatibilityCard({ question, value, onValueChange }) {
  const labels = VALUE_LABELS[question.id] || {};
  const dotAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePress = useCallback((num) => {
    RNAnimated.sequence([
      RNAnimated.timing(dotAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      RNAnimated.timing(dotAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
    onValueChange(num);
  }, [dotAnim, onValueChange]);

  // Render a row of 5 dots with its own track
  const renderDotRow = (startNum, endNum) => {
    const rowValue = Math.max(0, Math.min(endNum, value - (startNum - 1)));
    const trackFillPct = rowValue > 0 ? ((rowValue - 1) / (endNum - startNum)) * 100 : 0;

    return (
      <View key={startNum} style={styles.compatRowContainer}>
        <View style={[styles.compatRowTrack, { backgroundColor: PALETTE.border }]}>
          <View
            style={[
              styles.compatRowTrackFill,
              {
                backgroundColor: PALETTE.rose,
                width: `${trackFillPct}%`,
              },
            ]}
          />
        </View>
        <View style={styles.compatDotsWrapper}>
          {Array.from({ length: endNum - startNum + 1 }, (_, i) => startNum + i).map((num) => {
            const isFilled = num <= value;
            const isSelected = num === value;
            return (
              <TouchableOpacity
                key={num}
                onPress={() => handlePress(num)}
                activeOpacity={0.7}
                style={styles.compatDotContainer}
              >
                <RNAnimated.View
                  style={[
                    styles.compatDot,
                    {
                      transform: [{ scale: isSelected ? dotAnim : 1 }],
                      backgroundColor: isFilled ? PALETTE.rose : PALETTE.white,
                      borderColor: isFilled ? PALETTE.rose : PALETTE.roseLight,
                      shadowOpacity: isSelected ? 0.35 : 0.08,
                      shadowColor: isFilled ? PALETTE.rose : PALETTE.shadow,
                      elevation: isSelected ? 6 : 2,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.compatDotText,
                      { color: isFilled ? PALETTE.white : PALETTE.roseLight },
                    ]}
                  >
                    {num}
                  </Text>
                </RNAnimated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconCircle, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name={question.icon} size={32} color={PALETTE.rose} />
        </View>
        <Text style={styles.stepTitle}>{question.title}</Text>
        <Text style={styles.stepSubtitle}>{question.question}</Text>
      </View>

      <View style={styles.compatSection}>
        {/* Endpoint labels */}
        <View style={styles.sliderLabels}>
          <Text style={[styles.sliderLabel, { color: PALETTE.textLight }]} numberOfLines={2}>
            {question.lowLabel}
          </Text>
          <Text style={[styles.sliderLabel, styles.sliderLabelRight, { color: PALETTE.textLight }]} numberOfLines={2}>
            {question.highLabel}
          </Text>
        </View>

        {/* Two rows of dots with tracks */}
        <View style={styles.compatTrackContainer}>
          {renderDotRow(1, 5)}
          {renderDotRow(6, 10)}
        </View>

        {/* Selected value display */}
        <View style={styles.selectedValueSection}>
          <Text style={[styles.selectedValueNumber, { color: PALETTE.rose }]}>
            {value}
          </Text>
          <Text style={[styles.selectedValueLabel, { color: PALETTE.textDark }]} numberOfLines={2}>
            {labels[value] || ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Progress
  progressBg: {
    height: 4,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PALETTE.rose,
    borderRadius: 2,
  },

  // Content area
  contentArea: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  stepHeader: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: PALETTE.textDark,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: PALETTE.textMid,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  selectionCount: {
    fontSize: 13,
    color: PALETTE.rose,
    fontWeight: '600',
    marginTop: -2,
  },

  // Pickers
  pickerScroll: {
    flex: 1,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 10,
  },
  optionCard: {
    width: (SCREEN_WIDTH - 60) / 3,
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
  },
  optionCardSelected: {
    borderColor: PALETTE.rose,
    backgroundColor: PALETTE.rosePale,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconWrapSelected: {
    backgroundColor: PALETTE.rose,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.textDark,
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: PALETTE.rose,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: PALETTE.textDark,
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  chipSelected: {
    backgroundColor: PALETTE.rose,
    borderColor: PALETTE.rose,
  },
  chipText: {
    fontSize: 14,
    color: PALETTE.textDark,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: PALETTE.white,
    fontWeight: '700',
  },
  emptySearch: {
    textAlign: 'center',
    color: PALETTE.textLight,
    fontSize: 14,
    paddingVertical: 20,
    width: '100%',
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.25,
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: PALETTE.roseLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.rosePale,
    gap: 4,
  },
  addPhotoLabel: {
    fontSize: 12,
    color: PALETTE.rose,
    fontWeight: '600',
  },
  photoHint: {
    textAlign: 'center',
    color: PALETTE.textLight,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 20,
  },

  // Location
  locationContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 40,
  },
  locationIllustration: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButton: {
    backgroundColor: PALETTE.rose,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  locationButtonText: {
    color: PALETTE.white,
    fontSize: 17,
    fontWeight: '700',
  },
  locationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  locationSuccessText: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.textDark,
  },
  locationCoords: {
    fontSize: 12,
    color: PALETTE.textLight,
    width: '100%',
    textAlign: 'center',
  },
  skipLink: {
    color: PALETTE.textLight,
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // Situation
  situationList: {
    gap: 10,
    paddingTop: 10,
  },
  situationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  situationCardSelected: {
    borderColor: PALETTE.rose,
    backgroundColor: PALETTE.rosePale,
  },
  situationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  situationIconWrapSelected: {
    backgroundColor: PALETTE.rose,
  },
  situationLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.textDark,
  },
  situationLabelSelected: {
    color: PALETTE.rose,
    fontWeight: '700',
  },

  // Compatibility
  compatSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 12,
  },
  sliderLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: PALETTE.textLight,
    lineHeight: 18,
    textAlign: 'left',
    maxWidth: '50%',
  },
  sliderLabelRight: {
    textAlign: 'right',
  },

  // Visual track + dots (2 rows)
  compatTrackContainer: {
    gap: 8,
    paddingHorizontal: 4,
  },
  compatRowContainer: {
    position: 'relative',
    paddingVertical: 6,
  },
  compatRowTrack: {
    position: 'absolute',
    top: '50%',
    left: 16,
    right: 16,
    height: 5,
    borderRadius: 2.5,
    marginTop: -2.5,
  },
  compatRowTrackFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  compatDotsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  compatDotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  compatDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  compatDotText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Selected value
  selectedValueSection: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    minHeight: 70,
    justifyContent: 'center',
  },
  selectedValueNumber: {
    fontSize: 40,
    fontWeight: '800',
  },
  selectedValueLabel: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // Bottom section
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
    paddingTop: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dotIndicator: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    height: 56,
    borderRadius: 20,
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
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: PALETTE.white,
    fontSize: 18,
    fontWeight: '700',
  },

  // Loading
  loadingText: {
    fontSize: 16,
    marginTop: 20,
    fontWeight: '500',
  },

  // Result
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  resultContent: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  resultTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: PALETTE.textDark,
    letterSpacing: -0.5,
  },
  resultSubtitle: {
    fontSize: 16,
    color: PALETTE.textMid,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultCard: {
    width: '100%',
    borderRadius: 22,
    padding: 20,
    gap: 8,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.textDark,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  resultTagline: {
    fontSize: 15,
    color: PALETTE.textLight,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Video verification
  subtitleConfirmation: {
    fontSize: 15,
    color: PALETTE.textMid,
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  instruction: {
    fontSize: 14,
    color: PALETTE.textDark,
    lineHeight: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  videoActionWrap: {
    alignItems: 'center',
    marginVertical: 24,
  },
  videoStatusWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  videoStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.textDark,
    textAlign: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PALETTE.rose,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 28,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  recordButtonText: {
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: '700',
  },
  skipVideoBtn: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  skipLink: {
    color: PALETTE.textLight,
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // Relation
  relationContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  relationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 18,
    gap: 16,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  relationIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  relationTextWrap: {
    flex: 1,
    gap: 4,
  },
  relationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.textDark,
    letterSpacing: -0.3,
  },
  relationDesc: {
    fontSize: 13,
    color: PALETTE.textMid,
    lineHeight: 18,
  },
  relationCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  relationHint: {
    textAlign: 'center',
    fontSize: 12,
    color: PALETTE.textLight,
    fontStyle: 'italic',
    marginBottom: 4,
  },
});
