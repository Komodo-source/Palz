import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { ActivityIndicator, View, Text } from 'react-native';

export default function RootIndex() {
  const { isAuthenticated, isLoading } = useAuth();

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
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
