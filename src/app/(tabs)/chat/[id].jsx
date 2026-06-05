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
  Animated,
  Modal,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { messagesApi, usersApi, uploadApi, getStorageUrl } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageViewerModal from '@/components/ImageViewerModal';

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

const WAVEFORM = [4, 7, 12, 8, 16, 10, 6, 14, 9, 13, 7, 11, 16, 5, 10, 13, 8, 15, 11, 6];

function VoiceMessageBubble({ uri, isMine, colors, isDark, time, isSeen }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status?.playing ?? false;
  const duration = status?.duration ?? 0;
  const position = status?.currentTime ?? 0;
  const progress = duration > 0 ? position / duration : 0;

  const fmtDur = (secs) => {
    const s = Math.floor(secs ?? 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const toggle = async () => {
    if (isPlaying) {
      player.pause();
    } else {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.play();
    }
  };
  const activeColor = isMine ? '#fff' : PALETTE.rose;
  const inactiveColor = isMine ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';

  return (
    <View style={[
      vStyles.wrap,
      isMine ? { backgroundColor: PALETTE.rose } : { backgroundColor: isDark ? '#3D332E' : '#F5EDEA' },
    ]}>
      <TouchableOpacity
        onPress={toggle}
        style={[vStyles.playBtn, { backgroundColor: isMine ? 'rgba(255,255,255,0.22)' : PALETTE.rosePale }]}
        activeOpacity={0.7}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={isMine ? '#fff' : PALETTE.rose} />
      </TouchableOpacity>

      <View style={vStyles.mid}>
        <View style={vStyles.waveform}>
          {WAVEFORM.map((h, i) => (
            <View
              key={i}
              style={[
                vStyles.bar,
                {
                  height: h,
                  backgroundColor: i / WAVEFORM.length <= progress ? activeColor : inactiveColor,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[vStyles.dur, { color: isMine ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>
          {fmtDur(position > 0 ? position : duration)}
        </Text>
      </View>

      <View style={vStyles.meta}>
        <Text style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.65)' : colors.textSecondary }}>{time}</Text>
        {isMine && (
          <Ionicons
            name={isSeen ? 'checkmark-done' : 'checkmark'}
            size={11}
            color={isSeen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'}
          />
        )}
      </View>
    </View>
  );
}

const vStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    minWidth: 190,
    maxWidth: SCREEN_WIDTH * 0.72,
  },
  playBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  mid: { flex: 1, gap: 5 },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 20,
  },
  bar: { width: 3, borderRadius: 2 },
  dur: { fontSize: 10, fontWeight: '600' },
  meta: { gap: 2, alignItems: 'flex-end', flexShrink: 0 },
});

export default function ChatScreen() {
  const { id} = useLocalSearchParams();
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
  const [iceBreaker, setIceBreaker] = useState(null);
  const [iceBreakerLoading, setIceBreakerLoading] = useState(false);
  const [iceBreakerDismissed, setIceBreakerDismissed] = useState(false);
  const iceBreakerAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const pollInterval = useRef(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [isRecording, setIsRecording] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);
  const recordTimerRef = useRef(null);
  const { other_user_name, id_other } = useLocalSearchParams();

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await messagesApi.getMessages(conversationId);
      const msgs = res.data?.messages ?? [];

      //reading cache
      let value;
      try{
        value = await AsyncStorage.getItem(`message_${res.data.conversation.other_user_id}`);
      }catch(e){
        ;
      }
      if (value){
      try{
          setMessages(await AsyncStorage.setItem(`message_${res.data.conversation.other_user_id}`, msgs))
        }catch(e){
          console.error(`caching error ${e}`);
        }
      }else{
        setMessages(msgs);
      }

      //cache storage

      if (res.data?.conversation) {
        setConversation(res.data.conversation);
        if (msgs.length === 0 && res.data.conversation.other_user_id && !iceBreaker && !iceBreakerDismissed) {
          fetchIceBreaker(res.data.conversation.other_user_id);
        }
      }
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

  const fetchIceBreaker = async (userId) => {
    if (!userId || iceBreakerLoading) return;
    setIceBreakerLoading(true);
    try {
      const res = await messagesApi.genrateIceBreaker({ other_user_id: userId });
      const data = res.data;
      if (data?.message || data?.ice_breaker) {
        setIceBreaker(data);
        // Animate card in
        Animated.spring(iceBreakerAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      }
    } catch (err) {
      console.error('Fetch ice breaker error:', err);
    } finally {
      setIceBreakerLoading(false);
    }
  };

  const handleUseIceBreaker = () => {
    const text = iceBreaker?.message || iceBreaker?.ice_breaker || '';
    if (text) {
      setInputText(text);
      dismissIceBreaker();
    }
  };

  const handleRefreshIceBreaker = () => {
    setIceBreaker(null);
    Animated.timing(iceBreakerAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      if (conversation?.other_user_id) {
        fetchIceBreaker(conversation.other_user_id);
      }
    });
  };

  const dismissIceBreaker = () => {
    Animated.timing(iceBreakerAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIceBreakerDismissed(true);
      setIceBreaker(null);
    });
  };

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
      await messagesApi.updateStreak({
        conversationId: conversationId
      });
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
      await messagesApi.updateStreak({
        conversationId: conversationId
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

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission requise', "Autorise l'accès au micro pour enregistrer des messages vocaux.");
      return;
    }
    try {
      //await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      })
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      recordTimerRef.current = setTimeout(() => stopAndSendRecording(), 60000);
    } catch (err) {
      console.error('Start recording error:', err);
      setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    }
  };

  const stopAndSendRecording = async () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    setIsRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (uri) await sendVoiceMessage(uri);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    setIsRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (_) {}
  };

  const reportUser = () => {
    if (!conversation?.other_user_id) return;
    Alert.alert(
      'Signaler cette utilisatrice',
      'Es-tu sûre de vouloir signaler ce profil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Signaler',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.reportUser({ reportedUserID: conversation.other_user_id, reason: 'inappropriate' });
              Alert.alert('Signalement envoyé', 'Merci, notre équipe va examiner ce profil.');
            } catch (err) {
              console.error('Report Error:', err);
              Alert.alert('Erreur', 'Impossible d\'envoyer le signalement.');
            }
          },
        },
      ]
    );
  };

  const sendVoiceMessage = async (uri) => {
    if (!conversationId || uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const { url } = await uploadApi.uploadAudio({
        uri,
        fileName: `voice_${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
      });
      await messagesApi.sendMessage({
        conversation_id: conversationId,
        content: '',
        message_type: 'voice',
        media_url: url,
      });

      await messagesApi.updateStreak({
        conversationId: conversationId
      });

      await fetchMessages();
    } catch (err) {
      console.error('Voice send error:', err);
      Alert.alert('Oups', "Le message vocal n'a pas pu être envoyé.");
    } finally {
      setUploadingMedia(false);
    }
  };


  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // ── Ice Breaker card ──
  const renderIceBreakerCard = () => {
    if (!iceBreaker || iceBreakerDismissed) return null;
    const raw = iceBreaker?.message || iceBreaker?.ice_breaker || '';
    const message = typeof raw === 'string' ? raw : '';
    if (!message) return null;

    const translateY = iceBreakerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [60, 0],
    });
    const opacity = iceBreakerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <Animated.View
        style={[
          styles.iceBreakerWrap,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View style={[styles.iceBreakerCard, { backgroundColor: isDark ? '#3D2A3A' : '#FFF0F3' }]}>
          {/* Gradient shimmer overlay */}
          <View style={styles.iceBreakerShimmer}>
            <View style={[styles.iceBreakerShimmerDot, { backgroundColor: 'rgba(255,143,163,0.19)' }]} />
            <View style={[styles.iceBreakerShimmerDot2, { backgroundColor: 'rgba(232,213,245,0.15)' }]} />
          </View>


          {/* Header */}
          <View style={styles.iceBreakerHeader}>
            <View style={styles.iceBreakerHeaderLeft}>
              <View style={styles.iceBreakerSparkleWrap}>
                <Ionicons name="sparkles" size={16} color={PALETTE.rose} />
              </View>
              <Text style={styles.iceBreakerTitle}>Brise-glace</Text>
            </View>
            <View style={styles.iceBreakerActions}>
              {iceBreakerLoading ? (
                <ActivityIndicator size="small" color={PALETTE.rose} style={styles.iceBreakerRefresh} />
              ) : (
                <TouchableOpacity
                  onPress={handleRefreshIceBreaker}
                  style={styles.iceBreakerRefresh}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="refresh" size={18} color={PALETTE.rose} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={dismissIceBreaker}
                style={styles.iceBreakerClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.6}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Message content */}
          <View style={styles.iceBreakerContent}>
            <Text style={[styles.iceBreakerQuote, { color: isDark ? '#F5F0EB' : PALETTE.textDark }]}>
              "{message}"
            </Text>
          </View>

          {/* Use button */}
          <TouchableOpacity
            style={styles.iceBreakerUseBtn}
            onPress={handleUseIceBreaker}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
            <Text style={styles.iceBreakerUseBtnText}>Utiliser ce message</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const otherUserImage = (() => {
    if (!conversation?.other_user_image) return null;
    const parsed = parseDbJson(conversation.other_user_image);
    const img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
    return img ? getStorageUrl(img) : null;
  })();
  const otherUserName = typeof conversation?.other_user_name === 'string' ? conversation.other_user_name : 'Chat';

  const renderMessage = ({ item, index }) => {
    const isMine = item.sender_id === currentUser?.id;
    const prevItem = index > 0 ? messages[index - 1] : null;
    const nextItem = index < messages.length - 1 ? messages[index + 1] : null;
    const showDateSep = !prevItem || !isSameDay(prevItem.created_at, item.created_at);
    const isFirst = !prevItem || prevItem.sender_id !== item.sender_id;
    const isLast = !nextItem || nextItem.sender_id !== item.sender_id;
    const isImage = item.message_type === 'image' && item.media_url;
    const isVoice = item.message_type === 'voice' && item.media_url;

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

          {isVoice ? (
            <VoiceMessageBubble
              uri={getStorageUrl(item.media_url)}
              isMine={isMine}
              colors={colors}
              isDark={isDark}
              time={formatTime(item.created_at)}
              isSeen={item.is_seen}
            />
          ) : isImage ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setViewerUri(getStorageUrl(item.media_url))}
              style={[styles.imgBubble, bubbleRadius]}
            >
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
            </TouchableOpacity>
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
                {typeof item.content === 'string' ? item.content : ''}
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
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── WhatsApp-style banner ── */}
      <View style={[styles.banner, { backgroundColor: colors.background, borderBottomColor: isDark ? '#3D332E' : PALETTE.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.bannerBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bannerCenter}
          onPress={() => conversation?.other_user_id && router.push(`/(tabs)/user/${conversation.other_user_id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.bannerAvatarWrap}>
            {otherUserImage ? (
              <Image source={{ uri: otherUserImage }} style={styles.bannerAvatarImg} />
            ) : (
              <View style={[styles.bannerAvatarFallback, { backgroundColor: PALETTE.rosePale }]}>
                <Ionicons name="person" size={18} color={PALETTE.rose} />
              </View>
            )}
          </View>
          <View style={styles.bannerInfo}>
            <View style={styles.bannerNameRow}>
              <Text style={[styles.bannerName, { color: colors.text }]} numberOfLines={1}>
                {otherUserName}
              </Text>
              {(conversation?.streak ?? 0) >= 1 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakBadgeText}>🔥 {conversation.streak}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={reportUser} activeOpacity={0.7} style={styles.bannerReport}>
          <Ionicons name="flag-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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

        {/* Ice Breaker card */}
        {messages.length === 0 && renderIceBreakerCard()}

        {/* Input bar */}
        <View style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: isDark ? '#3D332E' : PALETTE.border,
          },
        ]}>
          {isRecording ? (
            <>
              <TouchableOpacity
                style={[styles.mediaBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale }]}
                onPress={cancelRecording}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.textInput, { backgroundColor: isDark ? '#3D332E' : '#F5EDEA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
                <View style={styles.recDot} />
                <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 15 }}>
                  {`${Math.floor(Math.floor((recorderState.durationMillis ?? 0) / 1000) / 60)}:${String(Math.floor((recorderState.durationMillis ?? 0) / 1000) % 60).padStart(2, '0')}`}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>En cours...</Text>
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: '#FF3B30' }]}
                onPress={stopAndSendRecording}
                disabled={uploadingMedia}
                activeOpacity={0.7}
              >
                {uploadingMedia
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="stop" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
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

              {inputText.trim().length > 0 ? (
                <TouchableOpacity
                  style={[styles.sendBtn, { opacity: !sending ? 1 : 0.4 }]}
                  onPress={handleSend}
                  disabled={sending}
                  activeOpacity={0.7}
                >
                  <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale, shadowOpacity: 0, elevation: 0 }]}
                  onPress={startRecording}
                  disabled={sending || uploadingMedia}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mic-outline" size={20} color={PALETTE.rose} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // WhatsApp-style banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 14,
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bannerBack: { padding: 6 },
  bannerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  bannerAvatarWrap: { width: 40, height: 40, position: 'relative' },
  bannerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  bannerAvatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bannerInfo: { flex: 1 },
  bannerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  bannerReport: { padding: 8 },
  streakBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  streakBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

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

  recDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
  },

  // ── Ice Breaker ──
  iceBreakerWrap: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  iceBreakerCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  iceBreakerShimmer: {
    position: 'absolute',
    top: -40,
    right: -20,
  },
  iceBreakerShimmerDot: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  iceBreakerShimmerDot2: {
    width: 60,
    height: 60,
    borderRadius: 30,
    position: 'absolute',
    top: 30,
    right: 60,
  },
  iceBreakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iceBreakerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iceBreakerSparkleWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iceBreakerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.rose,
  },
  iceBreakerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iceBreakerRefresh: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iceBreakerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iceBreakerContent: {
    marginBottom: 14,
  },
  iceBreakerQuote: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  iceBreakerUseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PALETTE.rose,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iceBreakerUseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
