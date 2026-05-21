import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, swipesApi, wallApi } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { getProfileImages, parseDbJson } from '@/utils/parsers';
import { useAuth } from '@/contexts/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = SCREEN_WIDTH * 1.15;

function calculateAge(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const ZODIAC_ICONS = {
  'Bélier': 'flame-outline', 'Taureau': 'leaf-outline', 'Gémeaux': 'infinite-outline',
  'Cancer': 'water-outline', 'Lion': 'sunny-outline', 'Vierge': 'sparkles-outline',
  'Balance': 'scale-outline', 'Scorpion': 'skull-outline', 'Sagittaire': 'navigate-outline',
  'Capricorne': 'mountain-outline', 'Verseau': 'rainy-outline', 'Poissons': 'fish-outline',
};

function parseInterests(user) {
  try {
    const raw = user.interests;
    if (!raw) return { sports: [], hobbies: [] };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      sports: Array.isArray(parsed.sports) ? parsed.sports : [],
      hobbies: Array.isArray(parsed.hobbies) ? parsed.hobbies : [],
    };
  } catch {
    return { sports: [], hobbies: [] };
  }
}

// Derive just the city from a location string like "Paris, France" → "Paris"
function cityOnly(loc) {
  if (!loc) return null;
  return loc.split(',')[0].trim();
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const { user: currentUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [user, setUser] = useState(null);
  const [wallPosts, setWallPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [profileRes, postsRes] = await Promise.all([
          usersApi.getProfile(userId),
          wallApi.getUserPosts(userId).catch(() => ({ data: { posts: [] } })),
        ]);
        if (!cancelled) {
          setUser(profileRes.data?.user ?? null);
          setWallPosts(postsRes.data?.posts ?? []);
        }
      } catch (err) {
        if (!cancelled) console.error('Profile load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const handleLike = async () => {
    if (swiping || isOwnProfile) return;
    setSwiping(true);
    try {
      const res = await swipesApi.swipe(userId, 'right');
      if (res.data.matched) setTimeout(() => router.push('/(tabs)/messages'), 400);
    } catch (err) {
      console.error('Like error:', err);
    } finally {
      setSwiping(false);
    }
  };

  const handleNope = async () => {
    if (swiping || isOwnProfile) return;
    setSwiping(true);
    try {
      await swipesApi.swipe(userId, 'left');
      router.back();
    } catch (err) {
      console.error('Nope error:', err);
    } finally {
      setSwiping(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Profil introuvable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: PALETTE.rose, fontWeight: '600' }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const interests = parseInterests(user);
  const photos = getProfileImages(user);
  const age = calculateAge(user.date_of_birth);
  const city = cityOnly(user.location);
  const photoCount = photos.length;
  const memberWeeks = user.created_at
    ? Math.max(1, Math.floor((Date.now() - new Date(user.created_at).getTime()) / (7 * 24 * 3600_000)))
    : 1;
  const profileScore = Math.min(100,
    (photoCount >= 1 ? 20 : 0) +
    (photoCount >= 3 ? 10 : 0) +
    (user.bio ? 25 : 0) +
    (interests.sports.length > 0 ? 15 : 0) +
    (interests.hobbies.length > 0 ? 15 : 0) +
    (user.astrology_title ? 10 : 0) +
    (user.situation ? 5 : 0)
  );

  const lifestyleBadges = [
    ...(user.astrology_title ? [{ icon: ZODIAC_ICONS[user.astrology_title] || 'star-outline', label: user.astrology_title, bg: '#FFF0F3', color: '#CC3D5E' }] : []),
    ...(user.situation ? [{ icon: 'heart-outline', label: user.situation, bg: '#E8D5F5', color: '#6D28D9' }] : []),
    ...(user.work ? [{ icon: 'briefcase-outline', label: user.work, bg: '#E0F2FE', color: '#0369A1' }] : []),
  ];

  const headerOpacity = scrollY.interpolate({ inputRange: [GALLERY_HEIGHT - 80, GALLERY_HEIGHT], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating back button */}
      <TouchableOpacity style={styles.backCircle} onPress={() => router.back()} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Sticky name bar (appears after gallery scrolls away) */}
      <Animated.View style={[styles.stickyBar, { backgroundColor: colors.background, opacity: headerOpacity }]}>
        <Text style={[styles.stickyName, { color: colors.text }]} numberOfLines={1}>
          {user.full_name || user.user_name}{age ? `, ${age}` : ''}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── Hero photo gallery ── */}
        <View style={styles.galleryContainer}>
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
              scrollEventThrottle={16}
            >
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.galleryPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
              <Text style={{ fontSize: 64 }}>🌸</Text>
            </View>
          )}

          {/* Photo progress dots */}
          {photos.length > 1 && (
            <View style={styles.photoDots}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.photoDot, { flex: i === activePhoto ? 2 : 1, backgroundColor: i === activePhoto ? '#fff' : 'rgba(255,255,255,0.4)' }]}
                />
              ))}
            </View>
          )}

          {/* Gradient at bottom of gallery fading to page bg */}
          <View style={styles.galleryGradient} />

          {/* Name overlay at bottom of gallery */}
          <View style={styles.galleryNameBlock}>
            <Text style={styles.galleryName}>
              {user.full_name || user.user_name}
              {age ? <Text style={styles.galleryAge}>, {age}</Text> : null}
            </Text>
            {city ? (
              <View style={styles.galleryLocRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.galleryLoc}>{city}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Lifestyle badges ── */}
        {lifestyleBadges.length > 0 && (
          <View style={styles.badgesRow}>
            {lifestyleBadges.map((b, i) => (
              <View key={i} style={[styles.badge, { backgroundColor: b.bg }]}>
                <Ionicons name={b.icon} size={13} color={b.color} />
                <Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Stats card ── */}
        <View style={[styles.statsCard, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.statItem}>
            <Ionicons name="images-outline" size={22} color={PALETTE.rose} />
            <Text style={[styles.statValue, { color: colors.text }]}>{photoCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Photos</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.backgroundSelected }]} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={22} color="#6D28D9" />
            <Text style={[styles.statValue, { color: colors.text }]}>{memberWeeks}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Semaines</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.backgroundSelected }]} />
          <View style={styles.statItem}>
            <Ionicons name="sparkles-outline" size={22} color="#0369A1" />
            <Text style={[styles.statValue, { color: colors.text }]}>{profileScore}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Profil</Text>
          </View>
        </View>

        {/* ── À propos ── */}
        {user.bio ? (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>À propos</Text>
            <Text style={[styles.bioText, { color: colors.textSecondary }]}>{user.bio}</Text>
          </View>
        ) : null}

        {/* ── Sports ── */}
        {interests.sports.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="barbell-outline" size={16} color="#6D28D9" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Sports</Text>
            </View>
            <View style={styles.chipsWrap}>
              {interests.sports.map((s, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: '#EDE9FE' }]}>
                  <Text style={[styles.chipText, { color: '#6D28D9' }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Loisirs ── */}
        {interests.hobbies.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="color-palette-outline" size={16} color={PALETTE.rose} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Loisirs</Text>
            </View>
            <View style={styles.chipsWrap}>
              {interests.hobbies.map((h, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: PALETTE.rosePale }]}>
                  <Text style={[styles.chipText, { color: '#CC3D5E' }]}>{h}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Photos du mur ── */}
        {wallPosts.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={16} color={PALETTE.rose} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos du mur</Text>
            </View>
            <View style={styles.wallGrid}>
              {wallPosts.map((post, i) => {
                const rawPhotos = parseDbJson(post.wall_photo);
                const uri = Array.isArray(rawPhotos) && rawPhotos.length > 0 ? rawPhotos[0] : null;
                return uri ? (
                  <Image key={String(post.id)} source={{ uri }} style={styles.wallThumb} />
                ) : null;
              })}
            </View>
          </View>
        )}

        <View style={{ height: 140 }} />
      </Animated.ScrollView>

      {/* ── Action bar (fixed bottom) ──
      {!isOwnProfile && (
        <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.backgroundSelected }]}>
          <TouchableOpacity style={[styles.actionBtn, styles.nopeBtn]} onPress={handleNope} disabled={swiping} activeOpacity={0.7}>
            <Ionicons name="close" size={26} color="#EF4444" />
            <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Passer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={handleLike} disabled={swiping} activeOpacity={0.7}>
            {swiping ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="heart" size={26} color="#fff" />
                <Text style={[styles.actionLabel, { color: '#fff' }]}>J'aime</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}*/}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 18, marginBottom: Spacing.two },
  backBtn: { padding: Spacing.two },

  // ── Floating back button ──
  backCircle: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },

  // ── Sticky name bar ──
  stickyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    justifyContent: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 60,
    zIndex: 15,
  },
  stickyName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },

  // ── Gallery ──
  galleryContainer: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT, position: 'relative' },
  galleryImage: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT, resizeMode: 'cover' },
  galleryPlaceholder: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT, alignItems: 'center', justifyContent: 'center' },

  photoDots: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
  },
  photoDot: { height: 3, borderRadius: 2 },

  galleryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    // layered from transparent → dark
    backgroundColor: 'transparent',
  },

  galleryNameBlock: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  galleryName: { fontSize: 30, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  galleryAge: { fontSize: 26, fontWeight: '500' },
  galleryLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  galleryLoc: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  // ── Lifestyle badges ──
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 6 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

  // ── Sections ──
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  bioText: { fontSize: 15, lineHeight: 24 },

  // ── Chips ──
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },

  // ── Wall post grid ──
  wallGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  wallThumb: {
    width: (SCREEN_WIDTH - 32 - 8) / 3,
    height: (SCREEN_WIDTH - 32 - 8) / 3,
    borderRadius: 10,
    backgroundColor: PALETTE.rosePale,
  },

  // ── Action bar ──
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nopeBtn: {
    backgroundColor: '#FFF1F1',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  likeBtn: {
    backgroundColor: PALETTE.rose,
    shadowColor: PALETTE.rose,
  },
  actionLabel: { fontSize: 15, fontWeight: '700' },
});
