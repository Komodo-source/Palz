import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { ActivityIndicator, View, Text } from 'react-native';
import { hasCompletedOnboarding } from '@/utils/onboarding';

export default function RootIndex() {
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log('🔍 RootIndex render — isLoading:', isLoading, '| isAuthenticated:', isAuthenticated);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#FF6B8A" />
        <Text style={{ marginTop: 12, color: '#000' }}>Chargement...</Text>
      </View>
    );
  }

  console.log('✅ Auth ready — redirecting to:', isAuthenticated ? '/(tabs)' : '/(auth)/login');

  if (isAuthenticated) {
    // No app access until the onboarding (incl. photo verification) is finished
    if (!hasCompletedOnboarding(user)) {
      return <Redirect href="/onboarding" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/landing" />;
}
