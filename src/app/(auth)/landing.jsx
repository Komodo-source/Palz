import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { authApi } from '@/services/api';
import { PALETTE } from '@/constants/theme';

// Avatar trio shown in the hero illustration strip
const AVATARS = [
  { uri: 'https://images.pexels.com/photos/1267708/pexels-photo-1267708.jpeg?auto=compress&cs=tinysrgb&w=300', name: 'Léa', icon: 'heart' },
  { uri: 'https://images.pexels.com/photos/3937468/pexels-photo-3937468.jpeg?auto=compress&cs=tinysrgb&w=300', name: 'Manon', icon: 'flower' },
  { uri: 'https://images.pexels.com/photos/28320375/pexels-photo-28320375.jpeg?auto=compress&cs=tinysrgb&w=300', name: 'Chloé', icon: 'rose' },
];

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { googleLogin } = useAuth();
  const googleAuth = useGoogleAuth();
  const [loading, setLoading] = React.useState(false);

  // Gentle floating animation for the avatar bubbles
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  const handleGoogle = async () => {
    const idToken = await googleAuth.signInWithGoogle();
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await authApi.googleAuth(idToken);
      const { user, token: newToken, isNewUser } = res.data;
      await googleLogin(user, newToken);
      router.replace(isNewUser ? '/onboarding' : '/(tabs)');
    } catch (err) {
      console.error('Google auth error:', err);
      Alert.alert('Erreur', err.response?.data?.error || 'Connexion Google échouée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* ── Soft decorative background blobs ── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, { width: 220, height: 220, top: -60, right: -60, backgroundColor: 'rgba(255,143,163,0.18)' }]} />
        <View style={[styles.blob, { width: 160, height: 160, top: 140, left: -50, backgroundColor: 'rgba(123,97,168,0.10)' }]} />
        <View style={[styles.blob, { width: 300, height: 300, bottom: 60, right: -110, backgroundColor: 'rgba(255,143,163,0.12)' }]} />
        <View style={[styles.blob, { width: 180, height: 180, bottom: 200, left: -50, backgroundColor: 'rgba(255,181,194,0.22)' }]} />
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}>

        {/* ── Logo zone ── */}
        <View style={styles.logoZone}>
          <View style={styles.appIcon}>
            <Ionicons name="flower" size={50} color="#fff" />
            <View style={styles.iconSparkle}>
              <Ionicons name="sparkles" size={14} color={PALETTE.roseLight} />
            </View>
          </View>

          <Text style={styles.appName}>
            <Text style={{ color: PALETTE.rose }}>C</Text>opines
          </Text>

          <View style={styles.flowerRow}>
            <Ionicons name="flower-outline" size={16} color={PALETTE.roseLight} />
            <Ionicons name="rose-outline" size={18} color={PALETTE.rose} />
            <Ionicons name="flower-outline" size={16} color={PALETTE.roseLight} />
          </View>

          <Text style={styles.tagline}>
            Rencontre des femmes{'\n'}
            <Text style={styles.taglineHighlight}>qui te ressemblent</Text>
          </Text>
        </View>

        {/* ── Avatar illustration strip ── */}
        <Animated.View style={[styles.illustrationStrip, { transform: [{ translateY }] }]}>
          {AVATARS.map((a, i) => {
            const center = i === 1;
            const size = center ? 82 : 62;
            return (
              <View key={a.name} style={[styles.avatarBubble, center && { marginHorizontal: 4 }]}>
                <View style={[styles.avatarImgWrap, center && styles.avatarImgWrapCenter, { width: size, height: size, borderRadius: size / 2 }]}>
                  <Image source={{ uri: a.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <View style={styles.avatarBadge}>
                    <Ionicons name={a.icon} size={11} color={PALETTE.rose} />
                  </View>
                </View>
                <Text style={styles.avatarName}>{a.name}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* ── CTA section ── */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            disabled={loading || !googleAuth.isReady}
            activeOpacity={0.85}
          >
            {googleAuth.isLoading || loading ? (
              <ActivityIndicator color={PALETTE.textMid} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#2D1B2E" />
                <Text style={styles.googleBtnText}>Continuer avec Google</Text>
              </>
            )}
          </TouchableOpacity>

          {googleAuth.error ? <Text style={styles.googleError}>{googleAuth.error}</Text> : null}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.emailBtn}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.85}
          >
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <Text style={styles.emailBtnText}>{"Continuer avec l'email"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLinkText}>
              Déjà membre ? <Text style={styles.loginLinkAccent}>Se connecter</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            {"En continuant, tu acceptes nos Conditions d'utilisation\net notre Politique de confidentialité"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.cream },
  blob: { position: 'absolute', borderRadius: 999 },

  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'space-between' },

  // Logo
  logoZone: { alignItems: 'center', marginTop: 24 },
  appIcon: {
    width: 110,
    height: 110,
    borderRadius: 32,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  iconSparkle: { position: 'absolute', top: -4, right: -2 },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#2D1B2E',
    letterSpacing: -0.5,
    marginTop: 18,
  },
  flowerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  tagline: {
    marginTop: 22,
    fontSize: 17,
    fontWeight: '600',
    color: '#6B4A5E',
    textAlign: 'center',
    lineHeight: 26,
  },
  taglineHighlight: { color: '#7B61A8', fontWeight: '800' },

  // Avatars
  illustrationStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
  },
  avatarBubble: { alignItems: 'center', gap: 6 },
  avatarImgWrap: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarImgWrapCenter: { borderColor: PALETTE.rose },
  avatarBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarName: { fontSize: 12, fontWeight: '700', color: '#9C7CAA' },

  // CTA
  ctaSection: { gap: 14 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(255,143,163,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#2D1B2E' },
  googleError: { color: PALETTE.error, fontSize: 12, textAlign: 'center' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(201,176,190,0.4)' },
  dividerText: { color: '#C9B0BE', fontSize: 13, fontWeight: '600' },

  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 58,
    borderRadius: 20,
    backgroundColor: PALETTE.rose,
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  emailBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  loginLink: { alignItems: 'center', paddingVertical: 2 },
  loginLinkText: { fontSize: 14, fontWeight: '600', color: '#B49CB0' },
  loginLinkAccent: { color: '#7B61A8', fontWeight: '800' },

  terms: {
    textAlign: 'center',
    fontSize: 11,
    color: '#C9B0BE',
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 4,
  },
});
