import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Linking
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { groupsApi, messagesApi, uploadApi, getStorageUrl } from '@/services/api';
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson, safeStr } from '@/utils/parsers';
import { useSnackbar } from '@/contexts/snackbar';
import * as Location from 'expo-location';
import { GroupsSkeleton } from '@/components/Skeleton';

const OUTDOOR_KEYWORDS = ['sport', 'plage', 'parc', 'balade', 'randon', 'extérieur', 'jardin', 'nature', 'piscine', 'forêt', 'vélo'];

// New circles are formed automatically at the start of each week (Monday, 08:00 local).
function getNextGroupCountdown() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun … 1 = Mon … 6 = Sat
  const daysUntil = (1 - day + 7) % 7; // days until next Monday (0 if today is Monday)
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntil);
  target.setHours(8, 0, 0, 0);
  // If Monday 08:00 already passed (e.g. Monday afternoon), jump to next week.
  if (target <= now) target.setDate(target.getDate() + 7);
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function isOutdoorActivity(activity) {
  const text = ((activity?.title ?? '') + ' ' + (activity?.description ?? '') + ' ' + (activity?.tag ?? '')).toLowerCase();
  return OUTDOOR_KEYWORDS.some((k) => text.includes(k));
}

function parseWeatherCode(code, precipProb) {
  if (code === 0 || code === 1) return { emoji: '☀️', label: 'Beau temps', ok: true };
  if (code === 2 || code === 3) return { emoji: '⛅', label: 'Nuageux', ok: true };
  if (code >= 45 && code <= 48) return { emoji: '🌫️', label: 'Brouillard', ok: false };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: '🌧️', label: 'Pluie prévue', ok: false };
  if (code >= 71 && code <= 77) return { emoji: '❄️', label: 'Neige', ok: false };
  if (code >= 95) return { emoji: '⛈️', label: 'Orage', ok: false };
  if (precipProb > 60) return { emoji: '🌦️', label: 'Risque pluie', ok: false };
  return { emoji: '🌤️', label: 'Variable', ok: true };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const GV_WAVEFORM = [4, 7, 12, 8, 16, 10, 6, 14, 9, 13, 7, 11, 16, 5, 10, 13, 8, 15, 11, 6];

// Resolve a member's first profile photo to a full URL, or null so the default placeholder shows.
function firstAvatarUrl(imageField) {
  const arr = parseDbJson(imageField);
  const pic = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
  return pic ? getStorageUrl(pic) : null;
}


const openMapWithSearch = (searchQuery) => {
  const encodedQuery = encodeURIComponent(searchQuery);

  const url = Platform.select({
    ios: `maps://?q=${encodedQuery}`,
    android: `geo:0,0?q=${encodedQuery}`,
  });

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        return Linking.openURL(url);
      }
    })
    .catch((err) => console.error('An error occurred while opening the map:', err));
};


