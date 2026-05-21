import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, getStorageUrl } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';

const CATEGORY_META = {
  bar:        { label: 'Bar',        icon: 'wine-outline',       color: '#8B5CF6' },
  bowling:    { label: 'Bowling',    icon: 'trophy-outline',     color: '#3B82F6' },
  cinema:     { label: 'Cinéma',     icon: 'film-outline',       color: '#F59E0B' },
  restaurant: { label: 'Restaurant', icon: 'restaurant-outline', color: '#10B981' },
  sport:      { label: 'Sport',      icon: 'fitness-outline',    color: '#EF4444' },
  cafe:       { label: 'Café',       icon: 'cafe-outline',       color: '#92400E' },
  plage:      { label: 'Plage',      icon: 'sunny-outline',      color: '#F97316' },
  parc:       { label: 'Parc',       icon: 'leaf-outline',       color: '#22C55E' },
  autre:      { label: 'Autre',      icon: 'star-outline',       color: '#FF8FA3' },
};

function formatEventTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === todayStr) return `Aujourd'hui à ${time}`;
  if (date.toDateString() === tomorrowStr) return `Demain à ${time}`;
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ` à ${time}`;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatar(imageField) {
  if (!imageField) return null;
  const parsed = parseDbJson(imageField);
  const img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
  return img ? getStorageUrl(img) : null;
}

