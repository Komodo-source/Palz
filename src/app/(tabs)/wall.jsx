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

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { wallApi, uploadApi, messagesApi, swipesApi, eventsApi } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';
import { useSnackbar } from '@/contexts/snackbar';

import storage from '@/services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 10;
const H_PAD = 16;
const COL_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

const IMG_HEIGHTS = [200, 250, 220, 270, 195, 240, 210, 260];
const getImgHeight = (idx) => IMG_HEIGHTS[idx % IMG_HEIGHTS.length];

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  return '> 24h';
}

// ── Reaction button ──
function ReactionButton({ item, onReact, colors }) {
  const handlePress = () => {
    onReact(item.id, item.has_reacted);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.reactBtn}
        onPress={handlePress}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={[styles.reactFlower, { opacity: item.has_reacted ? 1 : 0.4 }]}>🌸</Text>
        {item.reaction_count > 0 && (
          <Text style={[styles.reactCount, { color: item.has_reacted ? PALETTE.rose : colors.textSecondary }]}>
            {item.reaction_count}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const VIBE_TO_STYLE_W = {
  'Homebody': 'soirée cocooning 🏠', 'Bookworm': 'lecture & café ☕',
  'Sportive': 'aventures outdoor 🏃', 'Voyageuse': 'explorations urbaines 🗺️',
  'Spontanée': 'sorties impromptues ✨', 'Foodie': 'foodie dates 🍝',
  'Geek': 'gaming & séries 🎮', 'Créative': 'créa & culture 🎨',
  'Ambitieuse': 'dépassement de soi 💪', 'Artiste': 'art & culture 🎭',
};
const DISPO_TO_STYLE_W = {
  'Soirées': 'late-night talks 🌙', 'Brunchs': 'brunch & bonne humeur 🥞',
  'Apéros': 'apéro entre copines 🥂', 'Cinéma': 'movie nights 🎬',
  'Sport': 'sport & wellbeing 💪', 'Concerts': 'concerts & musique 🎵',
  'Voyages': 'road trips & escapes ✈️', 'Randos': 'randos & nature 🌿',
  'Yoga': 'zen & bien-être 🧘', 'Musées/Expos': 'culture & expos 🖼️',
};
function getTopVibeWall(user) {
  if (!user) return 'moments de partage 💕';
  const labels = user.labels && typeof user.labels === 'object' ? user.labels : {};
  const vibes = Array.isArray(labels.vibe) ? labels.vibe : [];
  const dispos = Array.isArray(labels.dispo) ? labels.dispo : [];
  for (const v of vibes) if (VIBE_TO_STYLE_W[v]) return VIBE_TO_STYLE_W[v];
  for (const d of dispos) if (DISPO_TO_STYLE_W[d]) return DISPO_TO_STYLE_W[d];
  return 'moments de partage 💕';
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
  const [weekStats, setWeekStats] = useState(null);
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
  const [recapModal, setRecapModal] = useState(false);
  const hasShownTheme = useRef(false);
  const hasCheckedRecap = useRef(false);
  const countdownInterval = useRef(null);

  const fetchWall = useCallback(async () => {
    try {
      const res = await wallApi.getPosts();
      const newTheme = res.data?.theme ?? null;
      setTheme(newTheme);
      setPosts(res.data?.posts ?? []);
      if (newTheme) {
        setCountdown(getThemeCountdown(newTheme.ends_at));
        if (!hasShownTheme.current) {
          hasShownTheme.current = true;
          setThemeModal(true);
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
    }, [fetchWall])
  );

  // ── Weekly Friendship Recap (every Sunday) ──
  useEffect(() => {
    if (hasCheckedRecap.current) return;
    hasCheckedRecap.current = true;
    const today = new Date();
    const isSunday = today.getDay() === 0;
    if (!isSunday) return;

    // Check if recap was already shown this week
    const checkRecap = async () => {
      try {
        const lastShown = await storage.getItem('weekly_recap_shown');
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        if (!lastShown || new Date(lastShown) < weekStart) {
          // Fetch real recap data
          const monday = new Date(today);
          monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
          monday.setHours(0, 0, 0, 0);
          const [convRes, matchRes, eventRes] = await Promise.all([
            messagesApi.getConversations().catch(() => ({ data: { conversations: [] } })),
            swipesApi.getMatches().catch(() => ({ data: { matches: [] } })),
            eventsApi.getEvents('joined').catch(() => ({ data: { events: [] } })),
          ]);
          const weekMessages = (convRes.data?.conversations ?? []).filter(
            (c) => c.last_message_at && new Date(c.last_message_at) >= monday
          ).length;
          setWeekStats({
            messages: weekMessages,
            interests: (matchRes.data?.matches ?? []).length,
            events: (eventRes.data?.events ?? []).length,
          });
          setRecapModal(true);
          await storage.setItem('weekly_recap_shown', today.toISOString());
        }
      } catch {
        setRecapModal(true);
      }
    };
    checkRecap();
  }, []);

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

  const handleReact = async (postId, wasReacted) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, has_reacted: !p.has_reacted, reaction_count: p.has_reacted ? Math.max(0, (p.reaction_count || 0) - 1) : (p.reaction_count || 0) + 1 }
          : p
      )
    );
    try {
      await wallApi.reactToPost(postId);
      if (wasReacted) {
        snackbar.info('Réaction retirée', 2000);
      } else {
        snackbar.like('🌸 Réaction envoyée !', 2000);
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, has_reacted: !p.has_reacted, reaction_count: p.has_reacted ? Math.max(0, (p.reaction_count || 0) - 1) : (p.reaction_count || 0) + 1 }
            : p
        )
      );
    }
  };

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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 5] });
    if (!result.canceled && result.assets?.[0]) await doUpload(result.assets[0]);
  };

  const launchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Accorde l'accès à ta galerie."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 5] });
    if (!result.canceled && result.assets?.[0]) await doUpload(result.assets[0]);
  };

  const doUpload = async (asset) => {
    setUploading(true);
    try {
      const uploadResult = await uploadApi.uploadImage({ uri: asset.uri, fileName: asset.fileName || `wall_${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg' });
      await wallApi.createPost([uploadResult.url]);
      await fetchWall();
      snackbar.success('Photo postée sur la Toile 🌸', 2500);
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
    const rawPhotos = parseDbJson(item.wall_photo);
    const photoUri = Array.isArray(rawPhotos) && rawPhotos.length > 0 ? rawPhotos[0] : null;
    const pics = parseDbJson(item.profile_image);
    const userPic = Array.isArray(pics) && pics.length > 0 ? pics[0] : null;
    const isOwn = item.user_initiator === currentUser?.id;
    const isLoadingDm = openingDm === item.user_initiator;
    const imgHeight = getImgHeight(globalIdx);

    return (
      <Animated.View
        key={String(item.id)}
        entering={FadeInDown.delay(Math.min(globalIdx * 80, 480)).duration(400).springify().damping(16)}
        style={[styles.card, { backgroundColor: colors.backgroundElement }]}
      >
        {/* Photo — tap to fullscreen */}
        <TouchableOpacity activeOpacity={0.95} onPress={() => photoUri && setViewerPhoto(photoUri)} style={styles.cardImgWrap}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={[styles.cardImg, { height: imgHeight }]} />
          ) : (
            <View style={[styles.cardImgPlaceholder, { height: imgHeight }]}>
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
                {item.user_full_name || item.user_name || 'Inconnu'}
              </Text>
            </View>

            {/* Flower reaction with bounce */}
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

  // One post per user — sorted by most liked (reaction_count descending)
  const displayPosts = useMemo(() => {
    const seen = new Set();
    return posts
      .filter((p) => {
        if (seen.has(p.user_initiator)) return false;
        seen.add(p.user_initiator);
        return true;
      })
      .sort((a, b) => (b.reaction_count || 0) - (a.reaction_count || 0));
  }, [posts]);

  const leftPosts = displayPosts.filter((_, i) => i % 2 === 0);
  const rightPosts = displayPosts.filter((_, i) => i % 2 === 1);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
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
            style={[styles.themeBanner, { backgroundColor: PALETTE.rosePale }]}
            onPress={() => setThemeModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.themeBannerLeft}>
              <Ionicons name="sparkles" size={16} color={PALETTE.rose} />
              <Text style={styles.themeText} numberOfLines={1}>{theme.title}</Text>
            </View>
            {countdown && (
              <View style={styles.countdownBadge}>
                <Ionicons name="hourglass-outline" size={12} color={PALETTE.rose} />
                <Text style={styles.countdownText}>Prochain dans {countdown}</Text>
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
              {leftPosts.map((item, i) => renderCard(item, i * 2))}
            </View>
            <View style={styles.col}>
              {rightPosts.map((item, i) => renderCard(item, i * 2 + 1))}
            </View>
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Theme modal ── */}
      <Modal visible={themeModal} transparent animationType="fade" onRequestClose={() => setThemeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.themeModalBox}>
            <View style={styles.themeModalIconWrap}>
              <Ionicons name="sparkles" size={44} color={PALETTE.rose} />
            </View>
            <Text style={styles.themeModalEyebrow}>Thème du moment ✨</Text>
            <Text style={styles.themeModalTitle}>{theme?.title || ''}</Text>
            {countdown && (
              <View style={styles.themeModalCountdown}>
                <Ionicons name="hourglass-outline" size={14} color={PALETTE.rose} />
                <Text style={styles.themeModalCountdownText}>Prochain thème dans {countdown}</Text>
              </View>
            )}
            <Text style={styles.themeModalHint}>
              Poste une photo qui correspond au thème et rencontre de nouvelles Palz !
            </Text>
            <TouchableOpacity
              style={styles.themeModalPostBtn}
              onPress={() => { setThemeModal(false); handlePostPhoto(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.themeModalPostBtnText}>Poster maintenant</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setThemeModal(false)} style={styles.themeModalSkip} activeOpacity={0.7}>
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

      {/* ── Weekly Friendship Recap Modal ── */}
      <Modal visible={recapModal} transparent animationType="slide" onRequestClose={() => setRecapModal(false)}>
        <View style={styles.recapOverlay}>
          <View style={[styles.recapBox, { backgroundColor: '#0F0A2A' }]}>
            {/* Stars */}
            <Text style={styles.recapModalStar1}>✦</Text>
            <Text style={styles.recapModalStar2}>✦</Text>
            <Text style={styles.recapModalStar3}>✦</Text>

            <View style={styles.recapHeaderIcon}>
              <Text style={styles.recapHeaderEmoji}>📊</Text>
            </View>
            <Text style={styles.recapTitle}>Bilan de ta semaine ✨</Text>
            <Text style={styles.recapSub}>Voici ton recap d'amitié cette semaine sur Palz !</Text>

            <View style={styles.recapStats}>
              {[
                { value: weekStats?.messages ?? 0, label: 'conversations actives', icon: 'chatbubbles-outline', color: '#818CF8', bg: 'rgba(99,102,241,0.12)', emoji: '💬' },
                { value: weekStats?.interests ?? 0, label: 'connexions avec intérêts communs', icon: 'sparkles-outline', color: '#34D399', bg: 'rgba(52,211,153,0.12)', emoji: '🎯' },
                { value: weekStats?.events ?? 0, label: 'événement rejoint', icon: 'calendar-outline', color: '#FB923C', bg: 'rgba(251,146,60,0.12)', emoji: '🎉' },
              ].map(({ value, label, icon, color, bg, emoji }) => (
                <View key={label} style={[styles.recapStatRow, { backgroundColor: bg }]}>
                  <View style={[styles.recapStatIconWrap, { backgroundColor: color + '28' }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recapStatValue, { color: '#fff' }]}>{value}</Text>
                    <Text style={[styles.recapStatLabel, { color: 'rgba(255,255,255,0.5)' }]}>{label}</Text>
                  </View>
                  <Text style={styles.recapStatEmoji}>{emoji}</Text>
                </View>
              ))}
            </View>

            {/* Vibe */}
            <View style={styles.recapVibeRowModal}>
              <Ionicons name="flame" size={14} color="#F59E0B" />
              <Text style={styles.recapVibeLabelModal}>Ton vibe fort : </Text>
              <Text style={styles.recapVibeValueModal}>"{getTopVibeWall(currentUser)}"</Text>
            </View>

            <Text style={styles.recapFooter}>
              Rendez-vous dimanche prochain ! 🌸
            </Text>

            <TouchableOpacity style={styles.recapBtn} onPress={() => setRecapModal(false)} activeOpacity={0.8}>
              <Text style={styles.recapBtnText}>Super ! Merci 💕</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  themeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  themeText: { fontSize: 14, fontWeight: '700', color: PALETTE.rose, flex: 1 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  countdownText: { fontSize: 11, fontWeight: '700', color: PALETTE.rose },

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
  cardImg: { width: '100%', resizeMode: 'cover' },
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

  reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reactFlower: { fontSize: 15 },
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

  // ── Theme modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  themeModalBox: { width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 28, alignItems: 'center', gap: 10 },
  themeModalIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: PALETTE.rosePale, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  themeModalEyebrow: { fontSize: 12, fontWeight: '600', color: PALETTE.rose, letterSpacing: 1, textTransform: 'uppercase' },
  themeModalTitle: { fontSize: 22, fontWeight: '800', color: '#4A3728', textAlign: 'center', lineHeight: 28 },
  themeModalCountdown: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PALETTE.rosePale, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  themeModalCountdownText: { fontSize: 13, fontWeight: '700', color: PALETTE.rose },
  themeModalHint: { fontSize: 14, color: '#7A6B60', textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  themeModalPostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PALETTE.rose, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18, marginTop: 8,
    shadowColor: PALETTE.rose, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  themeModalPostBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  themeModalSkip: { marginTop: 4 },
  themeModalSkipText: { fontSize: 13, color: '#B0A098', textDecorationLine: 'underline' },

  // ── Photo viewer ──
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  viewerImg: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.3 },
  viewerClose: { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },

  // ── Weekly recap modal ──
  recapOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  recapBox: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', gap: 14, overflow: 'hidden',
    shadowColor: '#6D28D9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16 },
  recapModalStar1: { position: 'absolute', top: 12, right: 20, fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  recapModalStar2: { position: 'absolute', top: 28, right: 50, fontSize: 7, color: 'rgba(255,255,255,0.15)' },
  recapModalStar3: { position: 'absolute', top: 20, right: 84, fontSize: 9, color: 'rgba(255,255,255,0.20)' },
  recapHeaderIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(139,92,246,0.18)', alignItems: 'center', justifyContent: 'center' },
  recapHeaderEmoji: { fontSize: 28 },
  recapTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3, color: '#fff' },
  recapSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  recapStats: { width: '100%', gap: 8, marginTop: 2 },
  recapStatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16 },
  recapStatIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recapStatValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  recapStatLabel: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  recapStatEmoji: { fontSize: 20 },
  recapVibeRowModal: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '100%',
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  recapVibeLabelModal: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  recapVibeValueModal: { fontSize: 12, color: '#FCD34D', fontWeight: '700', flex: 1 },
  recapFooter: { fontSize: 12, fontWeight: '500', textAlign: 'center', color: 'rgba(255,255,255,0.4)' },
  recapBtn: {
    width: '100%', alignItems: 'center', paddingVertical: 14, borderRadius: 18,
    backgroundColor: '#FF8FA3', shadowColor: '#FF8FA3',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, marginTop: 2,
  },
  recapBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
