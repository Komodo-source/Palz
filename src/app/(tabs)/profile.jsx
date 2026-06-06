import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  Modal,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/auth';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStorageUrl, swipesApi, usersApi, messagesApi, eventsApi } from '@/services/api';
import storage from '@/services/storage';
import cache from '@/services/cache';
import ImageViewerModal from '@/components/ImageViewerModal';
import { useSnackbar } from '@/contexts/snackbar';
import { parseDbJson } from '@/utils/parsers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_W = (SCREEN_WIDTH - 64 - 8) / 2; // 2-column grid = 4 large photos

function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  useEffect(() => {
    if (target === null || target === undefined) return;
    const n = Number(target);
    if (isNaN(n) || n <= 0) { setDisplay(target); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.floor(eased * n));
      if (progress < 1) frameRef.current = setTimeout(tick, 16);
      else setDisplay(n);
    };
    frameRef.current = setTimeout(tick, 16);
    return () => clearTimeout(frameRef.current);
  }, [target]);
  return display;
}

const SITUATION_LABELS = {
  couple: 'En couple',
  celibataire: 'Célibataire',
  recherche: 'En recherche',
  divorce: 'Divorcé(e)',
  complique: "C'est compliqué",
};


function InfoRow({ icon, label, value, color }) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'object'
  ) {
    return null;
  }

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <View style={styles.infoRowText}>
        <Text style={styles.infoLabel}>{String(label)}</Text>
        <Text style={styles.infoValue}>{String(value)}</Text>
      </View>
    </View>
  );
}

