import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { wallApi, uploadApi, messagesApi, getStorageUrl } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson, safeStr, getProfileImages } from '@/utils/parsers';
import { useSnackbar } from '@/contexts/snackbar';

import { WallSkeleton } from '@/components/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 10;
const H_PAD = 16;
const COL_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

// Renders a wall photo at its true aspect ratio, filling the column width.
// Landscape photos come out wide-and-short; portrait ones tall — both span the full width.
function WallCardImage({ uri, onRatio }) {
  const [ratio, setRatio] = useState(0.85); // sensible default until the real size loads
  return (
    <Image
      source={{ uri }}
      style={[styles.cardImg, { aspectRatio: ratio }]}
      resizeMode="cover"
      onLoad={(e) => {
        const s = e?.nativeEvent?.source;
        if (s?.width && s?.height) {
          const r = s.width / s.height;
          setRatio(r);
          onRatio?.(uri, r);
        }
      }}
    />
  );
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffdays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffdays} jours`;
}

// ── Reaction button ──
function ReactionButton({ item, onReact, colors }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(1.45, { damping: 4, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 260 });
    });
    onReact(item.id);
  };

  return (
    <TouchableOpacity
      style={[styles.reactBtn, item.has_reacted && styles.reactBtnActive]}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={animStyle}>
        <MaterialCommunityIcons
          name="fruit-cherries"
          size={14}
          color={item.has_reacted ? '#fff' : PALETTE.rose}
        />
      </Animated.View>
      {item.reaction_count > 0 && (
        <Text style={[styles.reactCount, { color: item.has_reacted ? '#fff' : PALETTE.rose }]}>
          {item.reaction_count}
        </Text>
      )}
    </TouchableOpacity>
  );
}


function getThemeCountdown(endsAt) {
  if (!endsAt) return null;
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days}j ${remH}h`;
  }
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

