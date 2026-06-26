import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const PALETTE = {
  rose: '#C4325E',
  rosePale: '#FFF0F3',
  goldLight: '#FEF3C7',
  gold: '#F59E0B',
  cream: '#FFFFFF',
  textDark: '#222222',
  textMid: '#717171',
};

export default function PayementRedirection() {
  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Text style={styles.emoji}>🎉</Text>
      </View>

      <Text style={styles.title}>Paiement confirmé !</Text>
      <Text style={styles.sub}>
        Ton abonnement Copines Premium est maintenant actif. Profite de tous tes avantages !
      </Text>

      <View style={styles.badgeRow}>
        <Ionicons name="star" size={18} color={PALETTE.gold} />
        <Text style={styles.badgeText}>Premium activé</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace('/(tabs)/profile')}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={18} color="#fff" />
        <Text style={styles.btnText}>Découvrir mes avantages</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
  },
  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emoji: { fontSize: 54 },
  title: { fontSize: 28, fontWeight: '800', color: PALETTE.textDark, textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 15, color: PALETTE.textMid, textAlign: 'center', lineHeight: 22 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.goldLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  badgeText: { fontSize: 14, fontWeight: '700', color: PALETTE.gold },
  btn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.rose,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
