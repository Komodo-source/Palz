import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Switch,
  ActivityIndicator,
  Appearance,
  Linking,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { useAuth } from '@/contexts/auth';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usersApi, swipesApi } from '@/services/api';
import { useSnackbar } from '@/contexts/snackbar';
import storage from '@/services/storage';

function Stepper({ value, onDecrement, onIncrement, min, max, unit, isDark, colors }) {
  return (
    <View style={stepStyles.wrap}>
      <TouchableOpacity
        style={[stepStyles.btn, { backgroundColor: isDark ? '#4D3F38' : PALETTE.rosePale }]}
        onPress={onDecrement}
        disabled={value <= min}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={16} color={value <= min ? colors.textSecondary : PALETTE.rose} />
      </TouchableOpacity>
      <Text style={[stepStyles.value, { color: colors.text }]}>{value}{unit}</Text>
      <TouchableOpacity
        style={[stepStyles.btn, { backgroundColor: isDark ? '#4D3F38' : PALETTE.rosePale }]}
        onPress={onIncrement}
        disabled={value >= max}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={16} color={value >= max ? colors.textSecondary : PALETTE.rose} />
      </TouchableOpacity>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 16, fontWeight: '700', minWidth: 52, textAlign: 'center' },
});

export default function ListSettings() {
  const { user, logout, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const isDark = colorScheme === 'dark';
  const snackbar = useSnackbar();

  const [ageMin, setAgeMin] = useState(user?.age_min_filter ?? 18);
  const [ageMax, setAgeMax] = useState(user?.age_max_filter ?? 35);
  const [radius, setRadius] = useState(user?.search_radius ?? 50);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [messagePreview, setMessagePreview] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(user?.privacy !== 'hidden');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const push = await storage.getItem('pref_push');
        const preview = await storage.getItem('pref_preview');
        const sounds = await storage.getItem('pref_sounds');
        if (push !== null) setPushEnabled(push === 'true');
        if (preview !== null) setMessagePreview(preview === 'true');
        if (sounds !== null) setSoundsEnabled(sounds === 'true');
      } catch {}
    };
    loadPrefs();
  }, []);


  const saveDiscovery = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await usersApi.updateProfile({
        age_min_filter: ageMin,
        age_max_filter: ageMax,
        search_radius: radius,
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      snackbar.success('Préférences de découverte sauvegardées ✓', 2500);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder les preferences.');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async (hidden) => {
    try {
      await usersApi.updateProfile({ privacy: hidden ? 'hidden' : 'visible' });
      await refreshUser();
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder les parametres de confidentialite.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: "Rejoins Palz, l'app pour trouver des amies ! \u{1F338}",
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleRate = async () => {
    const storeUrl = Platform.select({
      ios: 'itms-apps://itunes.apple.com/app/palz',
      android: 'market://details?id=com.palzapp.palz',
      default: 'https://palzapp.com',
    });
    try {
      await Linking.openURL(storeUrl);
    } catch {
      Alert.alert(
        'Bientôt disponible',
        'Palz sera bientôt sur les stores. Merci pour ton soutien ! 🌸',
        [{ text: 'OK' }]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Se deconnecter',
      'Es-tu sure de vouloir te deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se deconnecter', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes tes données seront effacées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.updateProfile({ delete_account: true });
              Alert.alert(
                'Suppression demandée',
                'Tu vas recevoir un email pour confirmer la suppression.'
              );
            } catch {
              Alert.alert(
                'Suppression demandée',
                'Tu vas recevoir un email pour confirmer la suppression.'
              );
            }
          },
        },
      ]
    );
  };

  const handleSounds = () => {
    Alert.alert(
      'Sons',
      'Choisis quand les sons sont actifs',
      [
        {
          text: 'Activés',
          onPress: () => {
            setSoundsEnabled(true);
            storage.setItem('pref_sounds', 'true');
          },
        },
        {
          text: 'Désactivés',
          onPress: () => {
            setSoundsEnabled(false);
            storage.setItem('pref_sounds', 'false');
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleBlockedUsers = async () => {
    setLoadingBlocked(true);
    setShowBlockedModal(true);
    try {
      const res = await swipesApi.getLikes();
      // Filter out matched-only data: blocked users can come from the likes endpoint
      const blocked = (res.data?.blocked || []).map((u) => ({
        id: u.id,
        name: u.full_name || u.user_name || 'Utilisatrice',
      }));
      setBlockedUsers(blocked);
    } catch {
      setBlockedUsers([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await swipesApi.blockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      Alert.alert('Erreur', "Impossible de débloquer cette utilisatrice.");
    }
  };

  const handleReportProblem = () => {
    Alert.alert(
      'Signaler un problème',
      'Tu peux nous écrire à palzapp@support.com pour toute question ou signalement.',
      [
        {
          text: 'Nous écrire',
          onPress: async () => {
            const url = 'mailto:palzapp@support.com?subject=Signaler%20un%20problème%20Palz';
            try {
              await Linking.openURL(url);
            } catch {
              Alert.alert('Erreur', "Impossible d'ouvrir l'application email.");
            }
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleManageSubscription = () => {
    router.push('/(tabs)/profil/payement_page');
  };

  const handleOpenUrl = async (url) => {
    try {
      await openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Erreur', "Impossible d'ouvrir cette page.");
      }
    }
  };

  const handleContactUs = () => {
    Alert.alert(
      'Nous contacter',
      'Écris-nous à palzapp@support.com ou via nos réseaux sociaux.',
      [
        {
          text: 'Nous écrire',
          onPress: async () => {
            const url = 'mailto:palzapp@support.com?subject=Contact%20Palz';
            try {
              await Linking.openURL(url);
            } catch {
              Alert.alert('Erreur', "Impossible d'ouvrir l'application email.");
            }
          },
        },
        {
          text: 'Instagram',
          onPress: () => handleOpenUrl('https://www.instagram.com/palzapp'),
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const toggleDark = () => {
    try {
      Appearance.setColorScheme(isDark ? 'light' : 'dark');
    } catch {}
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Parametres</Text>
      </View>

      {/* Section: Decouverte */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DECOUVERTE</Text>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          {/* Age filter header row */}
          <View style={[styles.row, { paddingBottom: 4 }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: PALETTE.rosePale }]}>
                <Ionicons name="people-outline" size={18} color={PALETTE.rose} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Tranche d&apos;age</Text>
            </View>
          </View>

          {/* Age range steppers */}
          <View style={styles.ageRow}>
            <View style={styles.ageCol}>
              <Text style={[styles.ageColLabel, { color: colors.textSecondary }]}>De</Text>
              <Stepper
                value={ageMin}
                onDecrement={() => setAgeMin(v => Math.max(18, v - 1))}
                onIncrement={() => setAgeMin(v => Math.min(ageMax - 1, v + 1))}
                min={18}
                max={ageMax - 1}
                unit=" ans"
                isDark={isDark}
                colors={colors}
              />
            </View>
            <View style={[styles.ageColDivider, { backgroundColor: colors.border }]} />
            <View style={styles.ageCol}>
              <Text style={[styles.ageColLabel, { color: colors.textSecondary }]}>A</Text>
              <Stepper
                value={ageMax}
                onDecrement={() => setAgeMax(v => Math.max(ageMin + 1, v - 1))}
                onIncrement={() => setAgeMax(v => Math.min(60, v + 1))}
                min={ageMin + 1}
                max={60}
                unit=" ans"
                isDark={isDark}
                colors={colors}
              />
            </View>
          </View>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          {/* Search radius */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="location-outline" size={18} color="#4CAF50" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Rayon de recherche</Text>
            </View>
            <Stepper
              value={radius}
              onDecrement={() => setRadius(v => Math.max(5, v - 5))}
              onIncrement={() => setRadius(v => Math.min(500, v + 5))}
              min={5}
              max={500}
              unit=" km"
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={saveDiscovery}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{saved ? 'Sauvegarde !' : 'Sauvegarder'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Section: Notifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATIONS</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="notifications-outline" size={18} color="#2196F3" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Notifications push</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={(v) => { setPushEnabled(v); storage.setItem('pref_push', String(v)); }}
              trackColor={{ false: PALETTE.border, true: PALETTE.rose }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="chatbubble-outline" size={18} color="#FFC107" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Apercu des messages</Text>
            </View>
            <Switch
              value={messagePreview}
              onValueChange={(v) => { setMessagePreview(v); storage.setItem('pref_preview', String(v)); }}
              trackColor={{ false: PALETTE.border, true: PALETTE.rose }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.row} onPress={handleSounds} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="volume-high-outline" size={18} color="#9C27B0" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Sons</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
              {soundsEnabled ? 'Activés' : 'Désactivés'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section: Confidentialite */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONFIDENTIALITE</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="eye-off-outline" size={18} color="#F44336" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Profil visible</Text>
            </View>
            <Switch
              value={profileVisibility}
              onValueChange={(val) => {
                setProfileVisibility(val);
                savePrivacy(!val);
              }}
              trackColor={{ false: PALETTE.border, true: PALETTE.rose }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.row} onPress={handleBlockedUsers} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="ban-outline" size={18} color="#FF9800" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Utilisatrices bloquées</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
              {blockedUsers.length > 0 ? `${blockedUsers.length}` : 'Aucune'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.row} onPress={handleReportProblem} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="flag-outline" size={18} color="#4CAF50" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Signaler un problème</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section: Premium */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREMIUM</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.premiumBanner, { backgroundColor: isDark ? '#3D2D4A' : '#F0E8FF' }]}>
            <View style={styles.premiumBannerLeft}>
              <View style={[styles.premiumIconWrap, { backgroundColor: isDark ? '#6B5080' : '#E8D5F5' }]}>
                <Ionicons name="star" size={22} color={user?.is_premium ? '#7B61A8' : PALETTE.rose} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.premiumTitle, { color: user?.is_premium ? '#7B61A8' : colors.text }]}>
                  {user?.is_premium ? 'Palz Premium' : 'Passe en Premium'}
                </Text>
                <Text style={[styles.premiumSub, { color: colors.textSecondary }]}>
                  {user?.is_premium
                    ? 'Tout est debloque. Merci pour ton soutien !'
                    : 'Messages illimites, fun facts vocales, et plus encore'}
                </Text>
              </View>
            </View>
            {!user?.is_premium && (
              <TouchableOpacity
                style={styles.premiumBtn}
                onPress={() => router.push('/(tabs)/profil/payement_page')}
                activeOpacity={0.8}
              >
                <Text style={styles.premiumBtnText}>Decouvrir</Text>
              </TouchableOpacity>
            )}
          </View>

          {user?.is_premium && (
            <>
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.row} onPress={handleManageSubscription} activeOpacity={0.7}>
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
                    <Ionicons name="settings-outline" size={18} color="#9C27B0" />
                  </View>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Gérer mon abonnement</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Section: Apparence */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPARENCE</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? '#3D332E' : '#FFF9F5' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={18} color={isDark ? '#9C7FD4' : '#F59E0B'} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Mode sombre</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: PALETTE.border, true: PALETTE.rose }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* Section: Application */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPLICATION</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <TouchableOpacity style={styles.row} onPress={handleShare} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="share-social-outline" size={18} color="#2196F3" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Partager l&apos;app</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.row} onPress={handleRate} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="star-outline" size={18} color="#FFC107" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Nous noter</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section: A Propos */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>A PROPOS</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: PALETTE.rosePale }]}>
                <Ionicons name="information-circle-outline" size={18} color={PALETTE.rose} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>1.0.0</Text>
          </View>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => handleOpenUrl('https://palzapp.com/conditions-utilisation')}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="document-text-outline" size={18} color="#4CAF50" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Conditions d&apos;utilisation</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => handleOpenUrl('https://palzapp.com/confidentialite')}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#2196F3" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Politique de confidentialité</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.row} onPress={handleContactUs} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="mail-outline" size={18} color="#9C27B0" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Nous contacter</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Section: Compte */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>COMPTE</Text>
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="log-out-outline" size={18} color="#F44336" />
              </View>
              <Text style={[styles.rowLabel, { color: '#F44336' }]}>Se deconnecter</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.sep, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF9800" />
              </View>
              <Text style={[styles.rowLabel, { color: '#FF9800' }]}>Supprimer mon compte</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.version, { color: colors.textSecondary }]}>Palz v1.0.0 · Fait avec amour</Text>

      {/* ── Blocked Users Modal ── */}
      <Modal
        visible={showBlockedModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlockedModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="ban-outline" size={22} color="#FF9800" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Utilisatrices bloquées</Text>
            </View>

            {loadingBlocked ? (
              <ActivityIndicator size="large" color={PALETTE.rose} style={{ marginVertical: 40 }} />
            ) : blockedUsers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="shield-checkmark-outline" size={44} color={colors.textSecondary} />
                <Text style={[styles.modalEmptyTitle, { color: colors.text }]}>Aucune bloque</Text>
                <Text style={[styles.modalEmptyHint, { color: colors.textSecondary }]}>
                  Les utilisatrices que tu bloques apparaitront ici.
                </Text>
              </View>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.blockedList}
                renderItem={({ item }) => (
                  <View style={[styles.blockedRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.blockedAvatar, { backgroundColor: PALETTE.rosePale }]}>
                      <Text style={styles.blockedAvatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.blockedName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => handleUnblockUser(item.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={PALETTE.rose} />
                      <Text style={styles.unblockBtnText}>Débloquer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={[styles.modalCloseBtn, { borderColor: colors.border }]}
              onPress={() => setShowBlockedModal(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.text }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 56 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },

  section: { paddingHorizontal: Spacing.four, marginTop: Spacing.three },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },

  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '500' },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },

  ageRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  ageCol: { flex: 1, alignItems: 'center', gap: 8 },
  ageColLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  ageColDivider: { width: 1, height: 48, marginHorizontal: 8 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: PALETTE.rose,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDone: { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Premium banner
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  premiumBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  premiumIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  premiumSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  premiumBtn: {
    backgroundColor: '#7B61A8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  premiumBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  version: { textAlign: 'center', fontSize: 13, marginTop: 32 },

  // ── Blocked Users Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.three,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  modalEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalEmptyHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  blockedList: {
    paddingBottom: Spacing.two,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blockedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF8FA3',
  },
  blockedName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFF0F3',
  },
  unblockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8FA3',
  },
  modalCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: Spacing.two,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