function GroupVoiceBubble({ uri, isMine, colors, isDark, time }) {
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
      gvStyles.wrap,
      isMine ? { backgroundColor: PALETTE.rose } : { backgroundColor: isDark ? '#3D332E' : '#F5EDEA' },
    ]}>
      <TouchableOpacity
        onPress={toggle}
        style={[gvStyles.playBtn, { backgroundColor: isMine ? 'rgba(255,255,255,0.22)' : PALETTE.rosePale }]}
        activeOpacity={0.7}
      >
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={isMine ? '#fff' : PALETTE.rose} />
      </TouchableOpacity>

      <View style={gvStyles.mid}>
        <View style={gvStyles.waveform}>
          {GV_WAVEFORM.map((h, i) => (
            <View
              key={i}
              style={[
                gvStyles.bar,
                {
                  height: h,
                  backgroundColor: i / GV_WAVEFORM.length <= progress ? activeColor : inactiveColor,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[gvStyles.dur, { color: isMine ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>
          {fmtDur(position > 0 ? position : duration)}
        </Text>
      </View>

      <Text style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.65)' : colors.textSecondary, flexShrink: 0 }}>
        {time}
      </Text>
    </View>
  );
}

const gvStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    minWidth: 190,
    maxWidth: '80%',
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

export default function GroupsScreen() {
  const { user: currentUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const snackbar = useSnackbar();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voting, setVoting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [rendezvousModalVisible, setRendezvousModalVisible] = useState(false);
  const [rendezvousText, setRendezvousText] = useState('');
  const [rendezvousDateObj, setRendezvousDateObj] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [memberVotes, setMemberVotes] = useState({}); // { [memberId]: true | false }
  const [submittingMemberVotes, setSubmittingMemberVotes] = useState(false);
  const [openingDm, setOpeningDm] = useState(null); // memberId being loaded
  const [votingActivity, setVotingActivity] = useState(null); // index being voted
  const isDark = colorScheme === 'dark';
  const [nextGroupIn, setNextGroupIn] = useState(getNextGroupCountdown);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const recordTimerRef = useRef(null);

  // Dissolution / weekly-rating form
  const [dissolutionModal, setDissolutionModal] = useState(false);
  const [dissStep, setDissStep] = useState(0); // 0=group rating, 1=member ratings
  const [groupRating, setGroupRating] = useState(0);
  const [memberRatings, setMemberRatings] = useState({}); // { [memberId]: { want_again, comfort, in_common } }
  const [pendingDissGroupId, setPendingDissGroupId] = useState(null);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [ratingOnlyMode, setRatingOnlyMode] = useState(false); // true = rating without dissolving
  const flatListRef = useRef(null);
  const pollInterval = useRef(null);
  const [weather, setWeather] = useState(null);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await groupsApi.getCurrent();
      setGroup(res.data?.group ?? null);
    } catch (err) {
      console.error('Fetch group error:', err);
      Alert.alert('Erreur', 'Impossible de charger le groupe.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeather = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const { latitude, longitude } = loc.coords;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&daily=weathercode,precipitation_probability_max&timezone=auto&forecast_days=2`;
      const res = await fetch(url);
      const data = await res.json();
      const code = data.daily?.weathercode?.[0] ?? 0;
      const precip = data.daily?.precipitation_probability_max?.[0] ?? 0;
      setWeather(parseWeatherCode(code, precip));
    } catch {
      // Non-critical
    }
  }, []);

  // Live countdown to the next weekly circle — only ticks while the user has no group
  useEffect(() => {
    if (group) return;
    setNextGroupIn(getNextGroupCountdown());
    const timer = setInterval(() => setNextGroupIn(getNextGroupCountdown()), 1000);
    return () => clearInterval(timer);
  }, [group]);

  const fetchMessages = useCallback(async () => {
    if (!group?.id) return;
    try {
      const res = await groupsApi.getMessages(group.id);
      setMessages(res.data?.messages ?? []);
    } catch (err) {
      console.error('Fetch group messages error:', err);
      // No Alert — this is polled every 10s, don't spam the user
    }
  }, [group?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchGroup();
      fetchWeather();
      // Reset to skeleton when leaving so the page never shows stale content while swiping back.
      return () => setLoading(true);
    }, [fetchGroup, fetchWeather])
  );

  useEffect(() => {
    if (showChat && group?.id) {
      fetchMessages();
      pollInterval.current = setInterval(fetchMessages, 10000);
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [showChat, group?.id, fetchMessages]);

  const handleReportGroup = () => {
    if (!group?.id) return;
    const reasons = [
      'Comportement inapproprié',
      'Harcèlement ou intimidation',
      'Contenu offensant',
      'Spam ou arnaque',
      'Autre',
    ];
    Alert.alert(
      'Signaler le groupe',
      'Pourquoi veux-tu signaler ce groupe ?',
      [

        ...reasons.map((reason) => ({
          text: reason,
          onPress: async () => {
            try {
              await groupsApi.reportGroup(group.id, reason);
              snackbar.success('Signalement envoyé. Merci ! ✨', 2500);
            } catch {
              Alert.alert('Erreur', 'Impossible d\'envoyer le signalement.');
            }
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert('Quitter le groupe', 'Veux-tu vraiment quitter ce groupe ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupsApi.leave();
            setGroup(null);
            setShowChat(false);
            setMessages([]);
            snackbar.info('Tu as quitté le cercle. À la semaine prochaine 🍒', 2500);
          } catch (err) {
            console.error('Leave group error:', err);
            Alert.alert('Erreur', 'Impossible de quitter le groupe.');
          }
        },
      },
    ]);
  };

  const handleVote = async (vote) => {
    if (!group?.id || voting) return;
    setVoting(true);
    try {
      const res = await groupsApi.vote(group.id, vote);
      await fetchGroup();

      if (res.data?.resolved) {
        if (res.data.group_continues) {
          snackbar.success('✅ Le groupe continue pour une nouvelle semaine !', 2500);
        } else {
          // Show dissolution feedback form before clearing the group
          setPendingDissGroupId(group.id);
          setPendingMembers(group.members || []);
          setGroupRating(0);
          setMemberRatings({});
          setDissStep(0);
          setDissolutionModal(true);
        }
      }
    } catch (err) {
      console.error('Vote error:', err);
      Alert.alert('Erreur', 'Le vote n\'a pas pu être pris en compte.');
    } finally {
      setVoting(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !group?.id || sending) return;

    setSending(true);
    setInputText('');
    try {
      await groupsApi.sendMessage({
        weekly_group_id: group.id,
        content: text,
      });
      await fetchMessages();
    } catch (err) {
      console.error('Send message error:', err);
      snackbar.error('Message non envoyé', 2000);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const startGroupRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission requise', "Autorise l'accès au micro pour enregistrer des messages vocaux.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecordingVoice(true);
      recordTimerRef.current = setTimeout(() => stopGroupRecording(), 60000);
    } catch (err) {
      console.error('Start recording error:', err);
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  };

  const stopGroupRecording = async () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    setIsRecordingVoice(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (uri) await sendGroupVoiceMessage(uri);
    } catch (err) {
      console.error('Stop group recording error:', err);
    }
  };

  const cancelGroupRecording = async () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    setIsRecordingVoice(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (_) {}
  };

  const sendGroupVoiceMessage = async (uri) => {
    if (!group?.id || uploadingVoice) return;
    setUploadingVoice(true);
    try {
      const { url } = await uploadApi.uploadAudio({
        uri,
        fileName: `voice_${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
      });
      console.log("audio sent");
      console.log("data_send_group: ", {
        weekly_group_id: group.id,
        content: '',
        message_type: 'voice',
        media_url: url,
      })
      await groupsApi.sendMessage({
        weekly_group_id: group.id,
        content: '',
        message_type: 'voice',
        media_url: url,
      });
      await fetchMessages();
      snackbar.like('🎤 Message vocal envoyé !', 2000);
    } catch (err) {
      console.error('Group voice send error:', err);
      snackbar.error('Message vocal non envoyé', 2000);
    } finally {
      setUploadingVoice(false);
    }
  };

  const openRendezvousModal = () => {
    setRendezvousText('');
    setRendezvousDateObj(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setRendezvousModalVisible(true);
  };

  const handleSetRendezvous = async () => {
    const location = rendezvousText.trim();
    if (!location || !group?.id) return;
    setRendezvousModalVisible(false);
    const parsedTime = rendezvousDateObj ? rendezvousDateObj.toISOString() : null;
    try {
      await groupsApi.suggestRendezvous(group.id, location, parsedTime);
      await fetchGroup();
    } catch (err) {
      console.error('Set rendezvous error:', err);
      Alert.alert('Erreur', 'Impossible de proposer le rendez-vous.');
    }
  };

  const handleLikeRendezvous = async (suggestionId) => {
    if (!group?.id) return;
    const suggestions = group.rendezvous_suggestions || [];
    const idx = suggestions.findIndex((s) => s.id === suggestionId);
    if (idx === -1) return;
    const alreadyLiked = (suggestions[idx].likes || []).includes(currentUser?.id);
    // Optimistic update
    setGroup((prev) => {
      const updated = [...(prev.rendezvous_suggestions || [])];
      const likes = updated[idx].likes || [];
      updated[idx] = {
        ...updated[idx],
        likes: alreadyLiked ? likes.filter((id) => id !== currentUser?.id) : [...likes, currentUser?.id],
      };
      return { ...prev, rendezvous_suggestions: updated };
    });
    try {
      await groupsApi.likeRendezvous(group.id, suggestionId);
    } catch (err) {
      // Rollback
      setGroup((prev) => {
        const updated = [...(prev.rendezvous_suggestions || [])];
        const likes = updated[idx].likes || [];
        updated[idx] = {
          ...updated[idx],
          likes: alreadyLiked ? [...likes, currentUser?.id] : likes.filter((id) => id !== currentUser?.id),
        };
        return { ...prev, rendezvous_suggestions: updated };
      });
      console.error('Like rendezvous error:', err);
    }
  };

  const handleMemberVoteToggle = (memberId, keep) => {
    setMemberVotes((prev) => ({ ...prev, [memberId]: keep }));
  };

  const handleSubmitMemberVotes = async () => {
    if (!group?.id || submittingMemberVotes) return;
    const votes = Object.entries(memberVotes).map(([member_id, keep]) => ({ member_id, keep }));
    if (votes.length === 0) {
      Alert.alert('Vote', 'Tu n\'as pas encore voté pour les membres.');
      return;
    }
    setSubmittingMemberVotes(true);
    try {
      await groupsApi.submitMemberVotes(group.id, votes);
      snackbar.success('Votes enregistrés ✨', 2000);
    } catch (err) {
      console.error('Submit member votes error:', err);
      Alert.alert('Erreur', 'Impossible d\'enregistrer les votes.');
    } finally {
      setSubmittingMemberVotes(false);
    }
  };

  const handleVoteActivity = async (index) => {
    if (votingActivity !== null || !group?.id) return;
    setVotingActivity(index);

    const wasVoted = group.activity_votes?.my_votes?.includes(index);
    // Optimistic update
    setGroup((prev) => {
      const prevVotes = prev.activity_votes || { counts: {}, my_votes: [] };
      const myVotes = wasVoted
        ? prevVotes.my_votes.filter((i) => i !== index)
        : [...prevVotes.my_votes, index];
      const counts = { ...prevVotes.counts };
      counts[index] = Math.max(0, (counts[index] || 0) + (wasVoted ? -1 : 1));
      return { ...prev, activity_votes: { ...prevVotes, counts, my_votes: myVotes } };
    });

    try {
      await groupsApi.voteActivity(group.id, index);
    } catch (err) {
      // Rollback optimistic update
      setGroup((prev) => {
        const prevVotes = prev.activity_votes || { counts: {}, my_votes: [] };
        const myVotes = wasVoted
          ? [...prevVotes.my_votes, index]
          : prevVotes.my_votes.filter((i) => i !== index);
        const counts = { ...prevVotes.counts };
        counts[index] = Math.max(0, (counts[index] || 0) + (wasVoted ? 1 : -1));
        return { ...prev, activity_votes: { ...prevVotes, counts, my_votes: myVotes } };
      });
      console.error('Activity vote error:', err);
    } finally {
      setVotingActivity(null);
    }
  };

  const handleOpenDm = async (memberId) => {
    if (openingDm) return;
    setOpeningDm(memberId);
    try {
      const res = await messagesApi.startConversation(memberId);
      const { conversation_id, limit_reached, free_limit } = res.data;
      if (limit_reached) {
        Alert.alert(
          'Limite atteinte',
          `Tu as déjà envoyé ${free_limit} messages à cette personne. Passe Premium pour continuer !`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Voir quand même', onPress: () => router.push(`/(tabs)/chat/${conversation_id}`) },
          ]
        );
      } else {
        router.push(`/(tabs)/chat/${conversation_id}`);
      }
    } catch (err) {
      console.error('Open DM error:', err);
      Alert.alert('Erreur', "Impossible d'ouvrir la conversation.");
    } finally {
      setOpeningDm(null);
    }
  };

  const setMemberScore = (memberId, key, value) => {
    setMemberRatings((prev) => ({
      ...prev,
      [memberId]: {
        want_again: 0, comfort: 0, in_common: 0,
        ...(prev[memberId] || {}),
        [key]: value,
      },
    }));
  };

  const finalizeDissolution = () => {
    setDissolutionModal(false);
    setRatingOnlyMode(false);
    setGroup(null);
    setShowChat(false);
    setMessages([]);
    setPendingDissGroupId(null);
    setPendingMembers([]);
  };

  const handleOpenWeeklyRating = () => {
    if (!group) return;
    setPendingDissGroupId(group.id);
    setPendingMembers(group.members || []);
    setGroupRating(0);
    setMemberRatings({});
    setDissStep(0);
    setRatingOnlyMode(true);
    setDissolutionModal(true);
  };

  const handleSubmitDissolution = async () => {
    if (submittingFeedback) return;
    setSubmittingFeedback(true);
    try {
      if (groupRating > 0) {
        await groupsApi.submitDissolutionFeedback(pendingDissGroupId, groupRating, []);
      }
      const ratings = Object.entries(memberRatings)
        .filter(([, r]) => r.want_again > 0 && r.comfort > 0 && r.in_common > 0)
        .map(([member_id, r]) => ({ rated_user_id: member_id, ...r }));
      if (ratings.length > 0) {
        await groupsApi.submitInteractionRatings(pendingDissGroupId, ratings);
      }
      snackbar.success('Merci pour ton évaluation ! ✨', 2000);
    } catch (err) {
      console.error('Dissolution feedback error:', err);
    } finally {
      setSubmittingFeedback(false);
      if (ratingOnlyMode) {
        setDissolutionModal(false);
        setRatingOnlyMode(false);
      } else {
        finalizeDissolution();
      }
    }
  };

  const GROUP_ICE_BREAKERS = [
    'Si tu devais décrire notre groupe en 3 emojis ?',
    'Le dernier endroit qui t\'a vraiment surprise ?',
    'Ton rituel du dimanche matin ?',
    'Ce qui te fait sourire même les mauvais jours ?',
    'Si on se retrouvait cette semaine, tu proposerais quoi ?',
    'Ton film ou série du moment ?',
    'La ville de tes rêves pour une escapade ?',
    'Ce qui te rend unique dans un groupe d\'amies ?',
  ];

  const daysSinceCreated = useMemo(() => {
    if (!group?.created_at) return 99;
    return Math.floor((Date.now() - new Date(group.created_at)) / (24 * 60 * 60 * 1000));
  }, [group?.created_at]);

  const revealLevel = Math.min(daysSinceCreated, 2);

  const isEndOfWeek = useMemo(() => {
    if (!group?.week_end) return false;
    const weekEnd = new Date(group.week_end);
    const showFrom = new Date(weekEnd.getTime() - 2 * 24 * 60 * 60 * 1000);
    return Date.now() >= showFrom.getTime();
  }, [group?.week_end]);

  const daysUntilVote = useMemo(() => {
    if (!group?.week_end || isEndOfWeek) return null;
    const weekEnd = new Date(group.week_end);
    const showFrom = new Date(weekEnd.getTime() - 2 * 24 * 60 * 60 * 1000);
    return Math.ceil((showFrom.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }, [group?.week_end, isEndOfWeek]);

  const RATING_QUESTIONS = [
    { key: 'want_again', emoji: '🔄', question: 'Tu voudrais interagir à nouveau avec elle ?' },
    { key: 'comfort',    emoji: '💜', question: "Tu te sentais à l'aise en lui parlant ?" },
    { key: 'in_common',  emoji: '✨', question: 'Vous avez des choses en commun ?' },
  ];

  const renderDissolutionModal = () => {
    const otherMembers = pendingMembers.filter((m) => m.id !== currentUser?.id);

    return (
      <Modal
        visible={dissolutionModal}
        transparent
        animationType="slide"
        onRequestClose={finalizeDissolution}
      >
        <View style={dissStyles.overlay}>
          <View style={[dissStyles.sheet, { backgroundColor: colors.background }]}>

            {dissStep === 0 ? (
              /* ── Step 1: Group rating ── */
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dissStyles.stepContent}>
                <View style={dissStyles.emojiWrap}>
                  <Text style={dissStyles.emoji}>🎉</Text>
                </View>
                <Text style={[dissStyles.sheetTitle, { color: colors.text }]}>Bilan du groupe</Text>
                <Text style={[dissStyles.sheetSub, { color: colors.textSecondary }]}>
                  Comment s'est passée votre activité ensemble ?
                </Text>

                <View style={dissStyles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setGroupRating(star)} activeOpacity={0.7}>
                      <Text style={[dissStyles.star, { opacity: star <= groupRating ? 1 : 0.25 }]}>⭐</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={dissStyles.stepBtns}>
                  <TouchableOpacity style={dissStyles.skipBtn} onPress={() => ratingOnlyMode ? setDissolutionModal(false) : finalizeDissolution()} activeOpacity={0.7}>
                    <Text style={[dissStyles.skipBtnText, { color: colors.textSecondary }]}>Passer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dissStyles.nextBtn, { opacity: otherMembers.length === 0 ? 0.6 : 1 }]}
                    onPress={() => setDissStep(1)}
                    activeOpacity={0.8}
                  >
                    <Text style={dissStyles.nextBtnText}>Continuer →</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* ── Step 2: 3-question 1–5 member ratings ── */
              <>
                <View style={dissStyles.step2Header}>
                  <TouchableOpacity onPress={() => setDissStep(0)} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[dissStyles.sheetTitle, { color: colors.text, marginBottom: 0 }]}>Évalue tes Copines</Text>
                  <View style={{ width: 22 }} />
                </View>
                <Text style={[dissStyles.sheetSub, { color: colors.textSecondary, paddingHorizontal: Spacing.four, marginBottom: 8 }]}>
                  Tes réponses améliorent tes prochains groupes
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dissStyles.membersList}>
                  {otherMembers.map((member) => {
                    const pic = firstAvatarUrl(member.profile_image);
                    const ratings = memberRatings[member.id] || { want_again: 0, comfort: 0, in_common: 0 };

                    return (
                      <View key={member.id} style={[dissStyles.memberBlock, { backgroundColor: colors.backgroundElement }]}>
                        <View style={dissStyles.memberBlockHeader}>
                          {pic ? (
                            <Image source={{ uri: pic }} style={dissStyles.memberAvatar} />
                          ) : (
                            <View style={[dissStyles.memberAvatar, dissStyles.memberAvatarFallback]}>
                              <Ionicons name="person" size={16} color={PALETTE.rose} />
                            </View>
                          )}
                          <Text style={[dissStyles.memberBlockName, { color: colors.text }]}>
                            {safeStr(member.full_name) || safeStr(member.user_name, '?')}
                          </Text>
                        </View>

                        {RATING_QUESTIONS.map(({ key, emoji, question }) => (
                          <View key={key} style={dissStyles.dimBlock}>
                            <Text style={[dissStyles.dimQuestion, { color: colors.textSecondary }]}>
                              {emoji}  {question}
                            </Text>
                            <View style={dissStyles.ratingRow}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                  key={star}
                                  onPress={() => setMemberScore(member.id, key, star === ratings[key] ? 0 : star)}
                                  activeOpacity={0.7}
                                  style={dissStyles.ratingBtn}
                                >
                                  <Text style={[dissStyles.ratingStar, { opacity: star <= (ratings[key] || 0) ? 1 : 0.2 }]}>
                                    ⭐
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={dissStyles.submitBtn}
                    onPress={handleSubmitDissolution}
                    disabled={submittingFeedback}
                    activeOpacity={0.85}
                  >
                    {submittingFeedback
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={dissStyles.submitBtnText}>Soumettre ✨</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={dissStyles.skipBtnBottom}
                    onPress={() => ratingOnlyMode ? setDissolutionModal(false) : finalizeDissolution()}
                    activeOpacity={0.7}
                  >
                    <Text style={[dissStyles.skipBtnText, { color: colors.textSecondary }]}>Passer cette étape</Text>
                  </TouchableOpacity>

                  <View style={{ height: 40 }} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // ── Render Group View ──
  const renderGroupView = () => {
    if (!group) return null;

    // ── DEBUG: log any field that might be an object before rendering ──
    const __dbgFields = {
      'group.common_interest': group.common_interest,
      'group.rendezvous_location': group.rendezvous_location,
      'group.vote_summary': group.vote_summary,
    };
    Object.entries(__dbgFields).forEach(([k, v]) => {
      if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        console.warn('[OBJECT RENDER BUG]', k, JSON.stringify(v));
      }
    });
    (group.members || []).forEach((m, i) => {
      ['full_name', 'user_name', 'location', 'bio', 'labels', 'interests'].forEach((f) => {
        const v = m[f];
        if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
          console.warn(`[OBJECT RENDER BUG] member[${i}].${f}`, JSON.stringify(v));
        }
      });
    });
    // ── END DEBUG ──

    const members = group.members || [];
    const voteSummary = group.vote_summary || { continue: 0, disband: 0, total: 0 };

    // Interest chips derived from members' vibe labels
    const interestChips = [];
    members.forEach((m) => {
      const lbl = m.labels && typeof m.labels === 'object' ? m.labels : {};
      (Array.isArray(lbl.vibe) ? lbl.vibe : []).forEach((v) => {
        if (typeof v === 'string' && !interestChips.includes(v)) interestChips.push(v);
      });
    });
    let compatPct = null;
    if (group.compatibility_score != null) {
      compatPct = Math.round(group.compatibility_score * 100);
    } else {
      const parts = [group.psych_score, group.pref_score, group.behav_score].filter((v) => v != null);
      if (parts.length) compatPct = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
    }

    return (
      <ScrollView style={styles.groupContent} showsVerticalScrollIndicator={false}>
        {/* ── Hero group card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroBlobA} />
          <View style={styles.heroBlobB} />

          <View style={styles.heroHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroWeekLabel}>
                Semaine du {formatDate(group.week_start)}
              </Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {safeStr(group.common_interest, 'Ton cercle')}
              </Text>
            </View>
            {compatPct != null && (
              <View style={styles.heroCompatBadge}>
                <Ionicons name="heart" size={12} color="#fff" />
                <Text style={styles.heroCompatText}>{compatPct}% compatibles</Text>
              </View>
            )}
          </View>

          {/* Avatars with names */}
          <View style={styles.heroAvatarsRow}>
            {members.slice(0, 5).map((member) => {
              const isSelf = member.id === currentUser?.id;
              const pic = firstAvatarUrl(member.profile_image);
              const revealed = isSelf || revealLevel >= 1;
              const firstName = String(member.full_name || member.user_name || '?').split(' ')[0];
              return (
                <View key={member.id} style={styles.heroAvatarCol}>
                  <View style={styles.heroAvatarWrap}>
                    {revealed && pic ? (
                      <Image source={{ uri: pic }} style={styles.heroAvatar} />
                    ) : (
                      <View style={[styles.heroAvatar, styles.heroAvatarLocked]}>
                        <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.85)" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.heroAvatarName} numberOfLines={1}>
                    {revealed ? firstName : '???'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Interest chips */}
          {interestChips.length > 0 && (
            <View style={styles.heroChipsRow}>
              {interestChips.slice(0, 4).map((chip) => (
                <View key={chip} style={styles.heroChip}>
                  <Text style={styles.heroChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Compatibility breakdown */}
        {group.compatibility_score != null && (
          <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.compatHeader}>
              <Ionicons name="heart-circle-outline" size={18} color={PALETTE.rose} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                Compatibilité du groupe
              </Text>
              <Text style={styles.compatTotal}>{Math.round(group.compatibility_score * 100)}%</Text>
            </View>
            {[
              { label: 'Psychologique', pct: group.psych_score, weight: '40%', color: '#C4325E' },
              { label: 'Préférences', pct: group.pref_score, weight: '35%', color: '#C4325E' },
              { label: 'Comportemental', pct: group.behav_score, weight: '25%', color: '#C4325E' },
            ].map(({ label, pct, weight, color }) => (
              pct != null ? (
                <View key={label} style={styles.compatRow}>
                  <Text style={[styles.compatLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <View style={[styles.compatBar, { backgroundColor: colors.backgroundSelected }]}>
                    <View style={[styles.compatFill, { width: `${Math.round((pct || 0) * 100)}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.compatPct, { color }]}>{Math.round((pct || 0) * 100)}%</Text>
                  <Text style={[styles.compatWeight, { color: colors.textSecondary }]}>{weight}</Text>
                </View>
              ) : null
            ))}
          </View>
        )}

        {/* Rendezvous */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            <Ionicons name="location-outline" size={18} color={PALETTE.rose} />  Rendez-vous
          </Text>
          {(group.rendezvous_suggestions || []).length === 0 ? (
            <Text style={[styles.emptyRendezvous, { color: colors.textSecondary }]}>
              Pas encore de suggestions sois la première !
            </Text>
          ) : (
            (group.rendezvous_suggestions || []).map((sug) => {
              const likeCount = (sug.likes || []).length;
              const liked = (sug.likes || []).includes(currentUser?.id);
              return (
                <View key={sug.id} style={[styles.rendezvousSuggestion, { borderColor: isDark ? '#3D332E' : '#EBEBEB' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rendezvousLocation, { color: colors.text }]}>
                      {typeof sug.location === 'string' ? sug.location : ''}
                    </Text>
                    {sug.time && (
                      <Text style={[styles.rendezvousTime, { color: colors.textSecondary }]}>
                        {formatDate(sug.time)} à {formatTime(sug.time)}
                      </Text>
                    )}
                    <Text style={[styles.rendezvousSuggestor, { color: colors.textSecondary }]}>
                      Proposé par {typeof sug.user_name === 'string' ? sug.user_name : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.rendezvousLikeBtn, { backgroundColor: liked ? PALETTE.rose : colors.backgroundSelected }]}
                    onPress={() => handleLikeRendezvous(sug.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#fff' : PALETTE.rose} />
                    {likeCount > 0 && (
                      <Text style={[styles.rendezvousLikeCount, { color: liked ? '#fff' : PALETTE.rose }]}>{likeCount}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={openRendezvousModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={PALETTE.rose} />
            <Text style={styles.actionButtonText}>Proposer un lieu</Text>
          </TouchableOpacity>
        </View>

        {/* Activity suggestions */}
        {group.activity_suggestions?.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.activityHeaderRow}>
              <View style={styles.activityHeaderLeft}>
                <Ionicons name="bulb-outline" size={18} color='#F59E0B' />
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Idées pour vous</Text>
              </View>
              {group.activity_suggestions.some(a => a.tag === 'sport' || a.tag === 'hobby') && (
                <View style={styles.activityBadge}>
                  <Text style={styles.activityBadgeText}>Vos intérêts ✨</Text>
                </View>
              )}
            </View>
            <Text style={[styles.voteQuestion, { color: colors.textSecondary, marginBottom: 12 }]}>
              Sélectionnées pour vous et votre cercle
            </Text>
            {group.activity_suggestions.map((activity, index) => {
              const voteCount = group.activity_votes?.counts?.[index] || 0;
              const hasVoted = group.activity_votes?.my_votes?.includes(index);
              const isVoting = votingActivity === index;
              return (
                <TouchableOpacity key={index} style={[styles.activityRow, index > 0 && styles.activityRowBorder]}
                onPress={() => openMapWithSearch(activity.title)}>

                  <View style={[styles.activityIcon, { backgroundColor: activity.color + '22' }]}>
                    <Ionicons name={activity.icon || 'star-outline'} size={22} color={activity.color} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityTitle, { color: colors.text }]}>{typeof activity.title === 'string' ? activity.title : ''}</Text>
                    <Text style={[styles.activityDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                      {typeof activity.description === 'string' ? activity.description : ''}
                    </Text>
                    {isOutdoorActivity(activity) && weather && (
                      <View style={[styles.activityWeatherBadge, { backgroundColor: weather.ok ? '#E8F5E9' : '#FEF3C7' }]}>
                        <Text style={styles.activityWeatherEmoji}>{weather.emoji}</Text>
                        <Text style={[styles.activityWeatherText, { color: weather.ok ? '#166534' : '#92400E' }]}>
                          {weather.label}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.activityVoteBtn,
                      { backgroundColor: hasVoted ? PALETTE.rose : colors.backgroundSelected },
                    ]}
                    onPress={() => handleVoteActivity(index)}
                    disabled={isVoting}
                    activeOpacity={0.75}
                  >
                    {isVoting
                      ? <ActivityIndicator size="small" color={hasVoted ? '#fff' : PALETTE.rose} />
                      : <>
                          <Ionicons
                            name={hasVoted ? 'heart' : 'heart-outline'}
                            size={18}
                            color={hasVoted ? '#fff' : PALETTE.rose}
                          />
                          {voteCount > 0 && (
                            <Text style={[styles.activityVoteCount, { color: hasVoted ? '#fff' : PALETTE.rose }]}>
                              {voteCount}
                            </Text>
                          )}
                        </>
                    }
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            <Text style={{fontStyle: "italic", color: colors.textSecondary}}>Pour plus d'info cliquez sur une des idée</Text>
          </View>
        )}

        {/* Members — progressive reveal */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
              <Ionicons name="people-outline" size={18} color={PALETTE.rose} />  Membres ({members.length})
            </Text>
            {revealLevel < 2 && (
              <View style={styles.revealBadge}>
                <Ionicons name="eye-off-outline" size={12} color={PALETTE.rose} />
                <Text style={styles.revealBadgeText}>
                  {revealLevel === 0 ? 'Révèle J+1' : 'Bio J+2'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.membersList}>
            {members.map((member) => {
              const isSelf = member.id === currentUser?.id;
              const memberPic = firstAvatarUrl(member.profile_image);
              const showPhoto = isSelf || revealLevel >= 1;
              const showFullName = isSelf || revealLevel >= 1;
              const showLocation = isSelf || revealLevel >= 2;
              const firstName = String(member.full_name || member.user_name || '?').split(' ')[0];
              const rawMemberLabels = member.labels && typeof member.labels === 'object' ? member.labels : {};
              const firstVibe = typeof rawMemberLabels.vibe?.[0] === 'string' ? rawMemberLabels.vibe[0] : null;

              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberItem}
                  onPress={() => { if (!isSelf && revealLevel >= 1) router.push(`/(tabs)/user/${member.id}`); }}
                  activeOpacity={0.7}
                >
                  {showPhoto && memberPic ? (
                    <Image source={{ uri: memberPic }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatarPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
                      {showPhoto
                        ? <Ionicons name="person" size={18} color={PALETTE.rose} />
                        : <Ionicons name="lock-closed" size={16} color={PALETTE.rose} />
                      }
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                      {showFullName ? safeStr(member.full_name) || safeStr(member.user_name, '?') : firstName}
                      {isSelf ? ' (toi)' : ''}
                    </Text>
                    {!showFullName && firstVibe && (
                      <View style={styles.memberRevealLabel}>
                        <Text style={styles.memberRevealLabelText}>{firstVibe}</Text>
                      </View>
                    )}
                    {showLocation && typeof member.location === 'string' && member.location && (
                      <Text style={[styles.memberLocation, { color: colors.textSecondary }]}>
                        {member.location}
                      </Text>
                    )}
                  </View>
                  {!isSelf && revealLevel >= 1 && (
                    <TouchableOpacity onPress={() => handleOpenDm(member.id)} style={styles.messageBtn} disabled={openingDm === member.id}>
                      {openingDm === member.id
                        ? <ActivityIndicator size="small" color={PALETTE.rose} />
                        : <Ionicons name="chatbubble-outline" size={20} color={PALETTE.rose} />
                      }
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Week info */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            <Ionicons name="calendar-outline" size={18} color={PALETTE.rose} />  Semaine
          </Text>
          <Text style={[styles.weekText, { color: colors.textSecondary }]}>
            Du {formatDate(group.week_start)} au {formatDate(group.week_end)}
          </Text>
        </View>

        {/* Vote section — only visible in the last 2 days of the week */}
        {isEndOfWeek ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                <Ionicons name="thumbs-up-outline" size={18} color={PALETTE.rose} />  Vote de fin de semaine
              </Text>
              <Text style={[styles.voteQuestion, { color: colors.textSecondary }]}>
                Le groupe doit-il continuer la semaine prochaine ?
              </Text>
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteBtn, styles.voteContinue]}
                  onPress={() => handleVote(true)}
                  disabled={voting}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.voteBtnText}>Continuer ({voteSummary.continue})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteBtn, styles.voteDisband]}
                  onPress={() => handleVote(false)}
                  disabled={voting}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                  <Text style={styles.voteBtnText}>Arrêter ({voteSummary.disband})</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.voteTotal, { color: colors.textSecondary }]}>
                {voteSummary.total}/{members.length} votes
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                <Ionicons name="person-outline" size={18} color={PALETTE.rose} />  Vote sur chaque membre
              </Text>
              <Text style={[styles.voteQuestion, { color: colors.textSecondary }]}>
                Qui veux-tu garder dans le groupe la semaine prochaine ?
              </Text>
              {members.filter((m) => m.id !== currentUser?.id).map((member) => {
                const memberPic = firstAvatarUrl(member.profile_image);
                const vote = memberVotes[member.id];
                return (
                  <View key={member.id} style={styles.memberVoteRow}>
                    {memberPic
                      ? <Image source={{ uri: memberPic }} style={styles.memberAvatar} />
                      : <View style={[styles.memberAvatarPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
                          <Ionicons name="person" size={18} color={PALETTE.rose} />
                        </View>
                    }
                    <Text style={[styles.memberName, { color: colors.text, flex: 1 }]}>
                      {safeStr(member.full_name) || safeStr(member.user_name, '?')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.memberVoteBtn, { backgroundColor: vote === true ? PALETTE.success : colors.backgroundSelected }]}
                      onPress={() => handleMemberVoteToggle(member.id, true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="checkmark" size={16} color={vote === true ? '#fff' : colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.memberVoteBtn, { backgroundColor: vote === false ? PALETTE.error : colors.backgroundSelected }]}
                      onPress={() => handleMemberVoteToggle(member.id, false)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={16} color={vote === false ? '#fff' : colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {Object.keys(memberVotes).length > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, { marginTop: Spacing.two }]}
                  onPress={handleSubmitMemberVotes}
                  disabled={submittingMemberVotes}
                  activeOpacity={0.8}
                >
                  {submittingMemberVotes
                    ? <ActivityIndicator size="small" color={PALETTE.rose} />
                    : <>
                        <Ionicons name="checkmark-circle-outline" size={18} color={PALETTE.rose} />
                        <Text style={styles.actionButtonText}>Enregistrer les votes</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
            </View>
            {/* Interaction ratings card */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                <Ionicons name="star-outline" size={18} color={PALETTE.rose} />  Évalue tes Copines
              </Text>
              <Text style={[styles.voteQuestion, { color: colors.textSecondary }]}>
                3 questions par membre pour améliorer tes prochains groupes
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { marginTop: Spacing.two }]}
                onPress={handleOpenWeeklyRating}
                activeOpacity={0.8}
              >
                <Ionicons name="star" size={18} color={PALETTE.rose} />
                <Text style={styles.actionButtonText}>Donner mon avis sur la semaine</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={[styles.card, styles.voteCountdownCard, { backgroundColor: colors.backgroundElement }]}>
            <Ionicons name="time-outline" size={22} color={PALETTE.rose} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 2 }]}>Votes bientôt disponibles</Text>
              <Text style={[styles.voteQuestion, { color: colors.textSecondary, marginBottom: 0 }]}>
                {daysUntilVote === 1
                  ? 'Les votes ouvrent demain — profitez de la semaine !'
                  : `Les votes ouvrent dans ${daysUntilVote} jours — profitez de la semaine !`}
              </Text>
            </View>
          </View>
        )}

        {/* Leave button */}
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeave}
          activeOpacity={0.7}
        >
          <Ionicons name="exit-outline" size={20} color={PALETTE.error} />
          <Text style={styles.leaveText}>Quitter le groupe</Text>
        </TouchableOpacity>

        {/* Report button */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={handleReportGroup}
          activeOpacity={0.7}
        >
          <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.reportText, { color: colors.textSecondary }]}>Signaler le groupe</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  // ── Rendezvous Modal ──
  const renderRendezvousModal = () => (
    <Modal
      visible={rendezvousModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setRendezvousModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Lieu de rendez-vous</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Où voulez-vous vous retrouver ?
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.backgroundElement, color: colors.text, borderColor: colors.backgroundSelected }]}
            placeholder="Ex: Café de la Paix, Paris"
            placeholderTextColor={colors.textSecondary}
            value={rendezvousText}
            onChangeText={setRendezvousText}
            autoFocus
            maxLength={200}
            returnKeyType="next"
          />
          <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Date et heure (optionnel)</Text>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={[styles.dateTimeBtn, { backgroundColor: colors.backgroundElement, borderColor: showDatePicker ? PALETTE.rose : colors.backgroundSelected }]}
              onPress={() => { setShowTimePicker(false); setShowDatePicker((v) => !v); }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={PALETTE.rose} />
              <Text style={[styles.dateTimeBtnText, { color: rendezvousDateObj ? colors.text : colors.textSecondary }]}>
                {rendezvousDateObj ? formatDate(rendezvousDateObj.toISOString()) : 'Date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateTimeBtn, { backgroundColor: colors.backgroundElement, borderColor: showTimePicker ? PALETTE.rose : colors.backgroundSelected, opacity: rendezvousDateObj ? 1 : 0.5 }]}
              onPress={() => { if (!rendezvousDateObj) return; setShowDatePicker(false); setShowTimePicker((v) => !v); }}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color={PALETTE.rose} />
              <Text style={[styles.dateTimeBtnText, { color: rendezvousDateObj ? colors.text : colors.textSecondary }]}>
                {rendezvousDateObj ? formatTime(rendezvousDateObj.toISOString()) : 'Heure'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={rendezvousDateObj || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (event.type === 'dismissed') return;
                  if (selectedDate) {
                    const base = rendezvousDateObj || new Date();
                    const d = new Date(selectedDate);
                    d.setHours(base.getHours(), base.getMinutes(), 0, 0);
                    setRendezvousDateObj(d);
                  }
                }}
                style={{ width: '100%' }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setShowDatePicker(false)} activeOpacity={0.7}>
                  <Text style={[styles.pickerDoneText, { color: PALETTE.rose }]}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {showTimePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={rendezvousDateObj || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS !== 'ios') setShowTimePicker(false);
                  if (event.type === 'dismissed') return;
                  if (selectedDate) {
                    const base = rendezvousDateObj || new Date();
                    const d = new Date(base);
                    d.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                    setRendezvousDateObj(d);
                  }
                }}
                style={{ width: '100%' }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setShowTimePicker(false)} activeOpacity={0.7}>
                  <Text style={[styles.pickerDoneText, { color: PALETTE.rose }]}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {rendezvousDateObj && (
            <TouchableOpacity
              onPress={() => { setRendezvousDateObj(null); setShowDatePicker(false); setShowTimePicker(false); }}
              activeOpacity={0.7}
              style={{ alignSelf: 'center', marginBottom: Spacing.two }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Effacer la date</Text>
            </TouchableOpacity>
          )}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={() => setRendezvousModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnConfirm, { opacity: rendezvousText.trim() ? 1 : 0.5 }]}
              onPress={handleSetRendezvous}
              disabled={!rendezvousText.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.modalBtnConfirmText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── Render Chat View ──
  const renderChatView = () => (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item?.id ?? Math.random())}
        renderItem={({ item }) => {
          const isMine = item.sender_id === currentUser?.id;
          const isVoice = item.message_type === 'voice' && item.media_url;
          // ── DEBUG ──
          ['content', 'sender_name', 'sender_username'].forEach((f) => {
            const v = item[f];
            if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
              console.warn(`[OBJECT RENDER BUG] group message.${f}`, JSON.stringify(v));
            }
          });
          // ── END DEBUG ──
          return (
            <View style={[styles.chatMsg, isMine ? styles.chatMsgRight : styles.chatMsgLeft]}>
              {!isMine && (
                <Text style={[styles.chatSender, { color: colors.textSecondary }]}>
                  {item.sender_name || item.sender_username}
                </Text>
              )}
              {isVoice ? (
                <GroupVoiceBubble
                  uri={getStorageUrl(item.media_url)}
                  isMine={isMine}
                  colors={colors}
                  isDark={isDark}
                  time={formatTime(item.created_at)}
                />
              ) : (
                <View
                  style={[
                    styles.chatBubble,
                    isMine
                      ? { backgroundColor: PALETTE.rose }
                      : { backgroundColor: colors.backgroundElement },
                  ]}
                >
                  <Text style={[styles.chatText, { color: isMine ? '#fff' : colors.text }]}>
                    {safeStr(item.content)}
                  </Text>
                </View>
              )}
              {!isVoice && (
                <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                  {formatTime(item.created_at)}
                </Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={36} color={PALETTE.rose} />
            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
              Lancez la conversation ! 🍒
            </Text>
            <Text style={[styles.emptyChatSub, { color: colors.textSecondary }]}>
              Brise-glaces pour commencer :
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iceBreakerRow}>
              {GROUP_ICE_BREAKERS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.iceBreakerChip, { backgroundColor: colors.backgroundElement }]}
                  onPress={() => setInputText(prompt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.iceBreakerChipText, { color: colors.text }]}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
      />

      <View style={[styles.chatInputBar, { backgroundColor: colors.background, borderTopColor: colors.backgroundSelected }]}>
        {isRecordingVoice ? (
          <>
            <TouchableOpacity
              style={[styles.chatVoiceActionBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale }]}
              onPress={cancelGroupRecording}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.chatInput, { backgroundColor: colors.backgroundElement, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
              <View style={styles.chatRecDot} />
              <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 15 }}>
                {`${Math.floor(Math.floor((recorderState.durationMillis ?? 0) / 1000) / 60)}:${String(Math.floor((recorderState.durationMillis ?? 0) / 1000) % 60).padStart(2, '0')}`}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>En cours...</Text>
            </View>
            <TouchableOpacity
              style={[styles.chatSendBtn, { backgroundColor: '#FF3B30' }]}
              onPress={stopGroupRecording}
              disabled={uploadingVoice}
              activeOpacity={0.7}
            >
              {uploadingVoice
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="stop" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.chatInput, { backgroundColor: colors.backgroundElement, color: colors.text }]}
              placeholder="Écris ton message..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={5000}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            {inputText.trim().length > 0 ? (
              <TouchableOpacity
                style={[styles.chatSendBtn, { opacity: !sending ? 1 : 0.4 }]}
                onPress={handleSendMessage}
                disabled={sending}
                activeOpacity={0.7}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.chatSendBtn, { backgroundColor: isDark ? '#3D332E' : PALETTE.rosePale }]}
                onPress={startGroupRecording}
                disabled={sending}
                activeOpacity={0.7}
              >
                <Ionicons name="mic-outline" size={18} color={PALETTE.rose} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );

  if (loading) {
    return <GroupsSkeleton colors={colors} isDark={isDark} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Cercles</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {group ? 'Ton cercle de la semaine' : 'Rejoins un groupe cette semaine'}
        </Text>        </View>

      {!group ? (
        /* No group - countdown to next weekly circle */
        <View style={styles.emptyState}>
          <View style={[styles.emptyCircle, { backgroundColor: PALETTE.rosePale }]}>
            <Ionicons name="people-outline" size={48} color={PALETTE.rose} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Ton groupe arrive bientôt
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Chaque semaine, on forme un nouveau groupe avec des personnes qui te ressemblent. Reviens lundi pour rencontrer tes nouvelles copines !
          </Text>

          {/* Countdown card to the next weekly circle */}
          <View style={[styles.countdownCard, { backgroundColor: colors.backgroundElement }]}>
            <View style={styles.countdownCardAccent} />
            <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
              Prochain groupe dans
            </Text>
            <View style={styles.countdownRow}>
              {[
                { value: nextGroupIn.days, label: 'jours' },
                { value: nextGroupIn.hours, label: 'heures' },
                { value: nextGroupIn.minutes, label: 'mins' },
              ].map((unit, i) => (
                <React.Fragment key={unit.label}>
                  {i > 0 && <Text style={[styles.countdownSep, { color: PALETTE.rose }]}>·</Text>}
                  <View style={styles.countdownUnit}>
                    <Text style={[styles.countdownValue, { color: PALETTE.rose }]}>
                      {String(unit.value).padStart(2, '0')}
                    </Text>
                    <Text style={[styles.countdownUnitLabel, { color: colors.textSecondary }]}>
                      {unit.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            <View style={styles.countdownNote}>
              <View style={styles.pulseDot} />
              <Text style={[styles.countdownNoteText, { color: colors.textSecondary }]}>
                Nouveaux groupes chaque lundi à 8h
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.exploreButton, { borderColor: PALETTE.rose }]}
            onPress={() => router.push('/(tabs)/events')}
            activeOpacity={0.8}
          >
            <Ionicons name="compass-outline" size={18} color={PALETTE.rose} />
            <Text style={[styles.exploreButtonText, { color: PALETTE.rose }]}>
              En attendant, explore les sorties
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Has a group */
        <View style={styles.groupContainer}>
          {/* Tab toggle: Info / Chat */}
          <View style={[styles.tabBar, { backgroundColor: colors.backgroundElement }]}>
            <TouchableOpacity
              style={[styles.tab, !showChat && styles.tabActive]}
              onPress={() => setShowChat(false)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={!showChat ? PALETTE.rose : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: !showChat ? PALETTE.rose : colors.textSecondary },
                ]}
              >
                Infos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, showChat && styles.tabActive]}
              onPress={() => setShowChat(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={18}
                color={showChat ? PALETTE.rose : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: showChat ? PALETTE.rose : colors.textSecondary },
                ]}
              >
                Chat
              </Text>
            </TouchableOpacity>
          </View>

          {showChat ? renderChatView() : renderGroupView()}
        </View>
      )}

      {renderRendezvousModal()}
      {renderDissolutionModal()}
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
  subtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  // ── Empty State ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.two,
  },
  // ── Countdown ──
  countdownCard: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: Spacing.two,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  countdownCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: PALETTE.rose,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  countdownUnit: {
    minWidth: 54,
    alignItems: 'center',
  },
  countdownSep: {
    fontSize: 30,
    fontWeight: '800',
    opacity: 0.4,
    marginBottom: 12,
  },
  countdownValue: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  countdownUnitLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  countdownNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PALETTE.rose,
  },
  countdownNoteText: {
    fontSize: 12,
    fontWeight: '500',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three - 2,
    borderRadius: 18,
    borderWidth: 1.5,
    marginTop: 4,
  },
  exploreButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  // ── Group Container ──
  groupContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.one + 6,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: PALETTE.rosePale,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  groupContent: {
    flex: 1,
  },
  // ── Hero group card ──
  heroCard: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#8B6FB8',
    overflow: 'hidden',
    shadowColor: '#C4325E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  heroBlobA: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(196,50,94,0.30)',
  },
  heroBlobB: {
    position: 'absolute',
    bottom: -24,
    left: 24,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  heroWeekLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  heroName: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroCompatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroCompatText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  heroAvatarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  heroAvatarCol: { alignItems: 'center', width: 60 },
  heroAvatarWrap: { marginBottom: 4 },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(80,50,120,0.5)',
  },
  heroAvatarLocked: { backgroundColor: 'rgba(80,50,120,0.6)' },
  heroAvatarName: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  heroChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  heroChipText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  // ── Cards ──
  interestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 18,
  },
  interestText: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.rose,
    flex: 1,
  },
  card: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    borderRadius: 18,
    padding: Spacing.three,
    shadowColor: PALETTE.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  rendezvousInfo: {
    gap: 2,
    marginBottom: Spacing.two,
  },
  rendezvousLocation: {
    fontSize: 16,
    fontWeight: '600',
  },
  rendezvousTime: {
    fontSize: 13,
  },
  emptyRendezvous: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: Spacing.one,
  },
  rendezvousSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  rendezvousSuggestor: {
    fontSize: 11,
    marginTop: 2,
  },
  rendezvousLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rendezvousLikeCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.one,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.rose,
  },
  weekText: {
    fontSize: 14,
  },
  // ── Members ──
  membersList: {
    gap: Spacing.one,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberLocation: {
    fontSize: 12,
  },
  messageBtn: {
    padding: Spacing.one,
  },
  // ── Activity suggestions ──
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  activityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  activityRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.07)',
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  activityDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  activityVoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 44,
    justifyContent: 'center',
  },

  activityVoteCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  activityWeatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  activityWeatherEmoji: { fontSize: 11 },
  activityWeatherText: { fontSize: 11, fontWeight: '700' },

  voteCountdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // ── Vote ──
  voteQuestion: {
    fontSize: 14,
    marginBottom: Spacing.two,
  },
  voteRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.one + 4,
    borderRadius: 14,
  },
  voteContinue: {
    backgroundColor: PALETTE.success,
  },
  voteDisband: {
    backgroundColor: PALETTE.error,
  },
  voteBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  voteTotal: {
    fontSize: 12,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  // ── Leave ──
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: PALETTE.error,
    backgroundColor: PALETTE.white,
  },
  leaveText: {
    color: PALETTE.error,
    fontSize: 15,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  reportText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ── Chat ──
  chatContainer: {
    flex: 1,
  },
  chatList: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    flexGrow: 1,
  },
  chatMsg: {
    marginVertical: 3,
    maxWidth: '80%',
  },
  chatMsgLeft: {
    alignSelf: 'flex-start',
  },
  chatMsgRight: {
    alignSelf: 'flex-end',
  },
  chatSender: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 4,
  },
  chatBubble: {
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
  },
  chatText: {
    fontSize: 15,
    lineHeight: 20,
  },
  chatTime: {
    fontSize: 10,
    marginTop: 1,
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
    gap: Spacing.one,
  },
  emptyChatText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyChatSub: {
    fontSize: 13,
    marginTop: 4,
  },
  iceBreakerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  iceBreakerChip: {
    maxWidth: 200,
    maxHeight: 200,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.rose + '40',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iceBreakerChipText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  // Progressive reveal
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  revealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PALETTE.rosePale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  revealBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.rose,
  },
  memberRevealLabel: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  memberRevealLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C4325E',
  },
  compatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  compatTotal: {
    marginLeft: 'auto',
    fontSize: 18,
    fontWeight: '800',
    color: PALETTE.rose,
  },
  compatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  compatLabel: { fontSize: 12, fontWeight: '600', width: 100 },
  compatBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  compatFill: { height: 6, borderRadius: 3 },
  compatPct: { fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' },
  compatWeight: { fontSize: 11, width: 28 },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  chatInput: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 4,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.rose,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  chatVoiceActionBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  chatRecDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
  },
  // ── Rendezvous Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing.half,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.three,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  memberVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  memberVoteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: PALETTE.backgroundGrey,
  },
  modalBtnCancelText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 15,
  },
  modalBtnConfirm: {
    backgroundColor: PALETTE.rose,
  },
  modalBtnConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
  },
  dateTimeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  pickerContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  pickerDoneBtn: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pickerDoneText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

const dissStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  stepContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: 40,
  },
  emojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  emoji: { fontSize: 36 },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
  },
  star: { fontSize: 40 },
  stepBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: PALETTE.rose,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  step2Header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: 8,
  },
  membersList: {
    paddingHorizontal: Spacing.four,
    gap: 12,
    paddingBottom: 20,
  },
  memberBlock: {
    borderRadius: 18,
    padding: Spacing.three,
    gap: 10,
  },
  memberBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberAvatarFallback: {
    backgroundColor: PALETTE.rosePale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberBlockName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  dimBlock: {
    gap: 6,
  },
  dimQuestion: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  ratingBtn: {
    padding: 3,
  },
  ratingStar: {
    fontSize: 26,
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: PALETTE.rose,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  skipBtnBottom: {
    alignItems: 'center',
    paddingVertical: 14,
  },
});
