import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { messagesApi } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';

export default function ChatListScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await messagesApi.getConversations();
      setConversations(res.data.conversations);
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Hier';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    }
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={[styles.conversationItem, { borderBottomColor: colors.backgroundSelected }]}
      onPress={() => router.push({pathname: `/(tabs)/chat/${item.id}`, params: {other_user_name: item.other_user_name, id_other: item.other_user_id}})}
      activeOpacity={0.7}
    >

      <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}>
        <Text style={styles.avatarEmoji}>
          {item.other_user?.profile_image ? '👤' : '🍒'}
        </Text>
      </View>
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.conversationName, { color: colors.text }]} numberOfLines={1}>
            {typeof item.other_user?.full_name === 'string' ? item.other_user?.full_name : (typeof item.other_user?.user_name === 'string' ? item.other_user?.user_name : 'Inconnue')}
          </Text>
          <Text style={[styles.conversationTime, { color: colors.textSecondary }]}>
            {formatTime(item.last_message?.created_at)}
          </Text>
        </View>
        <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
          {(typeof item.last_message?.content === 'string' && item.last_message.content) || 'Aucun message'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#C4325E" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Conversations</Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderConversation}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#C4325E" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Pas encore de conversations.{'\n'}Matche avec quelqu'un pour discuter !
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  list: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 26,
  },
  conversationInfo: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  conversationTime: {
    fontSize: 13,
    marginLeft: Spacing.two,
  },
  lastMessage: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six * 2,
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
