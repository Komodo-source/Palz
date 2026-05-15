import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleProfileEditing = () => {
    router.push('/(tabs)/profil/editing_profil');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}>
          <Ionicons name="person" size={48} color={colors.text} />
        </View>
        <Text style={[styles.displayName, { color: colors.text }]}>
          {user?.full_name || user?.user_name || 'User'}
        </Text>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
          @{user?.user_name || 'unknown'}
        </Text>
      </View>

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.email || 'Not set'}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date of Birth</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.date_of_birth || 'Not set'}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.location || user?.home_location || 'Not set'}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Bio</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.bio || 'No bio yet'}
          </Text>
        </View>


      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* Modify my profile */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleProfileEditing}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>Editer mon profil</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.textSecondary }]}>
        Palz v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
  },
  username: {
    fontSize: 16,
  },
  infoSection: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  infoCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    marginTop: Spacing.four,
    fontSize: 13,
  },
});
