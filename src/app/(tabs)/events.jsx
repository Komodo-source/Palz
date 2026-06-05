import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { eventsApi, messagesApi, swipesApi } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';
import { useSnackbar } from '@/contexts/snackbar';

const CATEGORY_META = {
  bar:        { label: 'Bar',        icon: 'wine-outline',       color: '#8B5CF6' },
  bowling:    { label: 'Bowling',    icon: 'trophy-outline',     color: '#3B82F6' },
  cinema:     { label: 'Cinéma',     icon: 'film-outline',       color: '#F59E0B' },
  restaurant: { label: 'Restaurant', icon: 'restaurant-outline', color: '#10B981' },
  sport:      { label: 'Sport',      icon: 'fitness-outline',    color: '#EF4444' },
  cafe:       { label: 'Café',       icon: 'cafe-outline',       color: '#92400E' },
  plage:      { label: 'Plage',      icon: 'sunny-outline',      color: '#F97316' },
  parc:       { label: 'Parc',       icon: 'leaf-outline',       color: '#22C55E' },
  autre:      { label: 'Autre',      icon: 'star-outline',       color: '#FF8FA3' },
};

const FILTERS = [
  { key: null,    label: 'Tous', icon : "apps-outline"},
  { key: 'tonight', label: "Ce soir", icon: "moon-outline"},
  { key: 'joined', label: 'Rejoints', icon: "checkmark-circle-outline"},
];

const CATEGORY_FILTERS = [
  { key: null, label: 'Toutes', icon: 'grid-outline', color: '#FF8FA3' },
  ...Object.entries(CATEGORY_META).map(([key, v]) => ({ key, ...v })),
];

const TONIGHT_CREATE_SUGGESTIONS = [
  { category: 'bar',        title: 'Bar entre copines',      emoji: '🍸' },
  { category: 'restaurant', title: 'Resto en groupe',        emoji: '🍝' },
  { category: 'cinema',     title: 'Séance ciné',            emoji: '🎬' },
  { category: 'cafe',       title: 'Café & dessert',         emoji: '☕' },
  { category: 'parc',       title: 'Balade au parc',         emoji: '🌳' },
];

// ── Vibe / Personality → Category mapping for personalized suggestions ──
const VIBE_TO_CATEGORIES = {
  'Créative':    ['cafe', 'parc', 'autre'],
  'Sportive':    ['sport', 'plage', 'bowling'],
  'Homebody':    ['cinema', 'cafe', 'restaurant'],
  'Spontanée':   ['bar', 'restaurant', 'cinema'],
  'Ambitieuse':  ['bowling', 'sport', 'autre'],
  'Artiste':     ['cafe', 'parc', 'musee'],
  'Voyageuse':   ['parc', 'plage', 'cafe'],
  'Bookworm':    ['cafe', 'parc', 'cinema'],
  'Foodie':      ['restaurant', 'cafe', 'bar'],
  'Geek':        ['cinema', 'bowling', 'cafe'],
};

const DISPO_TO_CATEGORIES = {
  'Soirées':     ['bar', 'restaurant', 'cinema'],
  'Brunchs':     ['restaurant', 'cafe', 'parc'],
  'Voyages':     ['parc', 'plage', 'autre'],
  'Sport':       ['sport', 'plage', 'bowling'],
  'Musées/Expos': ['cafe', 'parc', 'autre'],
  'Concerts':    ['bar', 'cinema', 'autre'],
  'Apéros':      ['bar', 'restaurant', 'cafe'],
  'Randos':      ['parc', 'plage', 'sport'],
  'Cinéma':      ['cinema', 'cafe', 'bar'],
  'Yoga':        ['parc', 'plage', 'cafe'],
};

// Social energy level → event category mapping
const SOCIAL_ENERGY_MAP = {
  high:   ['bar', 'sport', 'bowling', 'concert'],
  medium: ['restaurant', 'cinema', 'cafe', 'plage'],
  low:    ['cafe', 'parc', 'cinema', 'restaurant'],
};