const VIBE_MAP = {
  'Homebody': 'soirée cocooning 🏠', 'Bookworm': 'lecture & café ☕',
  'Sportive': 'aventures outdoor 🏃', 'Voyageuse': 'explorations urbaines 🗺️',
  'Spontanée': 'sorties impromptues ✨', 'Foodie': 'foodie dates 🍝',
  'Soirées': 'late-night talks 🌙', 'Brunchs': 'brunch & bonne humeur 🥞',
  'Apéros': 'apéro entre copines 🥂', 'Cinéma': 'movie nights 🎬',
};
function getTopVibe(user) {
  if (!user) return 'moments de partage 💕';
  const labels = user.labels && typeof user.labels === 'object' ? user.labels : {};
  const all = [...(Array.isArray(labels.vibe) ? labels.vibe : []), ...(Array.isArray(labels.dispo) ? labels.dispo : [])];
  for (const v of all) if (VIBE_MAP[v]) return VIBE_MAP[v];
  return 'moments de partage 💕';
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { logout } =useAuth();

  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const snackbar = useSnackbar();

  const [numberPhoto, SetnumberPhoto] = useState(null);
  const [numberRelation, setNumberRelation] = useState(null);
  const [weekStats, setWeekStats] = useState(null);
  const [recapModal, setRecapModal] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);
  const hasCheckedRecap = useRef(false);
  const animRelation = useCountUp(numberRelation);
  const animPhoto = useCountUp(numberPhoto);

  useEffect(() => {
    if (!user) return;
    cache.get('profile_stats').then((cached) => {
      if (cached) {
        SetnumberPhoto(cached.numberPhoto);
        setNumberRelation(cached.numberRelation);
      }
      loadStats();
    });
  }, []);

  const loadStats = async () => {
    try {
      const [photoRes, relationRes] = await Promise.all([
        usersApi.getNumberPhoto(),
        usersApi.getNumberRelation(),
      ]);
      const numberPhoto = photoRes.data?.nb_photo?.number_photo_posted ?? null;
      const numberRelation = relationRes.data?.nb_relation?.count ?? null;
      SetnumberPhoto(numberPhoto);
      setNumberRelation(numberRelation);
      cache.set('profile_stats', { numberPhoto, numberRelation }, 10 * 60 * 1000);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (hasCheckedRecap.current) return;
    hasCheckedRecap.current = true;
    const today = new Date();
    if (today.getDay() !== 0) return; // dimanche uniquement
    const checkRecap = async () => {
      try {
        const lastShown = await storage.getItem('weekly_recap_shown');
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        if (lastShown && new Date(lastShown) >= weekStart) return;
        const monday = new Date(today);
        monday.setDate(today.getDate() - 6);
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
      } catch {
        setWeekStats({ messages: 0, interests: 0, events: 0 });
        setRecapModal(true);
      }
    };
    checkRecap();
  }, []);

  if (!user) return <Text style={{ textAlign: 'center', marginTop: 60 }}>Chargement...</Text>;

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment nous quitter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => {
          await logout();

          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Parse photos

  const photos = (() => {
    const raw = user?.profile_image;
    const arr = parseDbJson(raw);
    if (Array.isArray(arr) && arr.length > 0) return arr;
    if (typeof raw === 'string' && raw.length > 0) return [raw];
    return [];
  })();

  // Parse interests
  const interests = parseDbJson(user?.interests) || [];


const formatDate = (dob) => {
    if (!dob || typeof dob === 'object') return null;
    try {
      const d = new Date(dob);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return String(dob); // FIX: Ensure it always returns a string as a fallback
    }
  };

  const situationLabel = user?.situation ? (SITUATION_LABELS[user.situation] || user.situation) : null;

  // ── DEBUG ──
  ['bio', 'work', 'location', 'home_location', 'labels', 'interests', 'situation', 'email'].forEach((f) => {
    const v = user?.[f];
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      console.warn(`[OBJECT RENDER BUG] profile user.${f}`, JSON.stringify(v));
    }
  });
  // ── END DEBUG ──

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header gradient area */}
      <View style={styles.headerBg}>
        <View style={styles.header}>
          <Text style={styles.title}>Mon Profil</Text>
          {user?.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={13} color="#7B61A8" />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>
      </View>

      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrap}>
          {photos.length > 0 ? (
            <Image source={{ uri: getStorageUrl(photos[0]) }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
              <Ionicons name="person-outline" size={52} color={PALETTE.rose} />
            </View>
          )}
          {user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={22} color={PALETTE.rose} />
            </View>
          )}
        </View>
        <Text style={[styles.displayName, { color: colors.text }]}>
          {(typeof user?.full_name === 'string' && user.full_name) ||
           (typeof user?.user_name === 'string' && user.user_name) ||
           'Utilisatrice'}
        </Text>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
          @{(typeof user?.user_name === 'string' && user.user_name) || 'inconnue'}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Animated.View entering={FadeInDown.delay(80).duration(400).springify().damping(14)} style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.statValue}>
            {numberRelation !== null ? animRelation : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Copines</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(160).duration(400).springify().damping(14)} style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.statValue}>
            {numberPhoto !== null ? animPhoto : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Photos</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(240).duration(400).springify().damping(14)} style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.statValue}>
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
              : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Membre</Text>
        </Animated.View>
      </View>

      {/* Photos gallery */}
      {photos.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).duration(400).springify().damping(14)} style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="images-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Mes photos</Text>
          </View>
          <View style={styles.photoGrid}>
            {photos.slice(0, 6).map((p, i) => (
              <TouchableOpacity key={i} onPress={() => setViewerUri(getStorageUrl(p))} activeOpacity={0.85}>
                <Image
                  source={{ uri: getStorageUrl(p) }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Bio */}
      {user?.bio && typeof user?.bio === 'string' ? (
        <Animated.View entering={FadeInDown.delay(360).duration(400).springify().damping(14)} style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>À propos</Text>
          </View>
          <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
        </Animated.View>
      ) : null}

      {/* Info list */}
      <Animated.View entering={FadeInDown.delay(400).duration(400).springify().damping(14)} style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-circle-outline" size={18} color={PALETTE.rose} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Informations</Text>
        </View>

        <InfoRow icon="mail-outline" label="Email" value={user?.email} color="#5B8FF9" />
        <InfoRow icon="calendar-outline" label="Date de naissance" value={formatDate(user?.date_of_birth)} color={PALETTE.rose} />
        <InfoRow icon="briefcase-outline" label="Métier" value={user?.work} color="#52C41A" />
        <InfoRow icon="heart-outline" label="Situation" value={situationLabel} color="#FF7E7E" />
        <InfoRow icon="location-outline" label="Localisation" value={user?.location || user?.home_location} color="#FFA940" />
        <InfoRow
          icon="star-outline"
          label="Signe astrologique"
          value={user?.astrology_sign_id ? 'Renseigné' : null}
          color="#B37FEB"
        />
      </Animated.View>

      {/* Interests */}
      {interests.length > 0 && (
        <Animated.View entering={FadeInDown.delay(460).duration(400).springify().damping(14)} style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="sparkles-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Centres d'intérêt</Text>
          </View>
          <View style={styles.tagsWrap}>
            {interests.map((item, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{String(item)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Membership */}
      <Animated.View entering={FadeInDown.delay(520).duration(400).springify().damping(14)} style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="ribbon-outline" size={18} color={PALETTE.rose} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Abonnement</Text>
        </View>
        <View style={[styles.membershipRow, { backgroundColor: user?.is_premium ? '#F0E8FF' : PALETTE.rosePale }]}>
          <Ionicons
            name={user?.is_premium ? 'star' : 'star-outline'}
            size={22}
            color={user?.is_premium ? '#7B61A8' : PALETTE.rose}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.membershipTitle, { color: user?.is_premium ? '#7B61A8' : PALETTE.rose }]}>
              {user?.is_premium ? 'Premium' : 'Gratuit'}
            </Text>
            <Text style={[styles.membershipSub, { color: colors.textSecondary }]}>
              {user?.is_premium
                ? 'Accès à toutes les fonctionnalités'
                : 'Passe Premium pour tout débloquer'}
            </Text>
          </View>
          {!user?.is_premium && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/settings/list_settings')}
              style={styles.upgradeBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Bouton modifier */}
      <View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/(tabs)/profil/editing_profil')}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={20} color={PALETTE.white} />
          <Text style={styles.editButtonText}>Modifier mon profil</Text>
        </TouchableOpacity>
      </View>


      <View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => router.push('/(tabs)/settings/list_settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="cog-outline" size={20} color={PALETTE.error} />
          <Text style={styles.logoutText}>Paramètre de l'App</Text>
        </TouchableOpacity>
      </View>



      {/* Logout */}
      <View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={PALETTE.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>



      <Text style={[styles.version, { color: colors.textSecondary }]}>
        Palz v1.0.0 · Fait avec amour
      </Text>
    </ScrollView>

    <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />

    {/* ── Bilan de la semaine (dimanche uniquement) ── */}
    <Modal visible={recapModal} transparent animationType="slide" onRequestClose={() => setRecapModal(false)}>
      <View style={styles.recapOverlay}>
        <View style={styles.recapBox}>
          <Text style={styles.recapStar1}>✦</Text>
          <Text style={styles.recapStar2}>✦</Text>
          <Text style={styles.recapStar3}>✦</Text>

          <View style={styles.recapIcon}>
            <Text style={styles.recapIconEmoji}>📊</Text>
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
                <View style={[styles.recapStatIcon, { backgroundColor: color + '28' }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recapStatValue}>{value}</Text>
                  <Text style={styles.recapStatLabel}>{label}</Text>
                </View>
                <Text style={styles.recapStatEmoji}>{emoji}</Text>
              </View>
            ))}
          </View>

          <View style={styles.recapVibeRow}>
            <Ionicons name="flame" size={14} color="#F59E0B" />
            <Text style={styles.recapVibeLabel}>Ton vibe fort : </Text>
            <Text style={styles.recapVibeValue}>"{getTopVibe(user)}"</Text>
          </View>

          <Text style={styles.recapFooter}>Rendez-vous dimanche prochain ! 🌸</Text>

          <View style={styles.recapBtnRow}>
            <TouchableOpacity
              style={styles.recapShareBtn}
              onPress={() => Share.share({ message: `Mon bilan Palz cette semaine ✨\n💬 ${weekStats?.messages ?? 0} conversations actives\n🎯 ${weekStats?.interests ?? 0} connexions\n🎉 ${weekStats?.events ?? 0} événements rejoints\nVibe fort : "${getTopVibe(user)}" 🔥\n#Palz` })}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color="#818CF8" />
              <Text style={styles.recapShareBtnText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.recapCloseBtn} onPress={() => setRecapModal(false)} activeOpacity={0.8}>
              <Text style={styles.recapCloseBtnText}>Super ! Merci 💕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  headerBg: {
    backgroundColor: PALETTE.rosePale,
    paddingTop: 60,
    paddingBottom: 70,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: PALETTE.textDark,
    letterSpacing: -0.5,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8D5F5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B61A8',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -55,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: PALETTE.white,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    position: 'relative',
    backgroundColor: PALETTE.rosePale,
  },
  avatarImage: {
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  avatarPlaceholder: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: PALETTE.white,
    borderRadius: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 10,
  },
  username: {
    fontSize: 15,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: PALETTE.rose,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: PHOTO_W,
    height: PHOTO_W * 1.2,
    borderRadius: 14,
    backgroundColor: PALETTE.rosePale,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: PALETTE.textDark,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: PALETTE.rosePale,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: PALETTE.rose,
    fontWeight: '600',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
  },
  membershipTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  membershipSub: {
    fontSize: 12,
    marginTop: 1,
  },
  upgradeBtn: {
    backgroundColor: PALETTE.rose,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  upgradeBtnText: {
    color: PALETTE.white,
    fontSize: 13,
    fontWeight: '700',
  },
  editButton: {
    marginHorizontal: 16,
    marginTop: 20,
    height: 52,
    borderRadius: 18,
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
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: PALETTE.error,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: {
    color: PALETTE.error,
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
  },

  // ── Bilan de la semaine ──
  recapOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  recapBox: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', gap: 14, overflow: 'hidden', backgroundColor: '#0F0A2A', shadowColor: '#6D28D9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 16 },
  recapStar1: { position: 'absolute', top: 12, right: 20, fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  recapStar2: { position: 'absolute', top: 28, right: 50, fontSize: 7, color: 'rgba(255,255,255,0.15)' },
  recapStar3: { position: 'absolute', top: 20, right: 84, fontSize: 9, color: 'rgba(255,255,255,0.20)' },
  recapIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(139,92,246,0.18)', alignItems: 'center', justifyContent: 'center' },
  recapIconEmoji: { fontSize: 28 },
  recapTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3, color: '#fff' },
  recapSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  recapStats: { width: '100%', gap: 8, marginTop: 2 },
  recapStatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16 },
  recapStatIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recapStatValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, color: '#fff' },
  recapStatLabel: { fontSize: 11, fontWeight: '500', marginTop: 1, color: 'rgba(255,255,255,0.5)' },
  recapStatEmoji: { fontSize: 20 },
  recapVibeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '100%', backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  recapVibeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  recapVibeValue: { fontSize: 12, color: '#FCD34D', fontWeight: '700', flex: 1 },
  recapFooter: { fontSize: 12, fontWeight: '500', textAlign: 'center', color: 'rgba(255,255,255,0.4)' },
  recapBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  recapShareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(129,140,248,0.4)', backgroundColor: 'rgba(129,140,248,0.08)' },
  recapShareBtnText: { color: '#818CF8', fontWeight: '700', fontSize: 15 },
  recapCloseBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 18, backgroundColor: '#FF8FA3', shadowColor: '#FF8FA3', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  recapCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
