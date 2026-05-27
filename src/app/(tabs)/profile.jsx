import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStorageUrl, swipesApi } from '@/services/api';
import { parseDbJson } from '@/utils/parsers';
import { usersApi } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_W = (SCREEN_WIDTH - 48 - 8) / 3;

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

export default function ProfileScreen() {
  const { user } = useAuth();
  const { logout } =useAuth();

  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [numberPhoto, SetnumberPhoto] = useState(null);
  const [numberRelation, setNumberRelation] = useState(null);

  useEffect(() => {
    if (!user) return;
    parseNumberPhotos();
    parseNumberRelation();
    // swipesApi.getMatches().then((res) => {
    //   setMatchCount(res.data?.matches?.length ?? 0);

    // }).catch(() => {});
  }, []);

  if (!user) return <Text>Loading...</Text>;

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


  const parseNumberRelation = async() => {
    const res = await usersApi.getNumberRelation();
    setNumberRelation(res.data?.nb_relation.count);
  }


  const parseNumberPhotos = async() => {
    const res = await usersApi.getNumberPhoto()
    SetnumberPhoto(res.data?.nb_photo.number_photo_posted);
  }

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

  return (
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
        <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.statValue}>
            {typeof numberRelation === 'string' || typeof numberRelation === 'number' ? numberRelation : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Relations</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.statValue}>
            {typeof numberPhoto === 'string' || typeof numberPhoto === 'number' ? numberPhoto : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Photos</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.statValue}>
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
              : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Membre</Text>
        </View>
      </View>

      {/* Photos gallery */}
      {photos.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="images-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Mes photos</Text>
          </View>
          <View style={styles.photoGrid}>
            {photos.map((p, i) => (
              <Image
                key={i}
                source={{ uri: getStorageUrl(p) }}
                style={styles.photoThumb}
                resizeMode="cover"
              />
            ))}
          </View>
        </View>
      )}

      {/* Bio */}

      {/* FIX: Ensure user.bio is actually a string before rendering */}
      {user?.bio && typeof user?.bio === 'string' ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>À propos</Text>
          </View>
          <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
        </View>
      ) : null}

      {/* Info list */}
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-circle-outline" size={18} color={PALETTE.rose} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Informations</Text>
        </View>

        <InfoRow icon="mail-outline" label="Email" value={user?.email} color="#5B8FF9" />
        <InfoRow icon="calendar-outline" label="Date de naissance" value={formatDate(user?.date_of_birth)} color={PALETTE.rose} />
        <InfoRow icon="briefcase-outline" label="Métier" value={user?.work} color="#52C41A" />
        <InfoRow icon="heart-outline" label="Situation" value={situationLabel} color="#FF7E7E" />
        <InfoRow icon="location-outline" label="Localisation" value={user?.location || user?.home_location} color="#FFA940" />
        <InfoRow icon="call-outline" label="Téléphone" value={user?.phone} color="#13C2C2" />
        <InfoRow
          icon="star-outline"
          label="Signe astrologique"
          value={user?.astrology_sign_id ? 'Renseigné' : null}
          color="#B37FEB"
        />
      </View>

      {/* Interests */}
      {interests.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
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
        </View>
      )}

      {/* Membership */}
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
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
      </View>

      {/* Bouton modifier */}
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => router.push('/(tabs)/profil/editing_profil')}
        activeOpacity={0.8}
      >
        <Ionicons name="create-outline" size={20} color={PALETTE.white} />
        <Text style={styles.editButtonText}>Modifier mon profil</Text>
      </TouchableOpacity>


      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => router.push('/(tabs)/')}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color={PALETTE.error} />
        <Text style={styles.logoutText}>Paramètre</Text>
      </TouchableOpacity>



      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color={PALETTE.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>



      <Text style={[styles.version, { color: colors.textSecondary }]}>
        Palz v1.0.0 · Fait avec amour
      </Text>
    </ScrollView>
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
    height: PHOTO_W * 1.25,
    borderRadius: 12,
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
});