const ENERGY_KEYWORDS = {
  high:   ['Sportive', 'Spontanée', 'Ambitieuse', 'Soirées', 'Sport', 'Concerts', 'Apéros'],
  medium: ['Créative', 'Voyageuse', 'Foodie', 'Brunchs', 'Musées/Expos', 'Cinéma'],
  low:    ['Homebody', 'Bookworm', 'Geek', 'Artiste', 'Yoga', 'Randos'],
};


const OUTDOOR_CATEGORIES = ['plage', 'parc', 'sport'];

const VIBE_TO_STYLE = {
  'Homebody': 'soirée cocooning 🏠', 'Bookworm': 'lecture & café ☕',
  'Sportive': 'aventures outdoor 🏃', 'Voyageuse': 'explorations urbaines 🗺️',
  'Spontanée': 'sorties impromptues ✨', 'Foodie': 'foodie dates 🍝',
  'Geek': 'gaming & séries 🎮', 'Créative': 'créa & culture 🎨',
  'Ambitieuse': 'dépassement de soi 💪', 'Artiste': 'art & culture 🎭',
};
const DISPO_TO_STYLE = {
  'Soirées': 'late-night talks 🌙', 'Brunchs': 'brunch & bonne humeur 🥞',
  'Apéros': 'apéro entre copines 🥂', 'Cinéma': 'movie nights 🎬',
  'Sport': 'sport & wellbeing 💪', 'Concerts': 'concerts & musique 🎵',
  'Voyages': 'road trips & escapes ✈️', 'Randos': 'randos & nature 🌿',
  'Yoga': 'zen & bien-être 🧘', 'Musées/Expos': 'culture & expos 🖼️',
};

function getTopVibe(user) {
  if (!user) return 'moments de partage 💕';
  const labels = user.labels && typeof user.labels === 'object' ? user.labels : {};
  const vibes = Array.isArray(labels.vibe) ? labels.vibe : [];
  const dispos = Array.isArray(labels.dispo) ? labels.dispo : [];
  for (const v of vibes) if (VIBE_TO_STYLE[v]) return VIBE_TO_STYLE[v];
  for (const d of dispos) if (DISPO_TO_STYLE[d]) return DISPO_TO_STYLE[d];
  return 'moments de partage 💕';
}

function timeUntil(dateStr) {
  const diff = new Date(dateStr) - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
  return `${m}min`;
}

function getWeatherInfo(code, precipProb) {
  if (code === 0 || code === 1) return { emoji: '☀️', label: 'Beau', ok: true };
  if (code === 2 || code === 3) return { emoji: '⛅', label: 'Nuageux', ok: true };
  if (code >= 45 && code <= 48) return { emoji: '🌫️', label: 'Brouillard', ok: false };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: '🌧️', label: 'Pluie', ok: false };
  if (code >= 71 && code <= 77) return { emoji: '❄️', label: 'Neige', ok: false };
  if (code >= 95) return { emoji: '⛈️', label: 'Orage', ok: false };
  if (precipProb > 60) return { emoji: '🌦️', label: 'Averses', ok: false };
  return { emoji: '🌤️', label: 'Variable', ok: true };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatEventTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === todayStr) return `Aujourd'hui à ${time}`;
  if (date.toDateString() === tomorrowStr) return `Demain à ${time}`;
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ` à ${time}`;
}

