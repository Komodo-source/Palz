import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const PALETTE = {
  rose: '#FF8FA3',
  roseLight: '#FFB5C2',
  rosePale: '#FFF0F3',
  lavender: '#E8D5F5',
  lavenderPale: '#F8F4FF',
  cream: '#FFF9F5',
  white: '#FFFFFF',
  textDark: '#4A3728',
  textMid: '#7A6B60',
  textLight: '#B0A098',
  border: '#F0E0E0',
};

export default function PayementPage() {
  const payement_screen = () => {
    router.replace('/payement_redirection');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Ionicons name="star" size={48} color={PALETTE.rose} />
          <Text style={styles.title}>Palz Premium</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.price}>10,80€</Text>
          <Text style={styles.subtitle}>par mois</Text>
        </View>

        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Ce qui est inclus :</Text>
          <View style={styles.featureRow}>
            <Ionicons name="mic" size={20} color={PALETTE.rose} />
            <Text style={styles.featureText}>Une anecdote vocale</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="infinite" size={20} color={PALETTE.rose} />
            <Text style={styles.featureText}>Swipes illimités</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="people" size={20} color={PALETTE.rose} />
            <Text style={styles.featureText}>Le dimanche : 5 personnes avec au moins 75% d'affinité</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="chatbubble" size={20} color={PALETTE.rose} />
            <Text style={styles.featureText}>Ice breaker pour une belle ouverture</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => payement_screen()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continuer pour 10,80€</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PALETTE.cream,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: PALETTE.textDark,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  price: {
    fontSize: 42,
    fontWeight: '800',
    color: PALETTE.rose,
  },
  subtitle: {
    fontSize: 16,
    color: PALETTE.textMid,
    marginTop: 4,
  },
  featuresCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
    gap: 14,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.textDark,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: PALETTE.textMid,
    flex: 1,
  },
  button: {
    height: 56,
    borderRadius: 20,
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
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
