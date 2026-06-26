import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import MapPicker from '@/components/MapPicker';
import { eventsApi } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';

const TONIGHT_SUGGESTIONS = [
  { category: 'bar',        title: 'Bar entre copines',      emoji: '🍸' },
  { category: 'restaurant', title: 'Resto du soir',          emoji: '🍝' },
  { category: 'cinema',     title: 'Cinéma en groupe',       emoji: '🎬' },
  { category: 'cafe',       title: 'Café & dessert',         emoji: '☕' },
  { category: 'parc',       title: 'Balade au parc',         emoji: '🌳' },
  { category: 'sport',      title: 'Sport en soirée',        emoji: '🏋️' },
];

// Returns a Date set to tonight at 20h
function tonightAt(h = 20, min = 0) {
  const d = new Date();
  d.setHours(h, min, 0, 0);
  // If it's already past the suggested time, bump to +1h from now
  if (d <= new Date()) {
    d.setTime(Date.now() + 90 * 60 * 1000);
  }
  return d;
}

const CATEGORIES = [
  { key: 'bar',        label: 'Bar',        icon: 'wine-outline',       color: '#C4325E' },
  { key: 'bowling',    label: 'Bowling',    icon: 'trophy-outline',     color: '#C4325E' },
  { key: 'cinema',     label: 'Cinéma',     icon: 'film-outline',       color: '#C4325E' },
  { key: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline', color: '#C4325E' },
  { key: 'sport',      label: 'Sport',      icon: 'fitness-outline',    color: '#C4325E' },
  { key: 'cafe',       label: 'Café',       icon: 'cafe-outline',       color: '#C4325E' },
  { key: 'plage',      label: 'Plage',      icon: 'sunny-outline',      color: '#C4325E' },
  { key: 'parc',       label: 'Parc',       icon: 'leaf-outline',       color: '#C4325E' },
  { key: 'autre',      label: 'Autre',      icon: 'star-outline',       color: '#C4325E' },
];

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 20;

// Returns a Date clamped to the next 30 min mark (for default time)
function defaultStartTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 90); // 90 min from now
  d.setSeconds(0, 0);
  return d;
}

