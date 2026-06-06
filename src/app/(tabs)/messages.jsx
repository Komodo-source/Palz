import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { messagesApi, eventsApi, getStorageUrl } from '@/services/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';
import { useSnackbar } from '@/contexts/snackbar';
import { MessagesSkeleton } from '@/components/Skeleton';
import cache from '@/services/cache';

const CATEGORY_ICONS = {
  bar: 'wine-outline',
  bowling: 'trophy-outline',
  cinema: 'film-outline',
  restaurant: 'restaurant-outline',
  sport: 'fitness-outline',
  cafe: 'cafe-outline',
  plage: 'sunny-outline',
  parc: 'leaf-outline',
  autre: 'star-outline',
};

const CATEGORY_COLORS = {
  bar: '#8B5CF6', bowling: '#3B82F6', cinema: '#F59E0B', restaurant: '#10B981',
  sport: '#EF4444', cafe: '#92400E', plage: '#F97316', parc: '#22C55E', autre: '#FF8FA3',
};

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const snackbar = useSnackbar();

  const [conversations, setConversations] = useState([]);
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async ({ background = false } = {}) => {
    try {
      const [convRes, eventRes] = await Promise.all([
        messagesApi.getConversations(),
        eventsApi.getEvents('joined').catch(() => ({ data: { events: [] } })),
      ]);
      const conversations = convRes.data?.conversations ?? [];
      const now = new Date();
      const events = (eventRes.data?.events ?? []).filter(
        (e) => !e.starts_at || new Date(e.starts_at) > now
      );
      setConversations(conversations);
      setJoinedEvents(events);
      cache.set('messages_list', { conversations, events });
    } catch (err) {
      if (!background) {
        console.error('Failed to load messages:', err);
        Alert.alert('Erreur', "Impossible de charger les conversations.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      cache.get('messages_list').then((cached) => {
        if (cancelled) return;
        if (cached) {
          setConversations(cached.conversations);
          setJoinedEvents(cached.events);
          setLoading(false);
          fetchAll({ background: true });
        } else {
          fetchAll();
        }
      });
      return () => { cancelled = true; };
    }, [fetchAll])
  );

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Maintenant';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const formatEventTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const todayStr = now.toDateString();
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === todayStr) return `Aujourd'hui ${time}`;
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ` ${time}`;
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatar = (imageField) => {
    if (!imageField) return null;
    const parsed = parseDbJson(imageField);
    const img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
    return img ? getStorageUrl(img) : null;
  };

  // ── Event bubble ──
  const renderEventBubble = (event, index) => {
    const color = CATEGORY_COLORS[event.category] || PALETTE.rose;
    const icon = CATEGORY_ICONS[event.category] || 'calendar-outline';
    const isFull = event.member_count >= event.max_members;

    return (
      <View key={event.id}>
        <TouchableOpacity
          style={[styles.eventBubble, { borderColor: color + '40' }]}
          onPress={() => router.push(`/(tabs)/event/${event.id}`)}
          activeOpacity={0.7}
        >
        <View style={[styles.eventIconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.eventBubbleTitle, { color: colors.text }]} numberOfLines={1}>
          {typeof event.title === 'string' ? event.title : ''}
        </Text>
        <Text style={[styles.eventBubbleTime, { color: colors.textSecondary }]} numberOfLines={1}>
          {formatEventTime(event.starts_at)}
        </Text>
        <View style={styles.eventMembersRow}>
          <Ionicons name="people-outline" size={11} color={isFull ? '#EF4444' : colors.textSecondary} />
          <Text style={[styles.eventMembersText, { color: isFull ? '#EF4444' : colors.textSecondary }]}>
            {typeof event.member_count === 'number' ? event.member_count : '?'}/{typeof event.max_members === 'number' ? event.max_members : '?'}
          </Text>
        </View>        </TouchableOpacity>
      </View>
    );
  };

  // ── Conversation row ──
  const renderItem = ({ item, index }) => {
    // ── DEBUG ──
    ['last_message', 'other_user_name', 'other_user_image'].forEach((f) => {
      const v = item[f];
      if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        console.warn(`[OBJECT RENDER BUG] conversation.${f}`, JSON.stringify(v));
      }
    });
    // ── END DEBUG ──
    const img = getAvatar(item.other_user_image);
    const isMe = item.last_message_sender_id && item.last_message_sender_id !== item.other_user_id;
    const streak = item.streak ?? 0;

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 55, 400)).duration(380).springify().damping(16)}>
        <TouchableOpacity
          style={[styles.convItem, { borderBottomColor: colors.backgroundSelected }]}
          onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
          activeOpacity={0.7}
        >
        {/* Avatar — tap to view profile */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => router.push(`/(tabs)/user/${item.other_user_id}`)}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          activeOpacity={0.7}
        >
          {img ? (
            <Image source={{ uri: img }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: PALETTE.rosePale }]}>
              <Text style={styles.avatarInitials}>{getInitials(item.other_user_name)}</Text>
            </View>
          )}
          {item.has_unread && <View style={styles.unreadDot} />}
          {streak >= 2 && (
            <View style={styles.streakAvatarBadge}>
              <Text style={styles.streakAvatarText}>🔥</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.convBody}>
          <View style={styles.convTop}>
            <Text style={[styles.convName, { color: colors.text }]} numberOfLines={1}>
              {typeof item.other_user_name === 'string' ? item.other_user_name : ''}
            </Text>
            <View style={styles.convTopRight}>
              {streak >= 1 && (
                <View style={styles.streakPill}>
                  <Text style={styles.streakPillText}>🔥 {streak}</Text>
                </View>
              )}
              <Text style={[styles.convTime, { color: colors.textSecondary }]}>
                {formatTime(item.last_message_at)}
              </Text>
            </View>
          </View>
          <View style={styles.convBottom}>
            {item.has_unread && <View style={[styles.unreadPip, { backgroundColor: PALETTE.rose }]} />}
            <Text
              style={[
                styles.convPreview,
                {
                  color: item.has_unread ? colors.text : colors.textSecondary,
                  fontWeight: item.has_unread ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {isMe
                ? `Toi: ${typeof item.last_message === 'string' ? item.last_message : ''}`
                : ((typeof item.last_message === 'string' && item.last_message) || 'Aucun message')}
            </Text>
          </View>
        </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return <MessagesSkeleton colors={colors} isDark={colorScheme === 'dark'} />;
  }

  const hasContent = conversations.length > 0 || joinedEvents.length > 0;

  const ListHeader = () => (
    <>
      {/* Joined events row */}
      {joinedEvents.length > 0 && (
        <View style={styles.eventsSection}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="calendar-outline" size={14} color={PALETTE.rose} />
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Mes événements</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eventsRow}
          >
            {joinedEvents.map(renderEventBubble)}
          </ScrollView>
        </View>
      )}

      {/* Matches row removed — tap conversation avatar to view profile */}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Vos Copines</Text>
        {conversations.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: PALETTE.rosePale }]}>
            <Text style={styles.countText}>{conversations.length}</Text>
          </View>
        )}
      </View>

      {!hasContent ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyCircle, { backgroundColor: PALETTE.rosePale }]}>
            <Ionicons name="chatbubble-ellipses" size={40} color={PALETTE.rose} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Pas encore de copines
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Swipe des profils et fais des matchs pour commencer à discuter !
          </Text>
          <TouchableOpacity
            style={styles.discoverBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            <Ionicons name="flower-outline" size={18} color={PALETTE.white} />
            <Text style={styles.discoverBtnText}>Découvrir</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchAll(); }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={
            joinedEvents.length > 0 ? (
              <View style={styles.noConvHint}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.noConvText, { color: colors.textSecondary }]}>
                  Pas encore de conversations — rejoins un événement !
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
  },
  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.rose,
  },

  // ── Events row ──
  eventsSection: {
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
    marginBottom: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.four,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  eventsRow: {
    paddingHorizontal: Spacing.four,
    gap: 10,
  },
  eventBubble: {
    width: 130,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 10,
    gap: 4,
    backgroundColor: 'transparent',
  },
  eventIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  eventBubbleTitle: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  eventBubbleTime: { fontSize: 11, lineHeight: 14 },
  eventMembersRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  eventMembersText: { fontSize: 11, fontWeight: '600' },

  // ── Conversation list ──
  listContent: {
    paddingBottom: Spacing.six,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 20, fontWeight: '700', color: PALETTE.rose },
  unreadDot: {
    position: 'absolute', top: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: PALETTE.rose,
    borderWidth: 2.5, borderColor: '#fff',
  },
  convBody: { flex: 1, gap: 3 },
  convTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: { fontSize: 16, fontWeight: '700', flex: 1 },
  convTopRight: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  convTime: { fontSize: 12, fontWeight: '500' },
  convBottom: { flexDirection: 'row', alignItems: 'center' },
  unreadPip: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  convPreview: { fontSize: 14, lineHeight: 20, flex: 1 },

  // ── Streak ──
  streakAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFD580',
  },
  streakAvatarText: { fontSize: 11, lineHeight: 14 },
  streakPill: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FFD580',
  },
  streakPillText: { fontSize: 11, fontWeight: '800', color: '#D97706' },

  // ── Empty states ──
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: Spacing.four,
  },
  emptyCircle: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: {
    fontSize: 15, textAlign: 'center', lineHeight: 22,
    paddingHorizontal: Spacing.four,
  },
  discoverBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: PALETTE.rose,
    paddingHorizontal: Spacing.four, paddingVertical: 12,
    borderRadius: 16,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  discoverBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  noConvHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 32,
  },
  noConvText: { fontSize: 15 },
});
