import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { messagesApi, uploadApi, getStorageUrl } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_BUBBLE_W = SCREEN_WIDTH * 0.6;

// ── Date separator helpers ──
function formatDateSeparator(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[date.getDay()];
  }
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const { user: currentUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const isDark = colorScheme === 'dark';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [conversation, setConversation] = useState(null);
  const flatListRef = useRef(null);
  const pollInterval = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await messagesApi.getMessages(conversationId);
      setMessages(res.data?.messages ?? []);
      if (res.data?.conversation) setConversation(res.data.conversation);
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await messagesApi.getConversations();
      const conv = res.data.conversations?.find((c) => c.id === conversationId);
      if (conv) setConversation(conv);
    } catch (err) {
      console.error('Fetch conversation error:', err);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    fetchConversation();
    pollInterval.current = setInterval(fetchMessages, 10000);
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, [fetchMessages, fetchConversation]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !conversationId || sending) return;

    setSending(true);
    setInputText('');

    try {
      await messagesApi.sendMessage({ conversation_id: conversationId, content: text });
      await fetchMessages();
    } catch (err) {
      console.error('Send message error:', err);
      setInputText(text);

      const limitReached = err.response?.data?.limit_reached;
      if (limitReached) {
        Alert.alert(
          'Limite atteinte',
          err.response.data.error || 'Passe Premium pour envoyer plus de messages.',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Devenir Premium', onPress: () => router.push('/(tabs)/profil/payement_page') },
          ]
        );
      }
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    Alert.alert('Envoyer une image', 'Choisis la source', [
      {
        text: 'Appareil photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "Autorise l'accès à l'appareil photo.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
          });
          if (!result.canceled && result.assets?.length > 0) {
            await sendImage(result.assets[0]);
          }
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "Autorise l'accès à tes photos.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
          });
          if (!result.canceled && result.assets?.length > 0) {
            await sendImage(result.assets[0]);
          }
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const sendImage = async (asset) => {
    if (!conversationId || uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const ext = asset.uri.split('.').pop() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const { url } = await uploadApi.uploadImage({
        uri: asset.uri,
        fileName: `chat_img.${ext}`,
        mimeType,
      });

      await messagesApi.sendMessage({
        conversation_id: conversationId,
        content: '',
        message_type: 'image',
        media_url: url,
      });
      await fetchMessages();
    } catch (err) {
      console.error('Image send error:', err);
      const limitReached = err.response?.data?.limit_reached;
      if (limitReached) {
        Alert.alert(
          'Limite atteinte',
          err.response.data.error || 'Passe Premium pour envoyer plus de messages.',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Devenir Premium', onPress: () => router.push('/(tabs)/profil/payement_page') },
          ]
        );
      } else {
        Alert.alert('Oups', "L'image n'a pas pu être envoyée.");
      }
    } finally {
      setUploadingMedia(false);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const otherUserImage = (() => {
    if (!conversation?.other_user_image) return null;
    const parsed = parseDbJson(conversation.other_user_image);
    const img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
    return img ? getStorageUrl(img) : null;
  })();
  const otherUserName = conversation?.other_user_name || 'Chat';

  const renderMessage = ({ item, index }) => {
    const isMine = item.sender_id === currentUser?.id;
    const prevItem = index > 0 ? messages[index - 1] : null;
    const nextItem = index < messages.length - 1 ? messages[index + 1] : null;
    const showDateSep = !prevItem || !isSameDay(prevItem.created_at, item.created_at);
    const isFirst = !prevItem || prevItem.sender_id !== item.sender_id;
    const isLast = !nextItem || nextItem.sender_id !== item.sender_id;
    const isImage = item.message_type === 'image' && item.media_url;

    const bubbleRadius = isMine
      ? {
          borderTopRightRadius: isFirst ? 20 : 6,
          borderBottomRightRadius: isLast ? 6 : 6,
          borderTopLeftRadius: 20,
          borderBottomLeftRadius: 20,
        }
      : {
          borderTopLeftRadius: isFirst ? 20 : 6,
          borderBottomLeftRadius: isLast ? 6 : 6,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
        };

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: colors.backgroundSelected }]} />
            <View style={[styles.dateBadge, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                {formatDateSeparator(item.created_at)}
              </Text>
            </View>
            <View style={[styles.dateLine, { backgroundColor: colors.backgroundSelected }]} />
          </View>
        )}

        <View style={[
          styles.messageRow,
          isMine ? styles.rowRight : styles.rowLeft,
          { marginTop: isFirst ? 6 : 2 },
        ]}>
          {/* Other user avatar — only show for last message in group */}
          {!isMine && (
            <View style={styles.avatarSlot}>
              {isLast ? (
                <View style={styles.msgAvatar}>
                  {otherUserImage ? (
                    <Image source={{ uri: otherUserImage }} style={styles.msgAvatarImg} />
                  ) : (
                    <View style={[styles.msgAvatarFallback, { backgroundColor: PALETTE.rosePale }]}>
                      <Ionicons name="person" size={14} color={PALETTE.rose} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}

          {isImage ? (
            <View style={[styles.imgBubble, bubbleRadius]}>
              <Image
                source={{ uri: getStorageUrl(item.media_url) }}
                style={styles.chatImage}
                resizeMode="cover"
              />
              <View style={[styles.imgMeta, isMine && styles.imgMetaRight]}>
                <Text style={styles.imgTime}>{formatTime(item.created_at)}</Text>
                {isMine && (
                  <Ionicons
                    name={item.is_seen ? 'checkmark-done' : 'checkmark'}
                    size={12}
                    color="rgba(255,255,255,0.8)"
                  />
                )}
              </View>
            </View>
          ) : (
            <View style={[
              styles.bubble,
              bubbleRadius,
              isMine
                ? { backgroundColor: PALETTE.rose }
                : { backgroundColor: isDark ? '#3D332E' : '#F5EDEA' },
            ]}>
              <Text style={[
                styles.msgText,
                { color: isMine ? '#fff' : colors.text },
              ]}>
                {item.content}
              </Text>
              <View style={styles.msgMeta}>
                <Text style={[styles.msgTime, { color: isMine ? 'rgba(255,255,255,0.65)' : colors.textSecondary }]}>
                  {formatTime(item.created_at)}
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.is_seen ? 'checkmark-done' : 'checkmark'}
                    size={13}
                    color={item.is_seen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => (
            <TouchableOpacity
              style={styles.headerTitle}
              onPress={() => conversation?.other_user_id && router.push(`/(tabs)/user/${conversation.other_user_id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.headerAvatarWrap}>
                {otherUserImage ? (
                  <Image source={{ uri: otherUserImage }} style={styles.headerAvatarImg} />
                ) : (
                  <View style={[styles.headerAvatarFallback, { backgroundColor: PALETTE.rosePale }]}>
                    <Ionicons name="person" size={18} color={PALETTE.rose} />
                  </View>
                )}
                <View style={styles.onlineDot} />
              </View>
              <View>
                <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                  {otherUserName}
                </Text>
                <Text style={[styles.headerSub, { color: PALETTE.rose }]}>En ligne</Text>
              </View>
            </TouchableOpacity>
          ),
          headerBackTitle: '',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyAvatar, { backgroundColor: PALETTE.rosePale }]}>
                {otherUserImage ? (
                  <Image source={{ uri: otherUserImage }} style={styles.emptyAvatarImg} />
                ) : (
                  <Ionicons name="person-outline" size={40} color={PALETTE.rose} />
                )}
              </View>
              <Text style={[styles.emptyName, { color: colors.text }]}>{otherUserName}</Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Envoie le premier message !
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: isDark ? '#3D332E' : PALETTE.border,
          },
        ]}>
          {/* Image button */}
          <TouchableOpacity
            style={[styles.mediaBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale }]}
            onPress={handlePickImage}
            disabled={uploadingMedia || sending}
            activeOpacity={0.7}
          >
            {uploadingMedia ? (
              <ActivityIndicator size="small" color={PALETTE.rose} />
            ) : (
              <Ionicons name="image-outline" size={22} color={PALETTE.rose} />
            )}
          </TouchableOpacity>

          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDark ? '#3D332E' : '#F5EDEA',
                color: colors.text,
              },
            ]}
            placeholder="Message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={5000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              { opacity: inputText.trim().length > 0 && !sending ? 1 : 0.4 },
            ]}
            onPress={handleSend}
            disabled={inputText.trim().length === 0 || sending}
            activeOpacity={0.7}
          >
            <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap: { width: 38, height: 38, position: 'relative' },
  headerAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#52C41A',
    borderWidth: 2, borderColor: '#fff',
  },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, fontWeight: '600' },

  // Messages
  msgList: { paddingHorizontal: 8, paddingVertical: 12, flexGrow: 1 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 4,
  },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },

  avatarSlot: { width: 30, marginRight: 6 },
  avatarSpacer: { width: 30 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarFallback: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  bubble: {
    maxWidth: SCREEN_WIDTH * 0.72,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 3,
  },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgMeta: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-end', gap: 3,
  },
  msgTime: { fontSize: 10 },

  // Image bubble
  imgBubble: {
    width: IMG_BUBBLE_W,
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  chatImage: {
    width: IMG_BUBBLE_W,
    height: IMG_BUBBLE_W * 0.75,
  },
  imgMeta: {
    position: 'absolute',
    bottom: 6, left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  imgMetaRight: { left: undefined, right: 8 },
  imgTime: { fontSize: 10, color: '#fff' },

  // Date separator
  dateSeparator: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 14, paddingHorizontal: 16,
  },
  dateLine: { flex: 1, height: 1 },
  dateBadge: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, marginHorizontal: 8,
  },
  dateText: { fontSize: 12, fontWeight: '600' },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 12, paddingHorizontal: 32,
  },
  emptyAvatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyAvatarImg: { width: 80, height: 80, borderRadius: 40 },
  emptyName: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  mediaBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 1,
  },
  textInput: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 120, minHeight: 42,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: PALETTE.rose,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 1,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
});
