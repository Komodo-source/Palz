import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { usersApi, swipesApi } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, getColors } from '@/constants/theme';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.four * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.55;
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

// Card component with gesture handling
function SwipeCard({ user, onSwipe, isTop }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

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

  // Get first profile image or placeholder
  const profilePic =
    user.profile_image && Array.isArray(user.profile_image) && user.profile_image.length > 0
      ? user.profile_image[0]
      : null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundElement,
            shadowColor: colors.text,
          },
          animatedStyle,
        ]}
      >
        {/* Image area */}
        <View style={styles.imageContainer}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.image} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={styles.placeholderEmoji}>🌸</Text>
            </View>
          )}

          {/* LIKE / NOPE overlays */}
          <Animated.View style={[styles.stamp, styles.likeStamp, likeOpacity]}>
            <Text style={styles.stampText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.nopeStamp, nopeOpacity]}>
            <Text style={styles.stampText}>NOPE</Text>
          </Animated.View>

          {/* Gradient overlay at bottom */}
          <View style={styles.gradientOverlay}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user.full_name || user.user_name},{' '}
                {user.date_of_birth ? calculateAge(user.date_of_birth) : '?'}
              </Text>
              {user.location ? (
                <Text style={styles.userLocation}>📍 {user.location}</Text>
              ) : null}
              {user.bio ? (
                <Text style={styles.userBio} numberOfLines={2}>
                  {user.bio}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

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
            <Text style={styles.actionEmoji}>✕</Text>
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
            <Text style={styles.actionEmoji}>♥</Text>
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

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.discover();
      setUsers(res.data.users);
    } catch (err) {
      console.error('Discover error:', err);
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
      // Remove from local state immediately for smooth animation
      setUsers((prev) => prev.filter((u) => u.id !== targetId));

      try {
        const res = await swipesApi.swipe(targetId, direction);

        if (res.data.matched) {
          Alert.alert("🎉 It's a Match!", 'You can now chat with each other!', [
            { text: 'Cool!', style: 'default' },
          ]);
        }

        // Fetch more if running low
        if (users.length <= 3) {
          const more = await usersApi.discover();
          setUsers((prev) => [...prev, ...more.data.users]);
        }
      } catch (err) {
        console.error('Swipe error:', err);
      }
    },
    [users.length]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF6B8A" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Finding people near you...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Discover</Text>
        <TouchableOpacity onPress={handleRefresh} activeOpacity={0.7}>
          <Text style={[styles.refreshBtn, { color: '#FF6B8A' }]}>
            {refreshing ? '⟳' : '↻'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card stack */}
      <View style={styles.cardStack}>
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No more profiles nearby.{'\n'}Check back later!
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          users
            .slice(0, 5)
            .reverse()
            .map((user, index) => {
              const isTop = index === Math.min(users.length - 1, 4);
              return (
                <View
                  key={user.id}
                  style={[
                    styles.cardWrapper,
                    {
                      zIndex: -index,
                      transform: [
                        { scale: 1 - (Math.min(users.length - 1, 4) - index) * 0.03 },
                      ],
                      marginTop: (Math.min(users.length - 1, 4) - index) * 6,
                    },
                  ]}
                >
                  <SwipeCard
                    user={user}
                    onSwipe={(dir) => handleSwipe(user.id, dir)}
                    isTop={isTop}
                  />
                </View>
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
    width: '100%',
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
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.six + Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  userInfo: {
    gap: Spacing.half,
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  userLocation: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginTop: Spacing.half,
  },
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
    borderColor: '#4CD964',
    transform: [{ rotate: '-20deg' }],
  },
  nopeStamp: {
    left: 30,
    borderColor: '#FF3B30',
    transform: [{ rotate: '20deg' }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#4CD964',
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
    borderColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  likeBtn: {
    backgroundColor: '#4CD964',
    shadowColor: '#4CD964',
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