export default function WallScreen() {
  const { user: currentUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const snackbar = useSnackbar();


  const [theme, setTheme] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openingDm, setOpeningDm] = useState(null);
  const [themeModal, setThemeModal] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [countdown, setCountdown] = useState(null);
  // Real width/height ratio per photo uri, reported once each image loads — drives the
  // balanced masonry distribution below.
  const [photoRatios, setPhotoRatios] = useState({});

  const handlePhotoRatio = useCallback((uri, r) => {
    if (!uri || !r) return;
    setPhotoRatios((prev) => (prev[uri] === r ? prev : { ...prev, [uri]: r }));
  }, []);
  const lastShownThemeId = useRef(null);
  const countdownInterval = useRef(null);

  // Optimistic reactions — spam guard + debounced API call
  const reactionTimestamps = useRef({});  // { postId: number[] }  — recent tap times
  const reactionDebounce   = useRef({});  // { postId: timeout }   — pending API timer
  const reactionOriginal   = useRef({});  // { postId: {has_reacted, reaction_count} } — server truth
  const pendingReacted     = useRef({});  // { postId: boolean }   — desired final state
  const spamAlertActive    = useRef(false);
  const sortedIdsRef       = useRef([]);  // stable display order from last fetch

  const SPAM_TAPS     = 4;    // alert threshold per post
  const SPAM_WINDOW   = 1200; // ms
  const DEBOUNCE_MS   = 650;  // ms before API fires

  const fetchWall = useCallback(async () => {
    try {
      const res = await wallApi.getPosts();
      const newTheme = res.data?.theme ?? null;
      const newPosts = res.data?.posts ?? [];
      setTheme(newTheme);
      setPosts(newPosts);

      // Capture display order at fetch time so reactions don't cause cards to jump
      const seen = new Set();
      sortedIdsRef.current = newPosts
        .filter(p => { if (seen.has(p.user_initiator)) return false; seen.add(p.user_initiator); return true; })
        .sort((a, b) => (b.reaction_count ?? 0) - (a.reaction_count ?? 0))
        .map(p => p.id);
      if (newTheme) {
        setCountdown(getThemeCountdown(newTheme.ends_at));
        if (lastShownThemeId.current !== newTheme.id) {
          lastShownThemeId.current = newTheme.id;
          try {
            const key = `has_seen_modal_${newTheme.id}`;
            const value = await AsyncStorage.getItem(key);
            setThemeModal(value === null);
          } catch (e) {
            console.error("Error reading from AsyncStorage:", e);
            setThemeModal(true);
          }
        }
      }
    } catch (err) {
      console.error('Wall fetch error:', err);
      Alert.alert('Erreur', 'Impossible de charger la fresque.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Clear all pending debounce timers on unmount
  useEffect(() => {
    return () => { Object.values(reactionDebounce.current).forEach(clearTimeout); };
  }, []);

  // Update countdown every minute
  useEffect(() => {
    countdownInterval.current = setInterval(() => {
      if (theme?.ends_at) setCountdown(getThemeCountdown(theme.ends_at));
    }, 60000);
    return () => clearInterval(countdownInterval.current);
  }, [theme]);

  useFocusEffect(
    useCallback(() => {
      fetchWall();
      // Reset to skeleton when leaving so the page never shows stale content while swiping back.
      return () => setLoading(true);
    }, [fetchWall])
  );


  const handleOpenDm = async (posterId) => {
    if (posterId === currentUser?.id || openingDm) return;
    setOpeningDm(posterId);
    try {
      const res = await messagesApi.startConversation(posterId);
      const { conversation_id, limit_reached, free_limit } = res.data;
      if (limit_reached) {
        Alert.alert(
          'Limite atteinte',
          `Tu as déjà envoyé ${free_limit} messages à cette personne. Deviens Premium pour continuer !`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Devenir Premium ✨', onPress: () => router.push('/(tabs)/profil/payement_page') },
            { text: 'Voir quand même', onPress: () => router.push(`/(tabs)/chat/${conversation_id}`) },
          ]
        );
      } else {
        router.push(`/(tabs)/chat/${conversation_id}`);
      }
    } catch (err) {
      console.error('Open DM error:', err);
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation.");
    } finally {
      setOpeningDm(null);
    }
  };

  const handleReact = useCallback((postId) => {
    const now = Date.now();

    // ── Spam guard ──────────────────────────────────────────────────────────
    const prev_taps = reactionTimestamps.current[postId] ?? [];
    const recent = prev_taps.filter(t => now - t < SPAM_WINDOW);
    reactionTimestamps.current[postId] = [...recent, now];

    if (recent.length >= SPAM_TAPS) {
      if (!spamAlertActive.current) {
        spamAlertActive.current = true;
        Alert.alert(
          'Du calme ! 🍒',
          'Tu appuies un peu vite sur le bouton. Prends ton temps !',
          [{ text: 'OK', onPress: () => { spamAlertActive.current = false; } }]
        );
      }
      return;
    }

    // ── Optimistic update ───────────────────────────────────────────────────
    // Capture server truth once at the start of a debounce window so rollback is correct
    setPosts(prev => {
      const post = prev.find(p => p.id === postId);
      if (!post) return prev;

      if (!reactionOriginal.current[postId]) {
        reactionOriginal.current[postId] = {
          has_reacted: post.has_reacted ?? false,
          reaction_count: post.reaction_count ?? 0,
        };
      }

      const next = !post.has_reacted;
      pendingReacted.current[postId] = next;

      return prev.map(p => p.id !== postId ? p : {
        ...p,
        has_reacted: next,
        reaction_count: next
          ? (p.reaction_count ?? 0) + 1
          : Math.max(0, (p.reaction_count ?? 0) - 1),
      });
    });

    // ── Debounced API call ──────────────────────────────────────────────────
    // Cancels previous timer so rapid taps only fire one request at the end
    clearTimeout(reactionDebounce.current[postId]);
    reactionDebounce.current[postId] = setTimeout(async () => {
      const original = reactionOriginal.current[postId];
      const desired  = pendingReacted.current[postId];

      // Net result equals server state → nothing to sync
      if (!original || desired === original.has_reacted) {
        delete reactionOriginal.current[postId];
        delete pendingReacted.current[postId];
        delete reactionDebounce.current[postId];
        return;
      }

      try {
        await wallApi.reactToPost(postId);
        snackbar[desired ? 'like' : 'info'](
          desired ? '🍒 Réaction envoyée !' : 'Réaction retirée',
          1800
        );
      } catch {
        // Rollback to the actual server state
        const orig = reactionOriginal.current[postId];
        if (orig) {
          setPosts(prev => prev.map(p => p.id !== postId ? p : { ...p, ...orig }));
        }
        snackbar.error('Réaction non envoyée', 2000);
      } finally {
        delete reactionOriginal.current[postId];
        delete pendingReacted.current[postId];
        delete reactionDebounce.current[postId];
      }
    }, DEBOUNCE_MS);
  }, [snackbar, SPAM_TAPS, SPAM_WINDOW, DEBOUNCE_MS]);

  const handlePostPhoto = () => {
    Alert.alert('Poster une photo', 'Choisis la source', [
      { text: 'Appareil photo', onPress: launchCamera },
      { text: 'Galerie', onPress: launchGallery },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Accorde l'accès à l'appareil photo."); return; }
    // No forced crop — keep the photo's natural aspect ratio so the wall can show it uncropped.
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets?.[0]) await doUpload(result.assets[0]);
  };

  const launchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Accorde l'accès à ta galerie."); return; }
    // No forced crop — keep the photo's natural aspect ratio so the wall can show it uncropped.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets?.[0]) await doUpload(result.assets[0]);
  };

  const doUpload = async (asset) => {
    setUploading(true);
    try {
      const uploadResult = await uploadApi.uploadImage({ uri: asset.uri, fileName: asset.fileName || `wall_${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg' });
      await wallApi.createPost([uploadResult.url]);
      // NSFW moderation check temporarily disabled
      // const wall = await wallApi.createPost([uploadResult.url]);
      // if (wall?.response?.nsfw) {
      //   Alert.alert("Aïe", "Votre photos contient des éléments explicites\nAttention ce type de post peut mener à des sanctions\nPour tout faux positif veuillez contacter support@copines-app.fr", [{
      //     text: "OK",
      //   }]);
      //   setUploading(false);
      //   return;
      // }
      await fetchWall();
      snackbar.success('Photo postée sur la Toile 🍒', 2500);
    } catch (err) {
      console.error('Wall upload error:', err);
      Alert.alert('Erreur', 'Impossible de poster la photo. Réessaie !');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePost = (postId) => {
    Alert.alert('Supprimer', 'Veux-tu vraiment supprimer cette photo ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await wallApi.deletePost(postId);
          fetchWall();
          snackbar.info('Photo supprimée', 2000);
        } catch {
          Alert.alert('Erreur', 'Impossible de supprimer le post.');
        }
      }},
    ]);
  };

  const renderCard = (item, globalIdx) => {
    // ── DEBUG ──
    ['user_full_name', 'user_name', 'wall_photo', 'profile_image'].forEach((f) => {
      const v = item[f];
      if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        console.warn(`[OBJECT RENDER BUG] wall.${f}`, JSON.stringify(v));
      }
    });
    // ── END DEBUG ──
    const rawPhotos = parseDbJson(item.wall_photo);
    const photoUri = Array.isArray(rawPhotos) && rawPhotos.length > 0 ? getStorageUrl(rawPhotos[0]) : null;
    const pics = parseDbJson(item.profile_image);
    const userPic = Array.isArray(pics) && pics.length > 0 ? getStorageUrl(pics[0]) : null;
    const isOwn = item.user_initiator === currentUser?.id;
    const isLoadingDm = openingDm === item.user_initiator;

    return (
      <Animated.View
        key={String(item.id)}
        entering={FadeInDown.delay(Math.min(globalIdx * 80, 480)).duration(400).springify().damping(16)}
        style={[styles.card, { backgroundColor: colors.backgroundElement }]}
      >
        {/* Photo — tap to fullscreen */}
        <TouchableOpacity activeOpacity={0.95} onPress={() => photoUri && setViewerPhoto(photoUri)} style={styles.cardImgWrap}>
          {photoUri ? (
            <WallCardImage uri={photoUri} onRatio={handlePhotoRatio} />
          ) : (
            <View style={[styles.cardImgPlaceholder, { height: 200 }]}>
              <Ionicons name="image-outline" size={32} color={PALETTE.rose} />
            </View>
          )}

          {/* Expiry badge top-right */}
          <View style={styles.expiryBadge}>
            <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.9)" />
            <Text style={styles.expiryText}>{formatTimeAgo(item.created_at)}</Text>
          </View>

          {/* Own post — delete overlay */}
          {isOwn && (
            <TouchableOpacity style={styles.deleteOverlay} onPress={() => handleDeletePost(item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="trash-outline" size={13} color="#fff" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.cardFooter}>
          {/* User row */}
          <View style={styles.cardUserRow}>
            {userPic ? (
              <Image source={{ uri: userPic }} style={styles.cardAvatar} />
            ) : (
              <View style={[styles.cardAvatarPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
                <Ionicons name="person" size={10} color={PALETTE.rose} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                {safeStr(item.user_full_name) || safeStr(item.user_name, 'Inconnu')}
              </Text>
            </View>

            {/* Cherry reaction with bounce */}
            <ReactionButton item={item} onReact={handleReact} colors={colors} />
          </View>

          {/* Action buttons row */}
          <View style={styles.cardBtnsRow}>
            {/* Voir profil */}
            {!isOwn && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { backgroundColor: PALETTE.rosePale }]}
                onPress={() => router.push(`/(tabs)/user/${item.user_initiator}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={12} color={PALETTE.rose} />
                <Text style={[styles.cardActionBtnText, { color: PALETTE.rose }]}>Voir profil</Text>
              </TouchableOpacity>
            )}

            {/* Message / DM */}
            {!isOwn && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { backgroundColor: colors.backgroundSelected }]}
                onPress={() => handleOpenDm(item.user_initiator)}
                disabled={isLoadingDm}
                activeOpacity={0.7}
              >
                {isLoadingDm
                  ? <ActivityIndicator size="small" color={PALETTE.rose} />
                  : <>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.cardActionBtnText, { color: colors.textSecondary }]}>Message</Text>
                    </>
                }
              </TouchableOpacity>
            )}
            </View>
        </View>
      </Animated.View>
    );
  };

  const dismissModal = async () => {
    setThemeModal(false);
    if (theme?.id) {
      try {
        await AsyncStorage.setItem(`has_seen_modal_${theme.id}`, 'true');
      } catch (e) {
        console.error('Error saving to AsyncStorage:', e);
      }
    }
  };

  // One post per user — order is locked at fetch time so reactions don't cause cards to jump
  const displayPosts = useMemo(() => {
    const seen = new Set();
    const unique = posts.filter(p => {
      if (seen.has(p.user_initiator)) return false;
      seen.add(p.user_initiator);
      return true;
    });
    return unique.sort((a, b) => {
      const ai = sortedIdsRef.current.indexOf(a.id);
      const bi = sortedIdsRef.current.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [posts]);

  // Balanced masonry: place each post in whichever column is currently shorter,
  // using the photo's real aspect ratio, so the two columns stay even and we don't
  // leave a big blank at the bottom of the shorter one.
  const FOOTER_EST = 96; // approx non-image card height (user row + action buttons + padding)
  const { leftPosts, rightPosts, orderIndex } = useMemo(() => {
    const left = [];
    const right = [];
    const order = new Map();
    let leftH = 0;
    let rightH = 0;
    displayPosts.forEach((post, i) => {
      order.set(post.id, i);
      const raw = parseDbJson(post.wall_photo);
      const uri = Array.isArray(raw) && raw.length > 0 ? getStorageUrl(raw[0]) : null;
      const ratio = (uri && photoRatios[uri]) || 0.85; // width / height
      const cardH = COL_WIDTH / ratio + FOOTER_EST;
      if (leftH <= rightH) {
        left.push(post);
        leftH += cardH;
      } else {
        right.push(post);
        rightH += cardH;
      }
    });
    return { leftPosts: left, rightPosts: right, orderIndex: order };
  }, [displayPosts, photoRatios]);

  if (loading) {
    return <WallSkeleton colors={colors} isDark={colorScheme === 'dark'} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>La Toile</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Photos éphémères</Text>
          </View>
          <TouchableOpacity
            style={[styles.postBtn, { opacity: uploading ? 0.6 : 1 }]}
            onPress={handlePostPhoto}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.postBtnText}>Poster</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Theme banner + countdown */}
        {theme && (
          <TouchableOpacity
            style={styles.themeBanner}
            onPress={() => setThemeModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.themeBannerLeft}>
              <Text style={styles.themeLabel}>Thème du moment</Text>
              <View style={styles.themeTitleRow}>
                <Ionicons name="sparkles" size={15} color="#fff" />
                <Text style={styles.themeText} numberOfLines={1}>{typeof theme.title === 'string' ? theme.title : ''}</Text>
              </View>
            </View>
            {countdown && (
              <View style={styles.countdownBadge}>
                <Ionicons name="hourglass-outline" size={12} color="#fff" />
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ── */}
      {displayPosts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyCircle, { backgroundColor: PALETTE.rosePale }]}>
            <Ionicons name="images-outline" size={36} color={PALETTE.rose} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune photo pour le moment</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sois la première à partager une photo sur le thème du jour !
          </Text>
          <TouchableOpacity style={styles.emptyPostBtn} onPress={handlePostPhoto} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.postBtnText}>Poster une photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchWall(); }}
              tintColor={PALETTE.rose}
            />
          }
        >
          <View style={styles.cols}>
            <View style={styles.col}>
              {leftPosts.map((item) => renderCard(item, orderIndex.get(item.id) ?? 0))}
            </View>
            <View style={styles.col}>
              {rightPosts.map((item) => renderCard(item, orderIndex.get(item.id) ?? 0))}
            </View>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <Modal visible={themeModal} transparent animationType="fade" onRequestClose={() => setThemeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.themeModalBox}>
            <View style={styles.themeModalIconWrap}>
              <Ionicons name="sparkles" size={44} color={PALETTE.rose} />
            </View>
            <Text style={styles.themeModalEyebrow}>Thème du moment ✨</Text>
            <Text style={styles.themeModalTitle}>{safeStr(theme?.title)}</Text>
            {countdown && (
              <View style={styles.themeModalCountdown}>
                <Ionicons name="hourglass-outline" size={14} color={PALETTE.rose} />
                <Text style={styles.themeModalCountdownText}>Prochain thème dans {countdown}</Text>
              </View>
            )}
            <Text style={styles.themeModalHint}>
              Poste une photo qui correspond au thème et rencontre de nouvelles copines !
            </Text>
            <TouchableOpacity
              style={styles.themeModalPostBtn}
              onPress={() => { setThemeModal(false); handlePostPhoto(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.themeModalPostBtnText}>Poster maintenant</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissModal} style={styles.themeModalSkip} activeOpacity={0.7}>
              <Text style={styles.themeModalSkipText}>Voir le mur d'abord</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Full-screen photo viewer ── */}
      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <TouchableOpacity style={styles.viewerOverlay} activeOpacity={1} onPress={() => setViewerPhoto(null)}>
          {viewerPhoto && <Image source={{ uri: viewerPhoto }} style={styles.viewerImg} resizeMode="contain" />}
          <View style={styles.viewerClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
  header: {
    paddingHorizontal: H_PAD,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
    gap: 10,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2 },

  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PALETTE.rose,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  themeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: PALETTE.rose,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  themeBannerLeft: { flex: 1, gap: 4 },
  themeLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, textTransform: 'uppercase' },
  themeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  themeText: { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.28)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  countdownText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // ── Pinterest grid ──
  grid: { paddingHorizontal: H_PAD, paddingTop: Spacing.two },
  cols: { flexDirection: 'row', gap: GAP },
  col: { flex: 1, gap: GAP },

  // ── Card ──
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardImgWrap: { position: 'relative' },
  cardImg: { width: '100%' },
  cardImgPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.rosePale },

  expiryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  expiryText: { fontSize: 10, color: '#fff', fontWeight: '600' },

  deleteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardFooter: { padding: 10, gap: 8 },

  cardUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardAvatar: { width: 26, height: 26, borderRadius: 13 },
  cardAvatarPlaceholder: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 12, fontWeight: '700' },

  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: PALETTE.rosePale,
    borderWidth: 1.5,
    borderColor: '#FFD6DE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reactBtnActive: { backgroundColor: PALETTE.rose, borderColor: PALETTE.rose },
  reactCount: { fontSize: 11, fontWeight: '700' },

  cardBtnsRow: { flexDirection: 'row', gap: 6 },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cardActionBtnText: { fontSize: 11, fontWeight: '700' },

  // ── Empty state ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  emptyCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.four },
  emptyPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PALETTE.rose, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two,
    borderRadius: 16, marginTop: Spacing.two,
    shadowColor: PALETTE.rose, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  themeModalBox: { width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center', gap: 10 },
  themeModalIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: PALETTE.rosePale, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  themeModalEyebrow: { fontSize: 13, fontWeight: '600', color: PALETTE.rose },
  themeModalTitle: { fontSize: 22, fontWeight: '800', color: '#222222', textAlign: 'center', lineHeight: 28 },
  themeModalCountdown: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PALETTE.rosePale, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  themeModalCountdownText: { fontSize: 13, fontWeight: '700', color: PALETTE.rose },
  themeModalHint: { fontSize: 14, color: '#717171', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  themeModalPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PALETTE.rose, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18, marginTop: 8,
    shadowColor: PALETTE.rose, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  themeModalPostBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  themeModalSkip: { marginTop: 4 },
  themeModalSkipText: { fontSize: 13, color: '#9A9A9A', textDecorationLine: 'underline' },

  // ── Photo viewer ──
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.3 },
  viewerClose: { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },

});