function MemberAvatar({ member }) {
  const img = getAvatar(member.profile_image);
  return img ? (
    <Image source={{ uri: img }} style={styles.memberAvatar} />
  ) : (
    <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
      <Text style={styles.memberAvatarInitials}>{getInitials(member.full_name)}</Text>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const flatListRef = useRef(null);

  const loadEvent = useCallback(async () => {
    try {
      const res = await eventsApi.getEvent(id);
      setEvent(res.data.event);
      setMembers(res.data.members ?? []);
    } catch (err) {
      Alert.alert('Erreur', "Impossible de charger l'événement.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await eventsApi.getMessages(id);
      setMessages(res.data.messages ?? []);
    } catch {
      // Not a member yet — ignore
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (event?.is_joined) {
      loadMessages();
    }
  }, [event?.is_joined, loadMessages]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await eventsApi.joinEvent(id);
      setEvent((e) => ({ ...e, is_joined: true, member_count: e.member_count + 1 }));
      await loadEvent();
      await loadMessages();
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.error || "Impossible de rejoindre l'événement.");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Quitter l\'événement',
      'Tu vas quitter le groupe chat. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await eventsApi.leaveEvent(id);
              setEvent((e) => ({ ...e, is_joined: false, member_count: e.member_count - 1 }));
              setMessages([]);
            } catch (err) {
              Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de quitter.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || sending) return;
    setInputText('');
    setSending(true);
    try {
      const res = await eventsApi.sendMessage(id, content);
      const msg = {
        ...res.data.message,
        sender_name: user?.full_name || user?.user_name || 'Moi',
        sender_image: user?.profile_image,
        sender_id: user?.id,
      };
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message.');
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  const openMaps = () => {
    if (!event) return;
    const q = encodeURIComponent(event.location_name);
    if (event.latitude && event.longitude) {
      const url = Platform.select({
        ios: `maps:0,0?q=${q}@${event.latitude},${event.longitude}`,
        android: `geo:${event.latitude},${event.longitude}?q=${q}`,
      });
      Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${q}`));
    } else {
      Linking.openURL(`https://maps.google.com/?q=${q}`);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === user?.id;
    const prevItem = messages[index - 1];
    const isFirstInGroup = !prevItem || prevItem.sender_id !== item.sender_id;
    const img = getAvatar(item.sender_image);

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.msgAvatarSlot}>
            {isFirstInGroup ? (
              img ? (
                <Image source={{ uri: img }} style={styles.msgAvatar} />
              ) : (
                <View style={[styles.msgAvatar, styles.msgAvatarFallback]}>
                  <Text style={styles.msgAvatarInitials}>{getInitials(item.sender_name)}</Text>
                </View>
              )
            ) : (
              <View style={styles.msgAvatarSlot} />
            )}
          </View>
        )}

        <View style={{ maxWidth: '72%' }}>
          {!isMe && isFirstInGroup && (
            <Text style={[styles.msgSenderName, { color: colors.textSecondary }]}>
              {item.sender_name}
            </Text>
          )}
          <View
            style={[
              styles.msgBubble,
              isMe
                ? { backgroundColor: PALETTE.rose }
                : { backgroundColor: colors.backgroundSelected },
            ]}
          >
            <Text style={[styles.msgText, { color: isMe ? '#fff' : colors.text }]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.msgTime, { color: colors.textSecondary, textAlign: isMe ? 'right' : 'left' }]}>
            {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const isExpired = event ? new Date(event.starts_at).getTime() + 72 * 60 * 60 * 1000 < Date.now() : false;
  const isFull = event ? event.member_count >= event.max_members : false;
  const isCreator = event?.creator_id === user?.id;

  const ListHeader = () => {
    if (!event) return null;
    const meta = CATEGORY_META[event.category] || CATEGORY_META.autre;

    return (
      <View>
        {/* Hero banner */}
        <View style={[styles.heroBanner, { backgroundColor: meta.color + '18' }]}>
          <View style={[styles.heroIcon, { backgroundColor: meta.color + '30' }]}>
            <Ionicons name={meta.icon} size={36} color={meta.color} />
          </View>
          <View style={styles.heroText}>
            <View style={[styles.heroCategoryChip, { backgroundColor: meta.color + '20' }]}>
              <Text style={[styles.heroCategoryLabel, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{event.title}</Text>
            <Text style={[styles.heroCreator, { color: colors.textSecondary }]}>
              par {event.creator_name || 'Anonyme'}
            </Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={[styles.infoCard, { backgroundColor: colors.backgroundSelected }]}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.infoText, { color: colors.text }]}>{formatEventTime(event.starts_at)}</Text>
          </View>
          <View style={styles.infoRowDivider} />
          <TouchableOpacity style={styles.infoRow} onPress={openMaps} activeOpacity={0.7}>
            <Ionicons name="location-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.infoText, styles.infoTextLink, { color: colors.text }]}>
              {event.location_name}
            </Text>
            <Ionicons name="open-outline" size={14} color={PALETTE.rose} />
          </TouchableOpacity>
          <View style={styles.infoRowDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {event.member_count}/{event.max_members} participantes
            </Text>
          </View>
        </View>

        {/* Description */}
        {!!event.description && (
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {event.description}
          </Text>
        )}

        {/* Members */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Participantes</Text>
        <View style={styles.membersRow}>
          {members.map((m) => (
            <View key={m.id} style={styles.memberItem}>
              <MemberAvatar member={m} />
              <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                {(m.full_name || '?').split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>

        {/* Join / Leave button */}
        {!isExpired && (
          event.is_joined ? (
            !isCreator && (
              <TouchableOpacity
                style={[styles.leaveBtn, { borderColor: colors.backgroundSelected }]}
                onPress={handleLeave}
                disabled={leaving}
                activeOpacity={0.7}
              >
                {leaving ? <ActivityIndicator size="small" color={colors.textSecondary} /> : (
                  <Text style={[styles.leaveBtnText, { color: colors.textSecondary }]}>Quitter l'événement</Text>
                )}
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.joinBtn, { opacity: isFull ? 0.5 : 1 }]}
              onPress={handleJoin}
              disabled={isFull || joining}
              activeOpacity={0.85}
            >
              {joining ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.joinBtnText}>{isFull ? 'Complet' : 'Rejoindre'}</Text>
                </>
              )}
            </TouchableOpacity>
          )
        )}

        {/* Chat header */}
        {event.is_joined && (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Chat du groupe</Text>
        )}

        {!event.is_joined && !isExpired && (
          <View style={[styles.chatLocked, { backgroundColor: colors.backgroundSelected }]}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
            <Text style={[styles.chatLockedText, { color: colors.textSecondary }]}>
              Rejoins l'événement pour accéder au chat
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
  }

  const meta = CATEGORY_META[event?.category] || CATEGORY_META.autre;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Sticky nav header */}
      <View style={[styles.navBar, { borderBottomColor: colors.backgroundSelected }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navTitle}>
          <View style={[styles.navCatDot, { backgroundColor: meta.color }]} />
          <Text style={[styles.navTitleText, { color: colors.text }]} numberOfLines={1}>
            {event?.title}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={event?.is_joined ? messages : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          event?.is_joined ? (
            <View style={styles.emptyChatHint}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                Dis bonjour au groupe !
              </Text>
            </View>
          ) : null
        }
      />

      {/* Chat input — only for members */}
      {event?.is_joined && !isExpired && (
        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.backgroundSelected }]}>
          <TextInput
            style={[styles.chatInput, { backgroundColor: colors.backgroundSelected, color: colors.text }]}
            placeholder="Message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: inputText.trim() ? 1 : 0.4 }]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.six + Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.two,
  },
  navCatDot: { width: 10, height: 10, borderRadius: 5 },
  navTitleText: { fontSize: 17, fontWeight: '700', flex: 1 },

  listContent: { paddingBottom: 20 },

  heroBanner: {
    flexDirection: 'row',
    gap: 14,
    padding: Spacing.four,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroText: { flex: 1, gap: 6 },
  heroCategoryChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  heroCategoryLabel: { fontSize: 12, fontWeight: '700' },
  heroTitle: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  heroCreator: { fontSize: 13 },

  infoCard: {
    marginHorizontal: Spacing.four,
    borderRadius: 16,
    paddingVertical: 4,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 16 },
  infoText: { flex: 1, fontSize: 14, fontWeight: '500' },
  infoTextLink: { textDecorationLine: 'underline' },

  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Spacing.four,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: Spacing.four,
    marginTop: 16,
    marginBottom: 10,
  },

  membersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: Spacing.four,
    marginBottom: 16,
  },
  memberItem: { alignItems: 'center', gap: 4, width: 52 },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberAvatarFallback: { backgroundColor: PALETTE.rosePale, alignItems: 'center', justifyContent: 'center' },
  memberAvatarInitials: { fontSize: 16, fontWeight: '700', color: PALETTE.rose },
  memberName: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: Spacing.four,
    marginBottom: 16,
    backgroundColor: PALETTE.rose,
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  leaveBtn: {
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  leaveBtnText: { fontSize: 14, fontWeight: '600' },

  chatLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: Spacing.four,
    padding: 16,
    borderRadius: 14,
  },
  chatLockedText: { fontSize: 14, flex: 1 },

  emptyChatHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  emptyChatText: { fontSize: 14 },

  // ── Messages ──
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    marginBottom: 2,
    gap: 6,
  },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatarSlot: { width: 30 },
  msgAvatar: { width: 30, height: 30, borderRadius: 15 },
  msgAvatarFallback: { backgroundColor: PALETTE.rosePale, alignItems: 'center', justifyContent: 'center' },
  msgAvatarInitials: { fontSize: 11, fontWeight: '700', color: PALETTE.rose },
  msgSenderName: { fontSize: 11, fontWeight: '600', marginBottom: 2, paddingHorizontal: 12 },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  msgText: { fontSize: 15, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 2, paddingHorizontal: 12 },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
