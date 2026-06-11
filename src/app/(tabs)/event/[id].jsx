import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { eventsApi, uploadApi, getStorageUrl } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson, safeStr } from '@/utils/parsers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const EV_WAVEFORM = [4, 7, 12, 8, 16, 10, 6, 14, 9, 13, 7, 11, 16, 5, 10, 13, 8, 15, 11, 6];

function VoiceMessageBubble({ uri, isMe, colors, isDark }) {
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

  const toggle = () => { if (isPlaying) player.pause(); else player.play(); };
  const activeColor = isMe ? '#fff' : PALETTE.rose;
  const inactiveColor = isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';

  return (
    <View style={[
      vStyles.wrap,
      isMe ? { backgroundColor: PALETTE.rose } : { backgroundColor: isDark ? '#3D332E' : '#F5EDEA' },
    ]}>
      <TouchableOpacity
        onPress={toggle}
        style={[vStyles.playBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.22)' : PALETTE.rosePale }]}
        activeOpacity={0.7}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={isMe ? '#fff' : PALETTE.rose} />
      </TouchableOpacity>

      <View style={vStyles.mid}>
        <View style={vStyles.waveform}>
          {EV_WAVEFORM.map((h, i) => (
            <View
              key={i}
              style={[
                vStyles.bar,
                {
                  height: h,
                  backgroundColor: i / EV_WAVEFORM.length <= progress ? activeColor : inactiveColor,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[vStyles.dur, { color: isMe ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>
          {fmtDur(position > 0 ? position : duration)}
        </Text>
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
});

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const isDark = colorScheme === 'dark';

  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [myRsvp, setMyRsvp] = useState('coming');
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const flatListRef = useRef(null);
  const recordTimerRef = useRef(null);
  const pollRef = useRef(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // Tick every 30s to refresh countdown display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const loadEvent = useCallback(async () => {
    try {
      const res = await eventsApi.getEvent(id);
      setEvent(res.data.event);
      setMembers(res.data.members ?? []);
      if (res.data.event?.my_rsvp) setMyRsvp(res.data.event.my_rsvp);
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

  // Poll chat every 8s while joined and event not expired
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!event?.is_joined) return;
    const startsAt = event.starts_at ? new Date(event.starts_at).getTime() : null;
    const expired = startsAt ? startsAt + 24 * 3600 * 1000 < Date.now() : false;
    if (expired) return;
    pollRef.current = setInterval(loadMessages, 8000);
    return () => clearInterval(pollRef.current);
  }, [event?.is_joined, event?.starts_at, loadMessages]);

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

  const handleRsvp = async (status) => {
    if (rsvpLoading || myRsvp === status) return;
    setRsvpLoading(true);
    const prev = myRsvp;
    setMyRsvp(status);
    try {
      await eventsApi.rsvpEvent(id, status);
    } catch {
      setMyRsvp(prev);
      Alert.alert('Erreur', 'Impossible de mettre à jour ta disponibilité.');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || sending) return;
    setInputText('');
    setSending(true);
    try {
      const res = await eventsApi.sendMessage(id, { content, message_type: 'text' });
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

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission requise', "Autorise l'accès au micro pour enregistrer des messages vocaux.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
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
      await setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
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
      await setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    } catch (_) {}
  };

  const sendVoiceMessage = async (uri) => {
    if (uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const { url } = await uploadApi.uploadAudio({
        uri,
        fileName: `voice_${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
      });
      const res = await eventsApi.sendMessage(id, {
        content: '',
        message_type: 'voice',
        media_url: url,
      });
      const msg = {
        ...res.data.message,
        sender_name: user?.full_name || user?.user_name || 'Moi',
        sender_image: user?.profile_image,
        sender_id: user?.id,
      };
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error('Voice send error:', err);
      Alert.alert('Oups', "Le message vocal n'a pas pu être envoyé.");
    } finally {
      setUploadingMedia(false);
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
    const isVoice = item.message_type === 'voice' && item.media_url;

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
              {safeStr(item.sender_name)}
            </Text>
          )}
          {isVoice ? (
            <VoiceMessageBubble
              uri={getStorageUrl(item.media_url)}
              isMe={isMe}
              colors={colors}
              isDark={isDark}
            />
          ) : (
            <View
              style={[
                styles.msgBubble,
                isMe
                  ? { backgroundColor: PALETTE.rose }
                  : { backgroundColor: colors.backgroundSelected },
              ]}
            >
              <Text style={[styles.msgText, { color: isMe ? '#fff' : colors.text }]}>
                {safeStr(item.content)}
              </Text>
            </View>
          )}
          <Text style={[styles.msgTime, { color: colors.textSecondary, textAlign: isMe ? 'right' : 'left' }]}>
            {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const startsAtMs = event ? new Date(event.starts_at).getTime() : null;
  // Chat is active until J+1 (starts_at + 24h)
  const isExpired = startsAtMs ? startsAtMs + 24 * 60 * 60 * 1000 < now : false;
  // Event has already started
  const hasStarted = startsAtMs ? startsAtMs < now : false;
  // Show post-event memory prompt: event started, chat still active (within 24h after)
  const showMemoryPrompt = hasStarted && !isExpired && event?.is_joined;
  // Event is still joinable (starts_at in the future, within the 72h window)
  const isJoinable = startsAtMs ? startsAtMs > now : false;
  const isFull = event ? event.member_count >= event.max_members : false;
  const isCreator = event?.creator_id === user?.id;

  const countdownLabel = useMemo(() => {
    if (!startsAtMs) return '';
    const diff = startsAtMs - now;
    if (diff <= 0) return "C'est parti ! 🎉";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `Dans ${days}j ${hours % 24}h`;
    }
    if (hours > 0) return `Dans ${hours}h ${mins}min`;
    return `Dans ${mins} min`;
  }, [startsAtMs, now]);

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
              <Text style={[styles.heroCategoryLabel, { color: meta.color }]}>{typeof meta.label === 'string' ? meta.label : ''}</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{typeof event.title === 'string' ? event.title : ''}</Text>
            <Text style={[styles.heroCreator, { color: colors.textSecondary }]}>
              par {typeof event.creator_name === 'string' ? event.creator_name : 'Anonyme'}
            </Text>
          </View>
        </View>

        {/* Countdown banner */}
        <View style={[styles.countdownBanner, { backgroundColor: hasStarted ? '#10B981' + '18' : meta.color + '12' }]}>
          <Ionicons name={hasStarted ? 'checkmark-circle-outline' : 'timer-outline'} size={18} color={hasStarted ? '#10B981' : meta.color} />
          <Text style={[styles.countdownText, { color: hasStarted ? '#10B981' : meta.color }]}>
            {countdownLabel}
          </Text>
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
              {safeStr(event.location_name)}
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

        {/* Post-event memory prompt */}
        {showMemoryPrompt && (
          <TouchableOpacity
            style={styles.memoryPrompt}
            onPress={() => router.push('/(tabs)/wall')}
            activeOpacity={0.8}
          >
            <Text style={styles.memoryPromptEmoji}>📸</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.memoryPromptTitle}>C'était comment ?</Text>
              <Text style={styles.memoryPromptSub}>Poste un souvenir sur le Mur</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Description */}
        {typeof event.description === 'string' && event.description ? (
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {event.description}
          </Text>
        ) : null}

        {/* Members */}
        <View style={styles.membersTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Participantes</Text>
          {members.length > 0 && (
            <View style={styles.rsvpSummary}>
              {[
                { key: 'coming',      icon: 'checkmark-circle', color: '#10B981' },
                { key: 'maybe',       icon: 'help-circle',      color: '#F59E0B' },
                { key: 'unavailable', icon: 'close-circle',     color: '#EF4444' },
              ].map((opt) => {
                const count = members.filter((m) => (m.rsvp_status || 'coming') === opt.key).length;
                if (count === 0) return null;
                return (
                  <View key={opt.key} style={styles.rsvpSummaryItem}>
                    <Ionicons name={opt.icon} size={13} color={opt.color} />
                    <Text style={[styles.rsvpSummaryCount, { color: opt.color }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <View style={styles.membersRow}>
          {members.map((m) => {
            const rsvp = m.rsvp_status || 'coming';
            const rsvpMeta = {
              coming:      { icon: 'checkmark-circle', color: '#10B981' },
              maybe:       { icon: 'help-circle',      color: '#F59E0B' },
              unavailable: { icon: 'close-circle',     color: '#EF4444' },
            }[rsvp] || { icon: 'checkmark-circle', color: '#10B981' };
            return (
              <TouchableOpacity key={m.id} style={styles.memberItem}
                onPress={() => router.push(`/(tabs)/user/${m.id}`)}
              >
                <View style={styles.memberAvatarWrap}>
                  <MemberAvatar member={m} />
                  <View style={[styles.rsvpDot, { backgroundColor: rsvpMeta.color }]}>
                    <Ionicons name={rsvpMeta.icon} size={10} color="#fff" />
                  </View>
                </View>
                <Text style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {safeStr(m.full_name, '?').split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Join / Leave button */}
        {isJoinable && (
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

        {/* RSVP row — shown to members */}
        {event.is_joined && (
          <View style={styles.rsvpRow}>
            {[
              { key: 'coming',      label: 'Je viens',   icon: 'checkmark-circle', color: '#10B981' },
              { key: 'maybe',       label: 'Peut-être',  icon: 'help-circle',      color: '#F59E0B' },
              { key: 'unavailable', label: 'Pas dispo',  icon: 'close-circle',     color: '#EF4444' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.rsvpBtn,
                  myRsvp === opt.key && { backgroundColor: opt.color + '20', borderColor: opt.color },
                  myRsvp !== opt.key && { borderColor: colors.backgroundSelected },
                ]}
                onPress={() => handleRsvp(opt.key)}
                disabled={rsvpLoading}
                activeOpacity={0.75}
              >
                <Ionicons name={opt.icon} size={16} color={myRsvp === opt.key ? opt.color : colors.textSecondary} />
                <Text style={[styles.rsvpBtnText, { color: myRsvp === opt.key ? opt.color : colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
            {safeStr(event?.title)}
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
          {isRecording ? (
            <>
              <TouchableOpacity
                style={[styles.mediaBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale }]}
                onPress={cancelRecording}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.chatInput, { backgroundColor: isDark ? '#3D332E' : '#F5EDEA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
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
              {inputText.trim().length > 0 ? (
                <TouchableOpacity
                  style={[styles.sendBtn, { opacity: sending ? 0.4 : 1 }]}
                  onPress={handleSend}
                  disabled={sending}
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale, shadowOpacity: 0, elevation: 0 }]}
                  onPress={startRecording}
                  disabled={uploadingMedia}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mic-outline" size={20} color={PALETTE.rose} />
                </TouchableOpacity>
              )}
            </>
          )}
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

  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.four,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  countdownText: { fontSize: 14, fontWeight: '700' },

  memoryPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.four,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#10B981',
  },
  memoryPromptEmoji: { fontSize: 22 },
  memoryPromptTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  memoryPromptSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Spacing.four,
    marginBottom: 16,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  rsvpBtnText: { fontSize: 12, fontWeight: '700' },

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
  membersTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rsvpSummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rsvpSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rsvpSummaryCount: { fontSize: 12, fontWeight: '700' },
  memberItem: { alignItems: 'center', gap: 4, width: 56 },
  memberAvatarWrap: { position: 'relative' },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberAvatarFallback: { backgroundColor: PALETTE.rosePale, alignItems: 'center', justifyContent: 'center' },
  memberAvatarInitials: { fontSize: 16, fontWeight: '700', color: PALETTE.rose },
  memberName: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  rsvpDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },

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
  mediaBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
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
  recDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
  },
});
