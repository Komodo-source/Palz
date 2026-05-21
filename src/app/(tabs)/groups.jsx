import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { groupsApi, messagesApi } from '@/services/api';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { parseDbJson } from '@/utils/parsers';

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

export default function GroupsScreen() {
  const { user: currentUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [voting, setVoting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [rendezvousModalVisible, setRendezvousModalVisible] = useState(false);
  const [rendezvousText, setRendezvousText] = useState('');
  const [rendezvousTimeText, setRendezvousTimeText] = useState('');
  const [memberVotes, setMemberVotes] = useState({}); // { [memberId]: true | false }
  const [submittingMemberVotes, setSubmittingMemberVotes] = useState(false);
  const [openingDm, setOpeningDm] = useState(null); // memberId being loaded
  const flatListRef = useRef(null);
  const pollInterval = useRef(null);

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
    }, [fetchGroup])
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

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await groupsApi.generate();
      await fetchGroup();
    } catch (err) {
      const msg = err.response?.data?.error || 'Impossible de créer un groupe.';
      Alert.alert('Erreur', msg);
    } finally {
      setGenerating(false);
    }
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
          Alert.alert('✅ Le groupe continue !', 'Une nouvelle semaine commence.');
        } else {
          Alert.alert('👋 Groupe dissous', 'Le groupe a été dissous suite au vote.');
          setGroup(null);
          setShowChat(false);
          setMessages([]);
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
      Alert.alert('Erreur', 'Impossible d\'envoyer le message.');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const openRendezvousModal = () => {
    setRendezvousText(group?.rendezvous_location || '');
    setRendezvousTimeText(group?.rendezvous_time ? formatDate(group.rendezvous_time) + ' ' + formatTime(group.rendezvous_time) : '');
    setRendezvousModalVisible(true);
  };

  const handleSetRendezvous = async () => {
    const location = rendezvousText.trim();
    if (!location || !group?.id) return;
    setRendezvousModalVisible(false);
    // Parse time: expect "DD/MM/YYYY HH:MM" or similar
    let parsedTime = null;
    if (rendezvousTimeText.trim()) {
      const t = new Date(rendezvousTimeText.trim());
      if (!isNaN(t.getTime())) parsedTime = t.toISOString();
    }
    try {
      await groupsApi.setRendezvous(group.id, location, parsedTime);
      await fetchGroup();
    } catch (err) {
      console.error('Set rendezvous error:', err);
      Alert.alert('Erreur', 'Impossible de définir le rendez-vous.');
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
      Alert.alert('Votes enregistrés', 'Tes votes sur les membres ont été pris en compte.');
    } catch (err) {
      console.error('Submit member votes error:', err);
      Alert.alert('Erreur', 'Impossible d\'enregistrer les votes.');
    } finally {
      setSubmittingMemberVotes(false);
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

  // ── Render Group View ──
  const renderGroupView = () => {
    if (!group) return null;

    const members = group.members || [];
    const voteSummary = group.vote_summary || { continue: 0, disband: 0, total: 0 };

    return (
      <ScrollView style={styles.groupContent} showsVerticalScrollIndicator={false}>
        {/* Common interest */}
        <View style={[styles.interestCard, { backgroundColor: PALETTE.rosePale }]}>
          <Ionicons name="sparkles" size={20} color={PALETTE.rose} />
          <Text style={styles.interestText}>{group.common_interest || 'Groupe hebdomadaire'}</Text>
        </View>

        {/* Rendezvous */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            <Ionicons name="location-outline" size={18} color={PALETTE.rose} />  Rendez-vous
          </Text>
          {group.rendezvous_location ? (
            <View style={styles.rendezvousInfo}>
              <Text style={[styles.rendezvousLocation, { color: colors.text }]}>
                {group.rendezvous_location}
              </Text>
              {group.rendezvous_time && (
                <Text style={[styles.rendezvousTime, { color: colors.textSecondary }]}>
                  {formatDate(group.rendezvous_time)} à {formatTime(group.rendezvous_time)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.emptyRendezvous, { color: colors.textSecondary }]}>
              Pas encore de rendez-vous fixé
            </Text>
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

        {/* Members */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            <Ionicons name="people-outline" size={18} color={PALETTE.rose} />  Membres ({members.length})
          </Text>
          <View style={styles.membersList}>
            {members.map((member) => {
              const memberPic = Array.isArray(parseDbJson(member.profile_image))
                ? parseDbJson(member.profile_image)[0]
                : null;
              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberItem}
                  onPress={() => {
                    if (member.id !== currentUser?.id) {
                      router.push(`/(tabs)/user/${member.id}`);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {memberPic ? (
                    <Image source={{ uri: memberPic }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatarPlaceholder, { backgroundColor: PALETTE.rosePale }]}>
                      <Ionicons name="person" size={18} color={PALETTE.rose} />
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                      {member.full_name || member.user_name}
                      {member.id === currentUser?.id ? ' (toi)' : ''}
                    </Text>
                    {member.location && (
                      <Text style={[styles.memberLocation, { color: colors.textSecondary }]}>
                        {member.location}
                      </Text>
                    )}
                  </View>
                  {member.id !== currentUser?.id && (
                    <TouchableOpacity
                      onPress={() => handleOpenDm(member.id)}
                      style={styles.messageBtn}
                      disabled={openingDm === member.id}
                    >
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

        {/* Vote section */}
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

        {/* Per-member votes */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            <Ionicons name="person-outline" size={18} color={PALETTE.rose} />  Vote sur chaque membre
          </Text>
          <Text style={[styles.voteQuestion, { color: colors.textSecondary }]}>
            Qui veux-tu garder dans le groupe la semaine prochaine ?
          </Text>
          {members.filter((m) => m.id !== currentUser?.id).map((member) => {
            const memberPic = Array.isArray(parseDbJson(member.profile_image)) ? parseDbJson(member.profile_image)[0] : null;
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
                  {member.full_name || member.user_name}
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

        {/* Leave button */}
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleLeave}
          activeOpacity={0.7}
        >
          <Ionicons name="exit-outline" size={20} color={PALETTE.error} />
          <Text style={styles.leaveText}>Quitter le groupe</Text>
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
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.backgroundElement, color: colors.text, borderColor: colors.backgroundSelected }]}
            placeholder="Ex: 2026-06-01 15:00"
            placeholderTextColor={colors.textSecondary}
            value={rendezvousTimeText}
            onChangeText={setRendezvousTimeText}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={handleSetRendezvous}
          />
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
          return (
            <View style={[styles.chatMsg, isMine ? styles.chatMsgRight : styles.chatMsgLeft]}>
              {!isMine && (
                <Text style={[styles.chatSender, { color: colors.textSecondary }]}>
                  {item.sender_name || item.sender_username}
                </Text>
              )}
              <View
                style={[
                  styles.chatBubble,
                  isMine
                    ? { backgroundColor: PALETTE.rose }
                    : { backgroundColor: colors.backgroundElement },
                ]}
              >
                <Text style={[styles.chatText, { color: isMine ? '#fff' : colors.text }]}>
                  {item.content}
                </Text>
              </View>
              <Text style={[styles.chatTime, { color: colors.textSecondary }]}>
                {formatTime(item.created_at)}
              </Text>
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
              Pas encore de messages. Dis bonjour !
            </Text>
          </View>
        }
      />

      <View style={[styles.chatInputBar, { backgroundColor: colors.background, borderTopColor: colors.backgroundSelected }]}>
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
        <TouchableOpacity
          style={[styles.chatSendBtn, { opacity: inputText.trim().length > 0 ? 1 : 0.4 }]}
          onPress={handleSendMessage}
          disabled={inputText.trim().length === 0 || sending}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={PALETTE.rose} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Groupes</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {group ? 'Ton groupe de la semaine' : 'Rejoins un groupe cette semaine'}
        </Text>
      </View>

      {!group ? (
        /* No group - show generate button */
        <View style={styles.emptyState}>
          <View style={[styles.emptyCircle, { backgroundColor: PALETTE.rosePale }]}>
            <Ionicons name="people-outline" size={48} color={PALETTE.rose} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Pas de groupe cette semaine
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            On va te trouver un groupe avec des personnes qui te ressemblent, proches de chez toi !
          </Text>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.8}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.generateButtonText}>Créer mon groupe</Text>
              </>
            )}
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.rose,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 18,
    marginTop: Spacing.one,
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
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
    fontSize: 14,
  },
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
});