// expo-router params can come back as arrays (or non-strings) when the same
// route is pushed several times — always normalize to a plain string.
function paramToString(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

export default function CreateEventScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const params = useLocalSearchParams();
  const paramTitle = paramToString(params.title);
  const paramCategory = paramToString(params.category);
  const paramTonight = paramToString(params.tonight);

  const [title, setTitle] = useState(paramTitle);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(
    CATEGORIES.find((c) => c.key === paramCategory) ? paramCategory : 'bar'
  );
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationMode, setLocationMode] = useState('text'); // 'text' | 'gps' | 'map'
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [maxMembers, setMaxMembers] = useState(10);
  const [startsAt, setStartsAt] = useState(
    paramTonight === 'true' ? tonightAt() : defaultStartTime()
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('date'); // for Android combined picker

  const [loading, setLoading] = useState(false);

  const formatDate = (d) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const formatTime = (d) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const onDateChange = (event, selected) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
    if (!selected) return;
    const next = new Date(startsAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setStartsAt(next);
    if (Platform.OS === 'android' && pickerMode === 'date') {
      setPickerMode('time');
      setShowTimePicker(true);
    }
  };

  const onTimeChange = (event, selected) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      setPickerMode('date');
    }
    if (!selected) return;
    const next = new Date(startsAt);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStartsAt(next);
  };

  const handleGPSLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la localisation pour utiliser ta position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setLatitude(lat);
      setLongitude(lng);

      // Reverse geocode to get readable address
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const parts = [geo?.name, geo?.street, geo?.city].filter(Boolean);
        const addr = parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setLocationName(addr);
      } catch {
        setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
      setLocationMode('gps');
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer ta position.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Titre requis', 'Donne un nom à ton événement.');
    if (!locationName.trim()) return Alert.alert('Lieu requis', 'Indique où ça se passe.');

    const now = new Date();
    const maxFuture = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    if (startsAt <= now) {
      return Alert.alert('Heure invalide', "L'événement doit démarrer dans le futur.");
    }
    if (startsAt > maxFuture) {
      return Alert.alert('Trop loin', "L'événement doit démarrer dans les 72 prochaines heures.");
    }

    setLoading(true);
    try {
      const res = await eventsApi.createEvent({
        title: title.trim(),
        description: description.trim() || null,
        category,
        location_name: locationName.trim(),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        max_members: maxMembers,
        starts_at: startsAt.toISOString(),
      });
      const eventId = res.data?.event?.id;
      router.replace(`/(tabs)/event/${eventId}`);
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.error || "Impossible de créer l'événement.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCat = CATEGORIES.find((c) => c.key === category);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Nouvel sortie</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Ce soir — quick create ── */}
        <View style={[styles.tonightBanner, { backgroundColor: '#1A1035' }]}>
          <View style={styles.tonightBannerTop}>
            <Text style={styles.tonightEmoji}>🌙</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tonightBannerTitle}>Ce soir</Text>
              <Text style={styles.tonightBannerSub}>Crée une sortie pour ce soir en un tap</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tonightSuggestScroll}
          >
            {TONIGHT_SUGGESTIONS.map((s, i) => {
              const cat = CATEGORIES.find((c) => c.key === s.category);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.tonightSuggestCard, { borderColor: (cat?.color || PALETTE.rose) + '40' }]}
                  onPress={() => {
                    setTitle(s.title);
                    setCategory(s.category);
                    setStartsAt(tonightAt());
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.tonightSuggestIcon, { backgroundColor: (cat?.color || PALETTE.rose) + '20' }]}>
                    <Ionicons name={cat?.icon || 'star-outline'} size={22} color={cat?.color || PALETTE.rose} />
                  </View>
                  <Text style={styles.tonightSuggestTitle}>{s.emoji} {s.title}</Text>
                  <Text style={[styles.tonightSuggestCat, { color: cat?.color || PALETTE.rose }]}>{cat?.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Section: Category */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Catégorie</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.catItem,
                {
                  backgroundColor:
                    category === cat.key ? cat.color + '20' : colors.backgroundSelected,
                  borderWidth: 2,
                  borderColor: category === cat.key ? cat.color : 'transparent',
                },
              ]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon} size={24} color={category === cat.key ? cat.color : colors.textSecondary} />
              <Text
                style={[
                  styles.catLabel,
                  { color: category === cat.key ? cat.color : colors.textSecondary },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section: Title */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Titre</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.backgroundSelected, color: colors.text }]}
          placeholder={`Ex: ${selectedCat?.label} au centre-ville`}
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Section: Location */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Lieu</Text>

        {/* Location mode toggle — 3 options */}
        <View style={[styles.locModeRow, { backgroundColor: colors.backgroundSelected }]}>
          <TouchableOpacity
            style={[styles.locModeBtn, locationMode === 'text' && { backgroundColor: PALETTE.rose }]}
            onPress={() => setLocationMode('text')}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={14} color={locationMode === 'text' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.locModeBtnText, { color: locationMode === 'text' ? '#fff' : colors.textSecondary }]}>
              Saisir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locModeBtn, locationMode === 'gps' && { backgroundColor: '#10B981' }]}
            onPress={handleGPSLocation}
            disabled={gpsLoading}
            activeOpacity={0.7}
          >
            {gpsLoading ? (
              <ActivityIndicator size="small" color={locationMode === 'gps' ? '#fff' : colors.textSecondary} />
            ) : (
              <Ionicons name="navigate-outline" size={14} color={locationMode === 'gps' ? '#fff' : colors.textSecondary} />
            )}
            <Text style={[styles.locModeBtnText, { color: locationMode === 'gps' ? '#fff' : colors.textSecondary }]}>
              GPS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locModeBtn, locationMode === 'map' && { backgroundColor: '#C4325E' }]}
            onPress={() => setShowMap(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="map-outline" size={14} color={locationMode === 'map' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.locModeBtnText, { color: locationMode === 'map' ? '#fff' : colors.textSecondary }]}>
              Carte
            </Text>
          </TouchableOpacity>
        </View>

        {locationMode === 'text' ? (
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundSelected, color: colors.text }]}
            placeholder="Ex: Bar le Comptoir, Paris 11e"
            placeholderTextColor={colors.textSecondary}
            value={locationName}
            onChangeText={(v) => { setLocationName(v); setLatitude(null); setLongitude(null); }}
            maxLength={255}
          />
        ) : (
          <TouchableOpacity
            style={[styles.gpsResult, { backgroundColor: colors.backgroundSelected }]}
            onPress={locationMode === 'map' ? () => setShowMap(true) : handleGPSLocation}
            activeOpacity={0.7}
          >
            <Ionicons
              name={locationMode === 'map' ? 'map' : 'location'}
              size={18}
              color={locationMode === 'map' ? '#C4325E' : '#10B981'}
            />
            <Text style={[styles.gpsResultText, { color: locationName ? colors.text : colors.textSecondary }]} numberOfLines={2}>
              {locationName || (locationMode === 'map' ? 'Appuie pour ouvrir la carte' : 'Appuie pour détecter ta position')}
            </Text>
            {locationName && (
              <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}

        {/* Map picker modal */}
        <MapPicker
          visible={showMap}
          onClose={() => setShowMap(false)}
          initialLat={latitude ?? 48.8566}
          initialLng={longitude ?? 2.3522}
          onConfirm={async ({ latitude: lat, longitude: lng }) => {
            setShowMap(false);
            setLatitude(lat);
            setLongitude(lng);
            setLocationMode('map');
            try {
              const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
              const parts = [geo?.name, geo?.street, geo?.city].filter(Boolean);
              setLocationName(parts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            } catch {
              setLocationName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            }
          }}
        />

        {/* Section: Date & Time */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Date & Heure</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateBtn, { backgroundColor: colors.backgroundSelected, flex: 1 }]}
            onPress={() => {
              setPickerMode('date');
              setShowDatePicker(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.dateBtnText, { color: colors.text }]}>{formatDate(startsAt)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => {
              if (Platform.OS === 'android') {
                setPickerMode('time');
                setShowTimePicker(true);
              } else {
                setShowTimePicker(true);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.dateBtnText, { color: colors.text }]}>{formatTime(startsAt)}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={startsAt}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
            minimumDate={new Date()}
            maximumDate={new Date(Date.now() + 72 * 60 * 60 * 1000)}
            onChange={onDateChange}
            locale="fr-FR"
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={startsAt}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
            onChange={onTimeChange}
            locale="fr-FR"
          />
        )}

        {/* Section: Max members */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          Nombre de places — <Text style={{ color: PALETTE.rose, fontWeight: '700' }}>{maxMembers}</Text>
        </Text>
        <View style={styles.membersRow}>
          <TouchableOpacity
            style={[styles.memberBtn, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => setMaxMembers((p) => Math.max(MIN_MEMBERS, p - 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={[styles.membersTrack, { backgroundColor: colors.backgroundSelected }]}>
            <View
              style={[
                styles.membersFill,
                {
                  backgroundColor: PALETTE.rose,
                  width: `${((maxMembers - MIN_MEMBERS) / (MAX_MEMBERS - MIN_MEMBERS)) * 100}%`,
                },
              ]}
            />
          </View>
          <TouchableOpacity
            style={[styles.memberBtn, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => setMaxMembers((p) => Math.min(MAX_MEMBERS, p + 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Section: Description */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Description (optionnelle)</Text>
        <TextInput
          style={[styles.input, styles.textarea, { backgroundColor: colors.backgroundSelected, color: colors.text }]}
          placeholder="Donne plus de détails sur la sortie..."
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <View style={[styles.confirmationBox, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={PALETTE.rose} />
          <Text style={[styles.confirmationText, { color: colors.textSecondary }]}>
            En créant cet événement, tu confirmes être présente. Les absences non justifiées peuvent mener à des restrictions de compte.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Créer l'événement</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 40,
    gap: 8,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: 0.3,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    minWidth: 72,
  },
  catLabel: { fontSize: 11, fontWeight: '600' },

  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  textarea: {
    minHeight: 90,
    paddingTop: 14,
  },

  locModeRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  locModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  locModeBtnText: { fontSize: 13, fontWeight: '700' },
  gpsResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  gpsResultText: { flex: 1, fontSize: 14, lineHeight: 20 },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dateBtnText: { fontSize: 14, fontWeight: '600' },

  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  membersFill: { height: 8, borderRadius: 4 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    backgroundColor: PALETTE.rose,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // ── Confirmation notice ──
  confirmationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  confirmationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  // ── Ce soir banner ──
  tonightBanner: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#C4325E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  tonightBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tonightEmoji: { fontSize: 28 },
  tonightBannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  tonightBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    marginTop: 1,
  },
  tonightSuggestScroll: {
    gap: 10,
  },
  tonightSuggestCard: {
    width: 130,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
  },
  tonightSuggestIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tonightSuggestTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 17,
  },
  tonightSuggestCat: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
});
