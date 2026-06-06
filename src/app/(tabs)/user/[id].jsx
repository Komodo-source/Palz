import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, swipesApi, wallApi, messagesApi, getStorageUrl } from '@/services/api';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { getProfileImages, parseDbJson } from '@/utils/parsers';
import { useAuth } from '@/contexts/auth';
import { UserProfileSkeleton } from '@/components/Skeleton';
import ImageViewerModal from '@/components/ImageViewerModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GALLERY_HEIGHT = Math.round(SCREEN_HEIGHT * 0.74);
const SUPABASE_PHOTOS_URL = 'https://kcglwtoegceicruwmxzo.supabase.co/storage/v1/object/public/user_photos/';

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

function toStringArray(raw) {
  const arr = Array.isArray(raw) ? raw : (Array.isArray(parseDbJson(raw)) ? parseDbJson(raw) : []);
  return arr.filter((x) => x != null && typeof x !== 'object');
}

function parseInterests(user) {
  return {
    sports: toStringArray(user.sports),
    hobbies: toStringArray(user.hobbies),
  };
}

function VoiceNotePlayer({ uri, colors }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
    } else {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.play();
    }
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name="mic-outline" size={16} color={PALETTE.rose} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Fun fact vocale</Text>
      </View>
      <TouchableOpacity style={styles.voiceRow} onPress={toggle} activeOpacity={0.8}>
        <View style={[styles.voicePlayBtn, status.playing && styles.voicePlayBtnActive]}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#fff" />
        </View>
        <View style={styles.voiceWave}>
          {Array.from({ length: 28 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.voiceBar,
                { height: 4 + (i % 5) * 4 + (i % 3) * 2 },
                status.playing && { backgroundColor: PALETTE.rose },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.voiceLabel, { color: colors.textSecondary }]}>
          {status.playing ? 'En écoute…' : 'Écouter'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function cityOnly(loc) {
  if (!loc || typeof loc !== 'string') return null;
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
  const [openingDm, setOpeningDm] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);

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

  const handleOpenDm = async () => {
    if (openingDm || !userId) return;
    setOpeningDm(true);
    try {
      const res = await messagesApi.startConversation(userId);
      const { conversation_id, limit_reached, free_limit } = res.data;
      if (!conversation_id) throw new Error('Conversation introuvable');
      if (limit_reached) {
        Alert.alert(
          'Limite atteinte',
          `Tu as déjà envoyé ${free_limit} messages à cette personne. Deviens Premium pour continuer !`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Devenir Premium ✨', onPress: () => router.navigate('/(tabs)/profil/payement_page') },
            { text: 'Voir quand même', onPress: () => router.navigate(`/(tabs)/chat/${conversation_id}`) },
          ]
        );
      } else {
        router.navigate(`/(tabs)/chat/${conversation_id}`);
      }
    } catch (err) {
      console.error('Open DM error:', err);
      Alert.alert('Erreur', err?.response?.data?.error || "Impossible d'ouvrir la conversation.");
    } finally {
      setOpeningDm(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <UserProfileSkeleton colors={colors} isDark={colorScheme === 'dark'} />
      </>
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
  console.log("user_photo", photos)
  const age = calculateAge(user.date_of_birth);
  const city = cityOnly(user.location);
  const photoCount = photos.length;
  const memberWeeks = user.created_at
    ? Math.max(1, Math.floor((Date.now() - new Date(user.created_at).getTime()) / (7 * 24 * 3600_000)))
    : 1;


const lifestyleBadges = [
  ...(user.is_premium ? [{ icon: 'star', label: 'Premium', bg: '#FFF9E6', color: '#D97706' }] : []),
  ...(typeof user.astrology_title === 'string' ? [{ icon: ZODIAC_ICONS[user.astrology_title] || 'star-outline', label: user.astrology_title, bg: '#FFF0F3', color: '#CC3D5E' }] : []),
  ...(typeof user.situation === 'string' ? [{ icon: 'heart-outline', label: user.situation, bg: '#E8D5F5', color: '#6D28D9' }] : []),
  ...(typeof user.work === 'string' ? [{ icon: 'briefcase-outline', label: user.work, bg: '#E0F2FE', color: '#0369A1' }] : []),
];

  const reliabilityStars = Math.min(3, Math.max(1, user.reliability_score || 1));
  const rawLabels = (() => {
    try {
      const l = user.labels;
      if (!l) return {};
      if (typeof l === 'string') return JSON.parse(l);
      if (typeof l === 'object' && !Array.isArray(l)) return l;
      return {};
    } catch { return {}; }
  })();
  const vibeLabels = (Array.isArray(rawLabels.vibe) ? rawLabels.vibe : []).filter((x) => typeof x === 'string');
  const dispoLabels = (Array.isArray(rawLabels.dispo) ? rawLabels.dispo : []).filter((x) => typeof x === 'string');
  const irlLabels = (Array.isArray(rawLabels.irl) ? rawLabels.irl : []).filter((x) => typeof x === 'string');

  const headerOpacity = scrollY.interpolate({ inputRange: [GALLERY_HEIGHT - 80, GALLERY_HEIGHT], outputRange: [0, 1], extrapolate: 'clamp' });

  // ── DEBUG ──
  ['bio', 'work', 'location', 'home_location', 'labels', 'interests', 'situation', 'astrology_title', 'full_name', 'user_name'].forEach((f) => {
    const v = user?.[f];
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      console.warn(`[OBJECT RENDER BUG] user/[id] user.${f}`, JSON.stringify(v));
    }
  });
  // ── END DEBUG ──

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
          {String(user.full_name || user.user_name || 'Utilisateur')}{age ? `, ${age}` : ''}
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
              onMomentumScrollEnd={(e) =>
                setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
              }
              scrollEventThrottle={16}
            >
              {photos.map((item, index) => {
                const uri = `${SUPABASE_PHOTOS_URL}${item}`;
                return (
                  <TouchableOpacity key={index} activeOpacity={0.95} onPress={() => setViewerUri(uri)}>
                    <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.galleryPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
              <Text style={{ fontSize: 72 }}>🌸</Text>
            </View>
          )}

          {/* Bumble-style thin progress bars */}
          {photos.length > 1 && (
            <View style={styles.photoBars}>
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.photoBar,
                    {
                      backgroundColor:
                        i === activePhoto
                          ? '#fff'
                          : i < activePhoto
                          ? 'rgba(255,255,255,0.75)'
                          : 'rgba(255,255,255,0.35)',
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Layered gradient overlay — transparent → dark at bottom */}
          <View style={styles.galleryGradient} pointerEvents="none">
            <View style={styles.gradLayer0} />
            <View style={styles.gradLayer1} />
            <View style={styles.gradLayer2} />
            <View style={styles.gradLayer3} />
            <View style={styles.gradLayer4} />
            <View style={styles.gradLayer5} />
          </View>

          {/* Name / age / location overlay */}
          <View style={styles.galleryNameBlock}>
            <Text style={styles.galleryName} numberOfLines={1}>
              {String(user.full_name || user.user_name || '')}
              {age ? <Text style={styles.galleryAge}>, {age}</Text> : null}
            </Text>
            {city ? (
              <View style={styles.galleryLocRow}>
                <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.9)" />
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
                <Text style={[styles.badgeText, { color: b.color }]}>{String(b.label ?? '')}</Text>
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
            <Text style={styles.reliabilityStars}>{'★'.repeat(reliabilityStars)}{'☆'.repeat(3 - reliabilityStars)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fiabilité</Text>
          </View>
           {/*<View style={[styles.statDivider, { backgroundColor: colors.backgroundSelected }]} />
          <View style={styles.statItem}>
            <Ionicons name="sparkles-outline" size={22} color="#0369A1" />
           <Text style={[styles.statValue, { color: colors.text }]}>{profileScore}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Profil</Text>
          </View>*/}
        </View>

        {/* ── À propos ── */}
        {user.bio && typeof user.bio === 'string' ? (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>À propos</Text>
            <Text style={[styles.bioText, { color: colors.textSecondary }]}>{user.bio}</Text>
          </View>
        ) : null}

        {/* ── Prompt Q&A ── */}
      {typeof user.prompt_question === 'string' && typeof user.prompt_answer === 'string' ? (
        <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.promptQuestion}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={PALETTE.rose} />
            <Text style={[styles.promptQuestionText, { color: PALETTE.rose }]}>{user.prompt_question}</Text>
          </View>
          <Text style={[styles.promptAnswer, { color: colors.text }]}>{user.prompt_answer}</Text>
        </View>
      ) : null}

        {/* ── Labels: Vibe / Dispo / IRL ── */}
        {(vibeLabels.length > 0 || dispoLabels.length > 0 || irlLabels.length > 0) && (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={16} color={PALETTE.rose} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Étiquettes</Text>
            </View>
            {vibeLabels.length > 0 && (
              <View style={styles.labelGroup}>
                <Text style={[styles.labelGroupTitle, { color: colors.textSecondary }]}>Vibe</Text>
                <View style={styles.chipsWrap}>
                  {vibeLabels.map((l, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: '#FFF0F3' }]}>
                      <Text style={[styles.chipText, { color: '#CC3D5E' }]}>{String(l ?? '')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {dispoLabels.length > 0 && (
              <View style={styles.labelGroup}>
                <Text style={[styles.labelGroupTitle, { color: colors.textSecondary }]}>Dispo</Text>
                <View style={styles.chipsWrap}>
                  {dispoLabels.map((l, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.chipText, { color: '#0369A1' }]}>{String(l ?? '')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {irlLabels.length > 0 && (
              <View style={styles.labelGroup}>
                <Text style={[styles.labelGroupTitle, { color: colors.textSecondary }]}>IRL</Text>
                <View style={styles.chipsWrap}>
                  {irlLabels.map((l, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: '#E8D5F5' }]}>
                      <Text style={[styles.chipText, { color: '#6D28D9' }]}>{String(l ?? '')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

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
                  <Text style={[styles.chipText, { color: '#6D28D9' }]}>{String(s ?? '')}</Text>
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
                  <Text style={[styles.chipText, { color: '#CC3D5E' }]}>{String(h ?? '')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Fun fact vocale ── */}
        {user.voice_fun_fact ? (
          <VoiceNotePlayer uri={getStorageUrl(user.voice_fun_fact)} colors={colors} />
        ) : null}

        {/* ── Photos du mur ── */}
        {wallPosts.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={16} color={PALETTE.rose} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos de la toile</Text>
            </View>
            <View style={styles.wallGrid}>
              {wallPosts.map((post, i) => {
                const rawPhotos = parseDbJson(post.wall_photo);
                const first = Array.isArray(rawPhotos) && rawPhotos.length > 0 ? rawPhotos[0] : null;
                const uri = typeof first === 'string' ? first : null;
                return uri ? (
                  <TouchableOpacity key={String(post.id)} activeOpacity={0.85} onPress={() => setViewerUri(uri)}>
                    <Image source={{ uri }} style={styles.wallThumb} />
                  </TouchableOpacity>
                ) : null;
              })}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />

      {/* ── Floating message button (other user only) ── */}
      {!isOwnProfile && (
        <TouchableOpacity
          style={[styles.messageFab, { opacity: openingDm ? 0.7 : 1 }]}
          onPress={handleOpenDm}
          disabled={openingDm}
          activeOpacity={0.85}
        >
          {openingDm
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="chatbubble" size={26} color="#fff" />
          }
        </TouchableOpacity>
      )}
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
  galleryContainer: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT, position: 'relative', overflow: 'hidden' },
  galleryImage: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT },
  galleryPlaceholder: { width: SCREEN_WIDTH, height: GALLERY_HEIGHT, alignItems: 'center', justifyContent: 'center' },

  // Bumble-style thin progress bars
  photoBars: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 44,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 5,
    zIndex: 10,
  },
  photoBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  // Layered gradient (transparent → dark)
  galleryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
    flexDirection: 'column',
  },
  gradLayer0: { flex: 1, backgroundColor: 'transparent' },
  gradLayer1: { flex: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  gradLayer2: { flex: 1, backgroundColor: 'rgba(0,0,0,0.14)' },
  gradLayer3: { flex: 1, backgroundColor: 'rgba(0,0,0,0.26)' },
  gradLayer4: { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)' },
  gradLayer5: { flex: 1, backgroundColor: 'rgba(0,0,0,0.56)' },

  galleryNameBlock: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  galleryName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  galleryAge: { fontSize: 28, fontWeight: '400' },
  galleryLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  galleryLoc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '500', letterSpacing: 0.2 },

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

  // ── Reliability stars ──
  reliabilityStars: { fontSize: 18, color: '#D97706', letterSpacing: 1 },

  // ── Prompt Q&A ──
  promptQuestion: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  promptQuestionText: { fontSize: 13, fontWeight: '700', fontStyle: 'italic', flex: 1 },
  promptAnswer: { fontSize: 15, lineHeight: 22, fontWeight: '500' },

  // ── Labels ──
  labelGroup: { marginBottom: 10 },
  labelGroupTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },

  // ── Voice note player ──
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voicePlayBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: PALETTE.rose,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  voicePlayBtnActive: { backgroundColor: '#CC3D5E' },
  voiceWave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' },
  voiceBar: { width: 3, backgroundColor: 'rgba(255,143,163,0.45)', borderRadius: 2 },
  voiceLabel: { fontSize: 13, fontWeight: '600', flexShrink: 0 },

  // ── Wall post grid ──
  wallGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  wallThumb: {
    width: (SCREEN_WIDTH - 32 - 8) / 3,
    height: (SCREEN_WIDTH - 32 - 8) / 3,
    borderRadius: 10,
    backgroundColor: PALETTE.rosePale,
  },

  // ── Floating message button ──
  messageFab: {
    position: 'absolute',
    bottom: 36,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
});
