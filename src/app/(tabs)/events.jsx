import React, { useState, useCallback, useMemo } from 'react';
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
import { eventsApi } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';

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

  const [eventsRaw, setEventsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  // Sort by distance when nearMe is on
  const events = useMemo(() => {
    if (!nearMe || !userLocation) return eventsRaw;
    return [...eventsRaw].sort((a, b) => {
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

  useFocusEffect(
    useCallback(() => {
      fetchEvents(activeFilter, activeCategory);
    }, [fetchEvents, activeFilter, activeCategory])
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
    const time = new Date(item.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        key={String(item.id)}
        style={styles.ceSoirCard}
        onPress={() => router.push(`/(tabs)/event/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.ceSoirIconWrap, { backgroundColor: meta.color + '25' }]}>
          <Ionicons name={meta.icon} size={26} color={meta.color} />
        </View>
        <Text style={styles.ceSoirTime}>{time}</Text>
        <Text style={styles.ceSoirTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.ceSoirLocation} numberOfLines={1}>{item.location_name}</Text>
        <View style={[styles.ceSoirFooter]}>
          <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.ceSoirMembers}>{item.member_count}/{item.max_members}</Text>
          {isFull && <Text style={styles.ceSoirFull}>Complet</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const CeSoirSection = () => {
    if (ceSoirEvents.length === 0) return null;
    return (
      <View style={styles.ceSoirSection}>
        <View style={styles.ceSoirHeader}>
          <View style={styles.ceSoirTitleRow}>
            <Text style={styles.ceSoirSectionEmoji}>🌙</Text>
            <Text style={[styles.ceSoirSectionTitle, { color: colors.text }]}>Ce soir</Text>
          </View>
          <Text style={[styles.ceSoirSectionSub, { color: colors.textSecondary }]}>
            {ceSoirEvents.length} sortie{ceSoirEvents.length > 1 ? 's' : ''} ce soir
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ceSoirScroll}
        >
          {ceSoirEvents.map(renderCeSoirCard)}
        </ScrollView>
      </View>
    );
  };

  const renderCard = ({ item }) => {
    const meta = CATEGORY_META[item.category] || CATEGORY_META.autre;
    const isFull = item.member_count >= item.max_members;
    const isJoining = joiningId === item.id;
    const distKm =
      nearMe && userLocation && item.latitude && item.longitude
        ? haversineKm(userLocation.latitude, userLocation.longitude, parseFloat(item.latitude), parseFloat(item.longitude))
        : null;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBg || colors.backgroundSelected }]}
        onPress={() => router.push(`/(tabs)/event/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.categoryBadge, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={28} color={meta.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.categoryChip, { backgroundColor: meta.color + '15' }]}>
              <Text style={[styles.categoryChipText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            {item.is_joined && (
              <View style={styles.joinedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={PALETTE.rose} />
                <Text style={styles.joinedBadgeText}>Rejoint</Text>
              </View>
            )}
            {distKm !== null && (
              <View style={styles.distBadge}>
                <Ionicons name="navigate-outline" size={11} color={colors.textSecondary} />
                <Text style={[styles.distText, { color: colors.textSecondary }]}>
                  {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.location_name}
            </Text>
          </View>

          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={[styles.cardMetaText, { color: colors.textSecondary }]}>
              {formatEventTime(item.starts_at)}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.membersWrap}>
              <View style={[styles.membersBarBg, { backgroundColor: colors.backgroundSelected }]}>
                <View
                  style={[
                    styles.membersBarFill,
                    {
                      backgroundColor: isFull ? '#EF4444' : meta.color,
                      width: `${Math.min(100, (item.member_count / item.max_members) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.membersText, { color: colors.textSecondary }]}>
                {item.member_count}/{item.max_members}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.joinBtn,
                {
                  backgroundColor: item.is_joined
                    ? PALETTE.rosePale
                    : isFull
                    ? colors.backgroundSelected
                    : PALETTE.rose,
                },
              ]}
              onPress={() => handleJoin(item)}
              disabled={isFull && !item.is_joined}
              activeOpacity={0.8}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.joinBtnText,
                    { color: item.is_joined ? PALETTE.rose : isFull ? colors.textSecondary : '#fff' },
                  ]}
                >
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
          <Text style={[styles.title, { color: colors.text }]}>Événements</Text>
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
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.key)}
            style={[
              styles.filterChip,
              { backgroundColor: activeFilter === f.key ? PALETTE.rose : colors.backgroundSelected },
            ]}
            onPress={() => handleFilterChange(f.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: activeFilter === f.key ? '#fff' : colors.textSecondary },
              ]}
            >
              {f.label}
            </Text>
            <Ionicons name={String(f.icon)} size={13} color={"#fff"}></Ionicons>
          </TouchableOpacity>
        ))}

        {/* Near me toggle */}
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

      {/* Category chips — row 2 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {CATEGORY_FILTERS.map((cat) => (
          <TouchableOpacity
            key={String(cat.key)}
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
        ))}
      </ScrollView>

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchEvents(activeFilter, activeCategory); }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<CeSoirSection />}
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
    borderRadius: 18,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  categoryChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  categoryChipText: { fontSize: 11, fontWeight: '700' },
  joinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  joinedBadgeText: { fontSize: 11, fontWeight: '600', color: PALETTE.rose },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  distText: { fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 13, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },

  membersWrap: { flex: 1, gap: 4 },
  membersBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  membersBarFill: { height: 4, borderRadius: 2 },
  membersText: { fontSize: 11, fontWeight: '600' },

  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
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

  // ── Ce soir ──
  ceSoirSection: {
    marginBottom: 8,
  },
  ceSoirHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: 10,
  },
  ceSoirTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ceSoirSectionEmoji: { fontSize: 20 },
  ceSoirSectionTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  ceSoirSectionSub: { fontSize: 12, fontWeight: '500' },
  ceSoirScroll: {
    paddingHorizontal: Spacing.four,
    gap: 10,
  },
  ceSoirCard: {
    width: 140,
    borderRadius: 20,
    padding: 14,
    gap: 6,
    backgroundColor: '#1A1035',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  ceSoirIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  ceSoirTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 0.3,
  },
  ceSoirTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  ceSoirLocation: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  ceSoirFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ceSoirMembers: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    flex: 1,
  },
  ceSoirFull: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
});