export default function EventsScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const snackbar = useSnackbar();

  const [eventsRaw, setEventsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!userLocation) return;
    const fetch_ = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${userLocation.latitude.toFixed(4)}&longitude=${userLocation.longitude.toFixed(4)}&daily=weathercode,precipitation_probability_max&timezone=auto&forecast_days=1`;
        const res = await fetch(url);
        const data = await res.json();
        const code = data.daily?.weathercode?.[0] ?? 0;
        const precip = data.daily?.precipitation_probability_max?.[0] ?? 0;
        setWeather(getWeatherInfo(code, precip));
      } catch {}
    };
    fetch_();
  }, [userLocation]);

  // Sort by distance when nearMe is on; always strip events that have already started
  const events = useMemo(() => {
    const now = new Date();
    const upcoming = eventsRaw.filter((e) => !e.starts_at || new Date(e.starts_at) > now);
    if (!nearMe || !userLocation) return upcoming;
    return [...upcoming].sort((a, b) => {
      const da =
        a.latitude && a.longitude
          ? haversineKm(userLocation.latitude, userLocation.longitude, parseFloat(a.latitude), parseFloat(a.longitude))
          : 9999;
      const db =
        b.latitude && b.longitude
          ? haversineKm(userLocation.latitude, userLocation.longitude, parseFloat(b.latitude), parseFloat(b.longitude))
          : 9999;
      return da - db;
    });
  }, [eventsRaw, nearMe, userLocation]);

  // Events starting tonight (today, 17h–23h59, not yet started)
  const ceSoirEvents = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    return eventsRaw.filter((e) => {
      const d = new Date(e.starts_at);
      return (
        d.toDateString() === todayStr &&
        d.getHours() >= 17 &&
        d > now
      );
    });
  }, [eventsRaw]);

  const fetchEvents = useCallback(async (filter, category) => {
    try {
      const res = await eventsApi.getEvents(filter, category);
      setEventsRaw(res.data?.events ?? []);
    } catch (err) {
      console.error('Failed to load events:', err);
      Alert.alert('Erreur', "Impossible de charger les événements.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await eventsApi.getSuggested();
      setSuggestions(res.data?.suggestions ?? []);
    } catch {
      // Non-critical, silently ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEvents(activeFilter, activeCategory);
      fetchSuggestions();
    }, [fetchEvents, fetchSuggestions, activeFilter, activeCategory, userLocation])
  );

  const handleFilterChange = (key) => {
    setActiveFilter(key);
    //setLoading(true);
    fetchEvents(key, activeCategory);
  };

  const handleCategoryChange = (key) => {
    setActiveCategory(key);
    setLoading(true);
    fetchEvents(activeFilter, key);
  };

  const handleNearMe = async () => {
    if (nearMe) {
      setNearMe(false);
      return;
    }
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la localisation pour voir les événements près de toi.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setNearMe(true);
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer ta position.');
    } finally {
      setLocLoading(false);
    }
  };

  const handleJoin = async (eventItem) => {
    if (eventItem.is_joined) {
      router.push(`/(tabs)/event/${eventItem.id}`);
      return;
    }
    setJoiningId(eventItem.id);
    try {
      await eventsApi.joinEvent(eventItem.id);
      setEventsRaw((prev) =>
        prev.map((e) =>
          e.id === eventItem.id
            ? { ...e, is_joined: true, member_count: e.member_count + 1 }
            : e
        )
      );
      snackbar.success(`Rejointe ! Tu participes à ${eventItem.title} 🎉`, 2500);
      router.push(`/(tabs)/event/${eventItem.id}`);
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.error || "Impossible de rejoindre l'événement.");
    } finally {
      setJoiningId(null);
    }
  };

  const renderCeSoirCard = (item) => {
    const meta = CATEGORY_META[item.category] || CATEGORY_META.autre;
    const isFull = item.member_count >= item.max_members;
    const spotsLeft = item.max_members - item.member_count;
    const time = new Date(item.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const until = timeUntil(item.starts_at);
    const isSoon = until && !until.includes('h');

    return (
      <TouchableOpacity
        key={String(item.id)}
        style={styles.ceSoirCard}
        onPress={() => router.push(`/(tabs)/event/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.ceSoirCardAccent, { backgroundColor: meta.color }]} />
        <View style={[styles.ceSoirCardIcon, { backgroundColor: meta.color + '28' }]}>
          <Ionicons name={meta.icon} size={26} color={meta.color} />
        </View>
        <View style={styles.ceSoirCardTimeRow}>
          <Text style={[styles.ceSoirCardTime, { color: meta.color }]}>{time}</Text>
          {until && (
            <View style={[styles.ceSoirUntilBadge, { backgroundColor: isSoon ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.09)' }]}>
              {isSoon && <View style={styles.ceSoirLiveDot} />}
              <Text style={[styles.ceSoirUntilText, { color: isSoon ? '#EF4444' : 'rgba(255,255,255,0.65)' }]}>{until}</Text>
            </View>
          )}
        </View>
        <Text style={styles.ceSoirCardTitle} numberOfLines={2}>{typeof item.title === 'string' ? item.title : ''}</Text>
        <View style={styles.ceSoirCardLocRow}>
          <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.38)" />
          <Text style={styles.ceSoirCardLoc} numberOfLines={1}>{typeof item.location_name === 'string' ? item.location_name : ''}</Text>
        </View>
        <View style={styles.ceSoirCardFooter}>
          <Text style={[styles.ceSoirCardSpots, {
            color: isFull ? '#EF4444' : spotsLeft <= 3 ? '#F59E0B' : 'rgba(255,255,255,0.5)',
          }]}>
            {isFull ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''}`}
          </Text>
          {item.is_joined && <Ionicons name="checkmark-circle" size={14} color="#10B981" />}
        </View>
      </TouchableOpacity>
    );
  };

  // Always show a create-suggestion card at end of horizontal scroll
  const renderCeSoirSuggestCard = () => {
    return (
      <TouchableOpacity
        key="create-tonight"
        style={[styles.ceSoirCard, styles.ceSoirCreateCard]}
        onPress={() => router.push({ pathname: '/(tabs)/event/create', params: { tonight: 'true' } })}
        activeOpacity={0.85}
      >
        <View style={[styles.ceSoirIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
        <Text style={styles.ceSoirCreateTitle}>Créer</Text>
        <Text style={styles.ceSoirCreateSub}>une sortie pour ce soir</Text>
      </TouchableOpacity>
    );
  };

  // ── Generate personalized suggestions from user's vibe/dispo labels ──
  const personalizedSuggestions = useMemo(() => {
    if (!user) return [];
    const rawLabels = parseDbJson(user.labels);
    const vibeLabels = rawLabels?.vibe || [];
    const dispoLabels = rawLabels?.dispo || [];

    // Determine social energy level
    const allLabels = [...vibeLabels, ...dispoLabels];
    let energyLevel = 'medium';
    for (const [level, keywords] of Object.entries(ENERGY_KEYWORDS)) {
      if (keywords.some((k) => allLabels.includes(k))) {
        energyLevel = level;
        break;
      }
    }

    // Collect matching categories from vibe + dispo labels
    const matchedCategories = new Set();
    vibeLabels.forEach((v) => {
      (VIBE_TO_CATEGORIES[v] || []).forEach((c) => matchedCategories.add(c));
    });
    dispoLabels.forEach((d) => {
      (DISPO_TO_CATEGORIES[d] || []).forEach((c) => matchedCategories.add(c));
    });
    // Also add energy-based suggestions
    (SOCIAL_ENERGY_MAP[energyLevel] || []).forEach((c) => matchedCategories.add(c));

    // Filter out categories that don't exist in our meta
    return [...matchedCategories]
      .filter((c) => CATEGORY_META[c])
      .slice(0, 5)
      .map((catKey) => {
        const meta = CATEGORY_META[catKey];
        return { category: catKey, meta, label: meta.label, icon: meta.icon, color: meta.color };
      });
  }, [user]);

  // ── Reason strings for personalized suggestions ──
  const getPersonalizedReason = (category) => {
    if (!user) return 'Suggestion personnalisée ✨';
    const rawLabels = parseDbJson(user.labels);
    const vibeLabels = rawLabels?.vibe || [];
    const dispoLabels = rawLabels?.dispo || [];
    if (vibeLabels.length > 0) return `Basé sur ton vibe ${vibeLabels[0]} ${vibeLabels[0] === 'Sportive' ? '🏃' : vibeLabels[0] === 'Créative' ? '🎨' : vibeLabels[0] === 'Foodie' ? '🍝' : vibeLabels[0] === 'Geek' ? '🎮' : vibeLabels[0] === 'Spontanée' ? '✨' : vibeLabels[0] === 'Homebody' ? '🏠' : vibeLabels[0] === 'Voyageuse' ? '✈️' : vibeLabels[0] === 'Bookworm' ? '📚' : vibeLabels[0] === 'Ambitieuse' ? '💪' : '🌸'}`;
    if (dispoLabels.length > 0) return `${dispoLabels[0]} · dispo 📅`;
    return 'Recommandé pour toi';
  };

  // ── Personalized Suggestions Section (personality, social energy, group dynamics) ──
  const PersonalizedSection = () => {
    if (personalizedSuggestions.length === 0 && suggestions.length === 0) return null;

    // Mix personalized + API suggestions
    const combined = [
      ...personalizedSuggestions.map((s) => ({
        key: `perso_${s.category}`,
        category: s.category,
        title: `${s.meta.label} entre copines`,
        reason: getPersonalizedReason(s.category),
        isPersonalized: true,
      })),
      ...suggestions.slice(0, 4).map((s, i) => ({ key: `api_${i}`, ...s, isPersonalized: false })),
    ].slice(0, 8);

    if (combined.length === 0) return null;

    return (
      <View style={styles.suggestSection}>
        <View style={styles.suggestHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.suggestTitle, { color: colors.text }]}>Pour toi</Text>
            <Text style={[styles.suggestSub, { color: colors.textSecondary }]}>
              Basé sur ta personnalité{user?.labels ? ' · ' : ''}
              {parseDbJson(user?.labels)?.vibe?.slice(0, 2).join(', ') || ''}
              {user?.labels ? ' ✨' : ''}
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestScroll}>
          {combined.map((s) => {
            const meta = CATEGORY_META[s.category] || CATEGORY_META.autre;
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.suggestCard,
                  { backgroundColor: s.isPersonalized ? colors.backgroundElement : colors.backgroundSelected },
                  s.isPersonalized && { borderColor: meta.color + '30', borderWidth: 1 },
                ]}
                onPress={() => router.push({ pathname: '/(tabs)/event/create', params: { category: s.category, title: s.title } })}
                activeOpacity={0.8}
              >
                <View style={[styles.suggestIconWrap, { backgroundColor: meta.color + '20' }]}>
                  <Ionicons name={meta.icon} size={22} color={meta.color} />
                </View>
                <Text style={[styles.suggestCardTitle, { color: colors.text }]} numberOfLines={2}>{typeof s.title === 'string' ? s.title : ''}</Text>
                <Text style={[styles.suggestCardReason, { color: colors.textSecondary }]} numberOfLines={1}>{typeof s.reason === 'string' ? s.reason : ''}</Text>
                <View style={[styles.suggestCreateBtn, { backgroundColor: meta.color + '18' }]}>
                  <Text style={[styles.suggestCreateText, { color: meta.color }]}>Créer</Text>
                  <Ionicons name="add" size={13} color={meta.color} />
                </View>
                {s.isPersonalized && (
                  <View style={[styles.persoBadge, { backgroundColor: meta.color + '15' }]}>
                    <Ionicons name="sparkles" size={8} color={meta.color} />
                    <Text style={[styles.persoBadgeText, { color: meta.color }]}>Personnalisé</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ── Weekly Friendship Recap ──
const CeSoirSection = () => {
    const firstUntil = ceSoirEvents[0] ? timeUntil(ceSoirEvents[0].starts_at) : null;

    return (
      <View style={styles.ceSoirSection}>
        {/* Header */}
        <View style={styles.ceSoirHeader}>
          <View style={styles.ceSoirHeaderLeft}>
            <View style={styles.ceSoirMoonBadge}>
              <Text style={styles.ceSoirMoonEmoji}>🌙</Text>
            </View>
            <View>
              <Text style={[styles.ceSoirSectionTitle, { color: colors.text }]}>Ce soir</Text>
              <Text style={[styles.ceSoirSectionSub, { color: colors.textSecondary }]}>
                {ceSoirEvents.length > 0
                  ? firstUntil
                    ? `Commence ${firstUntil}`
                    : `${ceSoirEvents.length} sortie${ceSoirEvents.length > 1 ? 's' : ''} ce soir`
                  : 'Crée une sortie pour ce soir'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.ceSoirCreateBtn}
            onPress={() => router.push({ pathname: '/(tabs)/event/create', params: { tonight: 'true' } })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={styles.ceSoirCreateBtnText}>Créer</Text>
          </TouchableOpacity>
        </View>

        {ceSoirEvents.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ceSoirScroll}>
            {ceSoirEvents.map(renderCeSoirCard)}
            {renderCeSoirSuggestCard()}
          </ScrollView>
        ) : (
          <View>
            <Text style={[styles.ceSoirEmptyHint, { color: colors.textSecondary }]}>
              Aucune sortie prévue — lance-toi !
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ceSoirScroll}>
              {TONIGHT_CREATE_SUGGESTIONS.map((s, i) => {
                const meta = CATEGORY_META[s.category] || CATEGORY_META.autre;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.ceSoirCard}
                    onPress={() => router.push({ pathname: '/(tabs)/event/create', params: { category: s.category, title: s.title, tonight: 'true' } })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.ceSoirCardAccent, { backgroundColor: meta.color }]} />
                    <View style={[styles.ceSoirCardIcon, { backgroundColor: meta.color + '28' }]}>
                      <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                    </View>
                    <Text style={[styles.ceSoirCardTime, { color: meta.color }]}>Ce soir</Text>
                    <Text style={styles.ceSoirCardTitle}>{typeof s.title === 'string' ? s.title : ''}</Text>
                    <View style={[styles.ceSoirSuggestChip, { backgroundColor: meta.color + '22', alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Ionicons name={meta.icon} size={10} color={meta.color} />
                      <Text style={[styles.ceSoirSuggestChipText, { color: meta.color }]}>{typeof meta.label === 'string' ? meta.label : ''}</Text>
                    </View>
                    <View style={[styles.ceSoirCardFooter]}>
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Créer →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderCard = ({ item }) => {
    // ── DEBUG ──
    ['location_name', 'title', 'description', 'category'].forEach((f) => {
      const v = item[f];
      if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        console.warn(`[OBJECT RENDER BUG] event.${f}`, JSON.stringify(v));
      }
    });
    // ── END DEBUG ──
    const meta = CATEGORY_META[item.category] || CATEGORY_META.autre;
    const isFull = item.member_count >= item.max_members;
    const isJoining = joiningId === item.id;
    const isOutdoor = OUTDOOR_CATEGORIES.includes(item.category);
    const distKm =
      nearMe && userLocation && item.latitude && item.longitude
        ? haversineKm(userLocation.latitude, userLocation.longitude, parseFloat(item.latitude), parseFloat(item.longitude))
        : null;
    const fillPct = Math.min(100, (item.member_count / item.max_members) * 100);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.backgroundElement }]}
        onPress={() => router.push(`/(tabs)/event/${item.id}`)}
        activeOpacity={0.85}
      >
        {/* Left color accent */}
        <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />

        <View style={styles.cardInner}>
          {/* Header: icon + chips */}
          <View style={styles.cardTopRow}>
            <View style={[styles.cardIconBox, { backgroundColor: meta.color + '20' }]}>
              <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <View style={styles.cardChipsRow}>
              <View style={[styles.catChipCard, { backgroundColor: meta.color + '18' }]}>
                <Text style={[styles.catChipCardTxt, { color: meta.color }]}>{typeof meta.label === 'string' ? meta.label : ''}</Text>
              </View>
              {item.is_joined && (
                <View style={styles.joinedChipCard}>
                  <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                  <Text style={styles.joinedChipTxt}>Rejoint</Text>
                </View>
              )}
              {isOutdoor && weather && !weather.ok && (
                <View style={styles.weatherChipCard}>
                  <Text style={styles.weatherEmoji}>{typeof weather.emoji === 'string' ? weather.emoji : ''}</Text>
                  <Text style={styles.weatherChipTxt}>{typeof weather.label === 'string' ? weather.label : ''}</Text>
                </View>
              )}
              {isOutdoor && weather && weather.ok && (
                <View style={[styles.weatherChipCard, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.weatherEmoji}>{typeof weather.emoji === 'string' ? weather.emoji : ''}</Text>
                  <Text style={[styles.weatherChipTxt, { color: '#16A34A' }]}>{typeof weather.label === 'string' ? weather.label : ''}</Text>
                </View>
              )}
            </View>
            {distKm !== null && (
              <View style={styles.distBadge}>
                <Ionicons name="navigate-outline" size={10} color={colors.textSecondary} />
                <Text style={[styles.distText, { color: colors.textSecondary }]}>
                  {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {typeof item.title === 'string' ? item.title : ''}
          </Text>

          {/* Location */}
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.cardMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {typeof item.location_name === 'string' ? item.location_name : ''}
            </Text>
          </View>

          {/* Time */}
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>
              {formatEventTime(item.starts_at)}
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.membersWrap}>
              <View style={[styles.membersBarBg, { backgroundColor: colors.backgroundSelected }]}>
                <View style={[styles.membersBarFill, {
                  backgroundColor: isFull ? '#EF4444' : meta.color,
                  width: `${fillPct}%`,
                }]} />
              </View>
              <Text style={[styles.membersText, { color: isFull ? '#EF4444' : colors.textSecondary }]}>
                {item.member_count}/{item.max_members} places
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.joinBtn, {
                backgroundColor: item.is_joined ? '#10B981' : isFull ? colors.backgroundSelected : meta.color,
                shadowColor: item.is_joined ? '#10B981' : isFull ? 'transparent' : meta.color,
              }]}
              onPress={() => handleJoin(item)}
              disabled={isFull && !item.is_joined}
              activeOpacity={0.8}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.joinBtnText, {
                  color: (item.is_joined || !isFull) ? '#fff' : colors.textSecondary,
                }]}>
                  {item.is_joined ? 'Chat →' : isFull ? 'Complet' : 'Rejoindre'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Sorties</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sorties dans les 72h
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/(tabs)/event/create')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.createBtnText}>Créer</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips — row 1 */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f, i) => (
          <View key={String(f.key)}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: activeFilter === f.key ? PALETTE.rose : colors.backgroundSelected },
              ]}
              onPress={() => handleFilterChange(f.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={f.icon} size={13} color={activeFilter === f.key ? '#fff' : colors.textSecondary} />
              <Text
                style={[
                  styles.filterChipText,
                  { color: activeFilter === f.key ? '#fff' : colors.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Near me toggle */}
        <View>
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: nearMe ? '#10B981' : colors.backgroundSelected, flexDirection: 'row', gap: 4 },
            ]}
            onPress={handleNearMe}
            activeOpacity={0.7}
            disabled={locLoading}
          >
            {locLoading ? (
              <ActivityIndicator size="small" color={nearMe ? '#fff' : colors.textSecondary} />
            ) : (
              <Ionicons name="navigate-outline" size={13} color={nearMe ? '#fff' : colors.textSecondary} />
            )}
            <Text style={[styles.filterChipText, { color: nearMe ? '#fff' : colors.textSecondary }]}>
              Près de moi
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category chips — row 2 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {CATEGORY_FILTERS.map((cat, i) => (
          <View key={String(cat.key)}>
            <TouchableOpacity
              style={[
                styles.catChip,
                {
                  backgroundColor: activeCategory === cat.key ? cat.color : colors.backgroundSelected,
                  borderColor: activeCategory === cat.key ? cat.color : 'transparent',
                },
              ]}
              onPress={() => handleCategoryChange(cat.key)}
              activeOpacity={0.7}
            >
            <Ionicons
              name={cat.icon}
              size={20}
              color={activeCategory === cat.key ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.catChipText,
                { color: activeCategory === cat.key ? '#fff' : colors.textSecondary },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        </View>
        ))}
      </ScrollView>

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <View>
            {renderCard({ item, index })}
          </View>
        )}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchEvents(activeFilter, activeCategory); }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<><PersonalizedSection /> {/*<CeSoirSection />*/}</>}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyCircle, { backgroundColor: PALETTE.rosePale }]}>
              <Ionicons name="calendar-outline" size={40} color={PALETTE.rose} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeFilter === 'joined' ? 'Pas encore rejoints' : "Aucun événement pour l'instant"}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              {activeFilter === 'joined'
                ? 'Rejoins un événement dans la liste !'
                : 'Sois la première à créer une sortie !'}
            </Text>
            {activeFilter !== 'joined' && (
              <TouchableOpacity
                style={styles.emptyCreateBtn}
                onPress={() => router.push('/(tabs)/event/create')}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.emptyCreateBtnText}>Créer un événement</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PALETTE.rose,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  catRow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one + 10,
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 50,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  catChipText: { fontSize: 11, fontWeight: '600' },

  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: 12,
    paddingTop: 4,
  },

  card: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardAccent: { width: 5 },
  cardInner: { flex: 1, padding: 14, gap: 5 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  cardIconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardChipsRow: { flex: 1, flexDirection: 'row', gap: 5, flexWrap: 'wrap', alignItems: 'center' },
  catChipCard: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  catChipCardTxt: { fontSize: 11, fontWeight: '700' },
  joinedChipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7,
  },
  joinedChipTxt: { fontSize: 10, fontWeight: '700', color: '#10B981' },
  weatherChipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7,
  },
  weatherEmoji: { fontSize: 11 },
  weatherChipTxt: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  distText: { fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '800', lineHeight: 21, letterSpacing: -0.2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { fontSize: 12, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },

  membersWrap: { flex: 1, gap: 4 },
  membersBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  membersBarFill: { height: 4, borderRadius: 2 },
  membersText: { fontSize: 11, fontWeight: '600' },

  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 92,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  joinBtnText: { fontSize: 13, fontWeight: '700' },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.four,
    paddingTop: 60,
  },
  emptyCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: PALETTE.rose,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyCreateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // ── Suggestions ──
  suggestSection: { marginBottom: 4 },
  suggestHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: 10,
    marginTop: 4,
  },
  suggestTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  suggestSub: { fontSize: 12, fontWeight: '500' },
  suggestScroll: { paddingHorizontal: Spacing.four, gap: 10 },
  suggestCard: {
    width: 130,
    borderRadius: 18,
    padding: 12,
    gap: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  suggestIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestCardTitle: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  suggestCardReason: { fontSize: 11, lineHeight: 15 },
  suggestCreateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 5, borderRadius: 8, marginTop: 2,
  },
  suggestCreateText: { fontSize: 12, fontWeight: '700' },

  // ── Ce soir ──
  ceSoirSection: { marginBottom: 8 },
  ceSoirHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, marginBottom: 12,
  },
  ceSoirHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ceSoirMoonBadge: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#12102A', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6D28D9', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
  },
  ceSoirMoonEmoji: { fontSize: 20 },
  ceSoirSectionTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  ceSoirSectionSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  ceSoirCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: PALETTE.rose, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12,
    shadowColor: PALETTE.rose, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  ceSoirCreateBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  ceSoirScroll: { paddingHorizontal: Spacing.four, gap: 10, paddingBottom: 4 },
  ceSoirEmptyHint: { fontSize: 12, fontWeight: '500', paddingHorizontal: Spacing.four, marginBottom: 10 },

  // Ce soir card (redesigned)
  ceSoirCard: {
    width: 165, height: 210, borderRadius: 22, padding: 14, backgroundColor: '#12102A',
    shadowColor: '#6D28D9', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.32, shadowRadius: 12, elevation: 9,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'flex-start', gap: 5,
  },
  ceSoirCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  ceSoirCardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  ceSoirCardTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ceSoirCardTime: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  ceSoirUntilBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ceSoirLiveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#EF4444' },
  ceSoirUntilText: { fontSize: 10, fontWeight: '700' },
  ceSoirCardTitle: { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 18, flex: 1 },
  ceSoirCardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ceSoirCardLoc: { fontSize: 10, color: 'rgba(255,255,255,0.38)', flex: 1 },
  ceSoirCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  ceSoirCardSpots: { fontSize: 10, fontWeight: '700' },

  // Suggestion chip on empty-state cards
  ceSoirSuggestChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  ceSoirSuggestChipText: { fontSize: 10, fontWeight: '700' },

  // Create card
  ceSoirCreateCard: { justifyContent: 'center', alignItems: 'center', borderColor: 'rgba(255,143,163,0.3)', borderStyle: 'dashed' },
  ceSoirCreateTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 4 },
  ceSoirCreateSub: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '500', textAlign: 'center' },

  // ── Personalized Badge ──
  persoBadge: {
    position: 'absolute',
    top: 5,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  persoBadgeText: {
    fontSize: 7,
    fontWeight: '700',
  },

});
