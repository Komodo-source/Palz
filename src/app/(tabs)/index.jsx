import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { usersApi, swipesApi } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Spacing, getColors, PALETTE } from '@/constants/theme';
import { getProfileImages, parseUserInterests, parseDbJson } from '@/utils/parsers';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.four * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const ROTATION_FACTOR = 15;

function calculateAge(dateStr) {
  if (!dateStr) return 0;
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const ZODIAC_ICONS = {
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

function getZodiacIcon(name) {
  return ZODIAC_ICONS[name] || 'star';
}


// ── Photo Gallery component (swipe between photos) ──
function PhotoGallery({ images, onTap }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const photos = (images && Array.isArray(images) && images.length > 0)
    ? images
    : null;

  if (!photos || photos.length === 0) {
    return (
      <TouchableOpacity style={styles.imageContainer} onPress={onTap} activeOpacity={1}>
        <View style={[styles.imagePlaceholder, { backgroundColor: PALETTE.rosePale }]}>
          <Text style={styles.placeholderEmoji}>🌸</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.imageContainer}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setActiveIndex(idx);
        }}
        scrollEventThrottle={16}
      >
        {photos.map((uri, i) => (
          <TouchableOpacity key={i} onPress={onTap} activeOpacity={1}>
            <Image source={{ uri }} style={styles.image} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Photo dots */}
      {photos.length > 1 && (
        <View style={styles.photoDots}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[
                styles.photoDot,
                { backgroundColor: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.4)' },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Animated card wrapper (smooth position transitions when cards are dismissed) ──
function AnimatedCardWrapper({ stackIndex, children }) {
  const scale = useSharedValue(1 - stackIndex * 0.03);
  const offsetY = useSharedValue(stackIndex * 6);

  useEffect(() => {
    scale.value = withTiming(1 - stackIndex * 0.03, { duration: 350 });
    offsetY.value = withTiming(stackIndex * 6, { duration: 350 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackIndex]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    marginTop: offsetY.value,
  }));

  return (
    <Animated.View
      style={[styles.cardWrapper, { zIndex: -stackIndex }, animatedWrapperStyle]}
    >
      {children}
    </Animated.View>
  );
}

// ── Card component with gesture handling ──
function SwipeCard({ user, onSwipe, isTop }) {
  console.log("showed user: ", user);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const interests = parseUserInterests(user);

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.5;
      rotation.value = (e.translationX / SCREEN_WIDTH) * ROTATION_FACTOR;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 'right' : 'left';
        const xOffset = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;

        translateX.value = withSpring(xOffset, { velocity: e.velocityX });
        translateY.value = withSpring(e.translationY + 100);
        rotation.value = withSpring(direction === 'right' ? 30 : -30);
        opacity.value = withTiming(0, { duration: 200 });

        runOnJS(onSwipe)(direction);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD / 2],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD / 2, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const photos = getProfileImages(user);

  const handleProfilePress = () => {
    if (user.id) {
      router.push(`/(tabs)/user/${user.id}`);
    }
  };

  const sports = Array.isArray(user.sports) ? user.sports : (parseDbJson(user.sports) || []);
  const hobbies = Array.isArray(user.hobbies) ? user.hobbies : (parseDbJson(user.hobbies) || []);
  const rawUserLabels = user.labels && typeof user.labels === 'object' ? user.labels : {};
  const vibeLabel = rawUserLabels.vibe?.[0] || null;
  const dispoLabel = rawUserLabels.dispo?.[0] || null;

  const metaTags = [
    ...(user.astrology_title ? [{ label: user.astrology_title, type: 'meta', icon: getZodiacIcon(user.astrology_title) }] : []),
    ...(user.situation ? [{ label: user.situation, type: 'meta', icon: 'heart-outline' }] : []),
    ...(vibeLabel ? [{ label: vibeLabel, type: 'vibe', icon: 'sparkles-outline' }] : []),
    ...(dispoLabel ? [{ label: dispoLabel, type: 'dispo', icon: 'calendar-outline' }] : []),
  ].filter((t) => t.label);
  const sportTags = sports.slice(0, 2).map((s) => ({ label: s, type: 'sport', icon: 'barbell-outline' }));
  const hobbyTags = hobbies.slice(0, 2).map((h) => ({ label: h, type: 'hobby', icon: 'color-palette-outline' }));
  const allTags = [...metaTags, ...sportTags, ...hobbyTags].slice(0, 6);

  const tagStyle = (type) => {
    if (type === 'sport') return { bg: '#EDE9FE', text: '#6D28D9', icon: '#6D28D9' };
    if (type === 'hobby') return { bg: '#FFF0F3', text: '#CC3D5E', icon: PALETTE.rose };
    if (type === 'vibe')  return { bg: '#FFF0F3', text: '#CC3D5E', icon: PALETTE.rose };
    if (type === 'dispo') return { bg: '#E0F2FE', text: '#0369A1', icon: '#0369A1' };
    return { bg: '#F3F4F6', text: PALETTE.textDark, icon: PALETTE.textMid };
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundElement,
            shadowColor: PALETTE.shadow,
          },
          animatedStyle,
        ]}
      >
        {/* Image area with photo gallery */}
        <PhotoGallery images={photos} onTap={handleProfilePress} />

        {/* LIKE / NOPE overlays */}
        <Animated.View style={[styles.stamp, styles.likeStamp, likeOpacity]}>
          <Text style={styles.stampText}>J'aime</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.nopeStamp, nopeOpacity]}>
          <Text style={styles.stampText}>Non</Text>
        </Animated.View>

        {/* Info section below image */}
        <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.9}>
          <View style={styles.infoSection}>
            {/* Name + age */}
            <View style={styles.nameRow}>
              <Text style={[styles.infoName, { color: colors.text }]} numberOfLines={1}>
                {user.full_name || user.user_name}
              </Text>
              <Text style={[styles.infoAge, { color: colors.textSecondary }]}>
                , {user.date_of_birth ? calculateAge(user.date_of_birth) : '?'}
              </Text>
            </View>

            {/* Location */}
            {user.location ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.infoLocText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user.location}
                </Text>
              </View>
            ) : null}

            {/* Color-coded vibe chips */}
            {allTags.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tagsRow}
                contentContainerStyle={styles.tagsContent}
              >
                {allTags.map((tag, i) => {
                  const ts = tagStyle(tag.type);
                  return (
                    <View key={i} style={[styles.tag, { backgroundColor: ts.bg }]}>
                      <Ionicons name={tag.icon} size={11} color={ts.icon} />
                      <Text style={[styles.tagText, { color: ts.text }]}>{tag.label}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Mini photo grid — peek at all photos */}
            {photos && photos.length > 1 && (
              <View style={styles.miniGrid}>
                {photos.slice(0, 3).map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.miniPhoto} />
                ))}
                {photos.length > 3 && (
                  <View style={styles.miniMore}>
                    <Text style={styles.miniMoreText}>+{photos.length - 3}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.nopeBtn]}
            onPress={() => {
              translateX.value = withSpring(-SCREEN_WIDTH * 1.5);
              opacity.value = withTiming(0, { duration: 200 });
              runOnJS(onSwipe)('left');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={PALETTE.error} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.superBtn]}
            onPress={handleProfilePress}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle" size={24} color={PALETTE.textDark} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.likeBtn]}
            onPress={() => {
              translateX.value = withSpring(SCREEN_WIDTH * 1.5);
              opacity.value = withTiming(0, { duration: 200 });
              runOnJS(onSwipe)('right');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="heart" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function SwipeScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // IDs of cards currently animating out (fly-off + next-card transition)
  const [dismissingIds, setDismissingIds] = useState(new Set());
  // Ref to track latest users for the timeout callback
  const usersRef = useRef(users);
  usersRef.current = users;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.discover();
      setUsers(res.data?.users ?? []);
    } catch (err) {
      console.error('Discover error:', err.response?.data || err.message, '| status:', err.response?.status, '| url:', err.config?.url);
      if (err.response?.status !== 401) {
        Alert.alert('Error', 'Failed to load profiles. Pull to refresh.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSwipe = useCallback(
    async (targetId, direction) => {
      const currentUsers = usersRef.current;

      // Mark as dismissing — keeps card in DOM for fly-off + transition animations
      setDismissingIds((prev) => new Set([...prev, targetId]));

      try {
        const res = await swipesApi.swipe(targetId, direction);

        if (res.data?.matched) {
          Alert.alert('🎉 C\'est un Match !', 'Vous pouvez maintenant discuter !', [
            { text: 'Discuter', onPress: () => router.push('/(tabs)/messages'), style: 'default' },
            { text: 'Continuer', style: 'cancel' },
          ]);
        }
      } catch (err) {
        console.error('Swipe error:', err);
      }

      // After fly-off + position transition completes, actually remove the card
      setTimeout(() => {
        setUsers((prev) => prev.filter((u) => u.id !== targetId));
        setDismissingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });

        // Fetch more if running low
        if (currentUsers.length <= 3) {
          usersApi.discover().then((more) => {
            setUsers((prev) => {
              const existingIds = new Set(prev.map((u) => u.id));
              const newUsers = (more.data?.users ?? []).filter((u) => !existingIds.has(u.id));
              return [...prev, ...newUsers];
            });
          }).catch(() => {});
        }
      }, 500);
    },
    []
  );

  // Cards visible after removing dismissed ones (for computing stack positions)
  const visibleUsers = useMemo(
    () => users.filter((u) => !dismissingIds.has(u.id)),
    [users, dismissingIds]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          On cherche des amis près de toi...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Découvrir</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Fais glisser pour rencontrer</Text>
        </View>
        <TouchableOpacity style={styles.refreshCircle} onPress={handleRefresh} activeOpacity={0.7}>
          <Ionicons name="refresh" size={22} color={PALETTE.rose} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardStack}>
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Plus de profils pour le moment.{'\n'}Repasse plus tard !
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.refreshButtonText}>Rafraîchir</Text>
            </TouchableOpacity>
          </View>
        ) : (
          users
            .slice(0, 5)
            .reverse()
            .map((user, visualIndex) => {
              const displayCount = Math.min(users.length, 5);
              const isDismissing = dismissingIds.has(user.id);

              let stackIndex;
              if (isDismissing) {
                stackIndex = displayCount - 1 - visualIndex;
              } else {
                stackIndex = visibleUsers.indexOf(user);
              }

              const isTop = !isDismissing && stackIndex === 0;

              return (
                <AnimatedCardWrapper key={user.id} stackIndex={stackIndex}>
                  <SwipeCard
                    user={user}
                    onSwipe={(dir) => handleSwipe(user.id, dir)}
                    isTop={isTop}
                  />
                </AnimatedCardWrapper>
              );
            })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.two,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  refreshCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,138,0.1)',
  },
  refreshBtn: {
    fontSize: 28,
    fontWeight: '700',
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.four,
  },
  cardWrapper: {
    position: 'absolute',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: CARD_WIDTH,
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 80,
  },
  // Info section below photo
  infoSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 4,
  },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 0 },
  infoName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  infoAge: { fontSize: 17, fontWeight: '500' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  infoLocText: { fontSize: 12, flex: 1 },
  tagsRow: { marginTop: 4 },
  tagsContent: { gap: 6, paddingRight: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  // Mini photo grid
  miniGrid: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  miniPhoto: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: PALETTE.rosePale,
  },
  miniMore: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMoreText: { fontSize: 11, fontWeight: '700', color: PALETTE.rose },
  stamp: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 12,
    borderWidth: 4,
  },
  likeStamp: {
    right: 30,
    borderColor: '#FF8FA3',
    transform: [{ rotate: '-20deg' }],
  },
  nopeStamp: {
    left: 30,
    borderColor: '#FF8FA3',
    transform: [{ rotate: '20deg' }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF8FA3',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  actionBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  nopeBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF8FA3',
    shadowColor: '#FF8FA3',
  },
  likeBtn: {
    backgroundColor: '#FF8FA3',
    shadowColor: '#FF8FA3',
  },
  actionEmoji: {
    fontSize: 22,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  refreshButton: {
    marginTop: Spacing.two,
    backgroundColor: '#FF6B8A',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 14,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
