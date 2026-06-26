import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { paymentsApi } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import ConfettiCannon from '@/components/ConfettiCannon';

// react-native-purchases native module is not available in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

const PALETTE = {
  rose: '#C4325E',
  roseLight: '#E07A95',
  rosePale: '#FFF0F3',
  cream: '#FFFFFF',
  white: '#FFFFFF',
  textDark: '#222222',
  textMid: '#717171',
  textLight: '#9A9A9A',
  gold: '#F59E0B',
  goldLight: '#FEF3C7',
};

const FEATURES = [
  { icon: 'mic',        text: 'Une anecdote vocale pour se présenter' },
  { icon: 'infinite',   text: 'Swipes illimités chaque jour' },
  { icon: 'people',     text: 'Le dimanche : 5 profils avec ≥ 75% d\'affinité' },
  { icon: 'chatbubble', text: 'Ice breaker pour une belle première phrase' },
  { icon: 'star',       text: 'Badge Premium visible sur ton profil' },
];

// Opens the OS subscription management screen (App Store or Play Store)
function openSubscriptionManagement() {
  const url = Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
  Linking.openURL(url).catch(() => {
    Alert.alert('Erreur', 'Impossible d\'ouvrir la gestion des abonnements.');
  });
}

export default function PayementPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | success
  const [isPremium, setIsPremium] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    paymentsApi.getStatus()
      .then((res) => setIsPremium(res.data?.is_premium || false))
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleBuyPremium = async () => {
    if (status === 'loading') return;

    if (isExpoGo) {
      Alert.alert(
        'Non disponible dans Expo Go',
        'Les achats in-app nécessitent une version complète de l\'application. Télécharge Palz depuis l\'App Store ou Google Play.',
        [{ text: 'OK' }]
      );
      return;
    }

    setStatus('loading');

    try {
      const Purchases = (await import('react-native-purchases')).default;

      // Link this device's purchases to our user ID so the backend webhook
      // receives the correct app_user_id
      await Purchases.logIn(String(user.id));

      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.monthly
        ?? offerings.current?.availablePackages?.[0];

      if (!pkg) {
        setStatus('idle');
        Alert.alert('Indisponible', 'L\'abonnement n\'est pas disponible pour le moment. Réessaie plus tard.');
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (customerInfo.entitlements.active['premium']) {
        setIsPremium(true);
        setStatus('success');
      } else {
        setStatus('idle');
        Alert.alert('Erreur', 'Paiement reçu mais l\'activation a échoué. Contacte le support.');
      }
    } catch (err) {
      setStatus('idle');
      // err.userCancelled is true when the user dismisses the payment sheet
      if (!err.userCancelled) {
        console.log(err.message)
        Alert.alert('Paiement échoué', err.message || 'Une erreur est survenue. Réessaie.');
      }
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Gérer l\'abonnement',
      'Tu peux annuler ou modifier ton abonnement depuis les réglages de l\'App Store / Google Play.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ouvrir les réglages',
          onPress: openSubscriptionManagement,
        },
      ]
    );
  };

  if (checkingStatus) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
  }

  // ── Already premium ──────────────────────────────────────────────────────
  if (isPremium) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={PALETTE.rose} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>

        <View style={styles.premiumBadgeWrap}>
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={44} color={PALETTE.gold} />
          </View>
          <Text style={styles.premiumTitle}>Tu es Premium ✨</Text>
          <Text style={styles.premiumSub}>Profite de tous tes avantages Palz !</Text>
        </View>

        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: PALETTE.rosePale }]}>
                <Ionicons name={f.icon} size={18} color={PALETTE.rose} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleManageSubscription} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>Gérer l'abonnement</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Payment success state ────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <View style={{ flex: 1 }}>
        <ConfettiCannon firing />
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.successWrap}>
            <View style={styles.successCircle}>
              <Text style={styles.successEmoji}>🎉</Text>
            </View>
            <Text style={styles.successTitle}>Bienvenue Premium !</Text>
            <Text style={styles.successSub}>
              Ton paiement a été confirmé. Tous tes avantages sont maintenant actifs.
            </Text>

            <View style={styles.featuresCard}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={[styles.featureIconWrap, { backgroundColor: PALETTE.rosePale }]}>
                    <Ionicons name={f.icon} size={18} color={PALETTE.rose} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/(tabs)/profile')}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.buttonText}>Commencer</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Default: pricing page ────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={20} color={PALETTE.rose} />
        <Text style={styles.backText}>Retour</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.starBadge}>
          <Ionicons name="star" size={32} color={PALETTE.gold} />
        </View>
        <Text style={styles.title}>Copines Premium</Text>
        <Text style={styles.headerSub}>Toutes les fonctionnalités, sans limite</Text>
      </View>

      <View style={styles.priceCard}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>8,99€</Text>
          <Text style={styles.pricePeriod}>/mois</Text>
        </View>
        <Text style={styles.priceSub}>Sans engagement · Annulable à tout moment</Text>
        <View style={styles.priceDivider} />
        <View style={styles.trialRow}>
          <Ionicons
            name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google-playstore'}
            size={16}
            color={PALETTE.rose}
          />
          <Text style={styles.trialText}>
            Paiement sécurisé via {Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay'}
          </Text>
        </View>
      </View>

      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>Ce qui est inclus</Text>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={[styles.featureIconWrap, { backgroundColor: PALETTE.rosePale }]}>
              <Ionicons name={f.icon} size={18} color={PALETTE.rose} />
            </View>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, status === 'loading' && styles.buttonLoading]}
        onPress={handleBuyPremium}
        disabled={status === 'loading'}
        activeOpacity={0.85}
      >
        {status === 'loading' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="lock-open-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Continuer pour 8,99€</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.legalText}>
        En continuant, tu acceptes nos conditions d'utilisation. L'abonnement est renouvelé automatiquement chaque mois. Tu peux annuler à tout moment depuis les réglages de l'App Store ou Google Play.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.cream },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.cream },
  scrollContent: { paddingHorizontal: 22, paddingTop: Platform.OS === 'ios' ? 56 : 32, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24 },
  backText: { fontSize: 15, fontWeight: '600', color: PALETTE.rose },

  header: { alignItems: 'center', gap: 10, marginBottom: 24 },
  starBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: PALETTE.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 30, fontWeight: '800', color: PALETTE.textDark, letterSpacing: -0.5 },
  headerSub: { fontSize: 15, color: PALETTE.textMid, textAlign: 'center' },

  priceCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  price: { fontSize: 46, fontWeight: '800', color: PALETTE.rose, lineHeight: 52 },
  pricePeriod: { fontSize: 18, fontWeight: '600', color: PALETTE.textMid, marginBottom: 8 },
  priceSub: { textAlign: 'center', fontSize: 13, color: PALETTE.textLight, marginTop: 4, marginBottom: 14 },
  priceDivider: { height: 1, backgroundColor: '#EBEBEB', marginBottom: 14 },
  trialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  trialText: { fontSize: 13, fontWeight: '600', color: PALETTE.textMid },

  featuresCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  featuresTitle: { fontSize: 17, fontWeight: '700', color: PALETTE.textDark, marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureText: { fontSize: 14, color: PALETTE.textMid, flex: 1, lineHeight: 20 },

  button: {
    height: 58,
    borderRadius: 20,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 16,
  },
  buttonLoading: { opacity: 0.75 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  legalText: {
    fontSize: 11,
    color: PALETTE.textLight,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  premiumBadgeWrap: { alignItems: 'center', gap: 10, marginBottom: 24, marginTop: 8 },
  premiumBadge: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: PALETTE.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
  premiumTitle: { fontSize: 28, fontWeight: '800', color: PALETTE.textDark },
  premiumSub: { fontSize: 15, color: PALETTE.textMid, textAlign: 'center' },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: PALETTE.textLight },

  successWrap: { alignItems: 'center', gap: 16, paddingTop: 40 },
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center', justifyContent: 'center',
  },
  successEmoji: { fontSize: 50 },
  successTitle: { fontSize: 28, fontWeight: '800', color: PALETTE.textDark },
  successSub: { fontSize: 15, color: PALETTE.textMid, textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
});
