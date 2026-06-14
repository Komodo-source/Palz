import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Slot, router, useSegments } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { hasCompletedOnboarding } from '@/utils/onboarding';
import { messagesApi, groupsApi } from '@/services/api';
import storage from '@/services/storage';
import RenderErrorBoundary from '@/components/RenderErrorBoundary';
import {
  WallSkeleton,
  EventsSkeleton,
  GroupsSkeleton,
  MessagesSkeleton,
  ProfileSkeleton,
} from '@/components/Skeleton';

// Always import screen components (they work on all platforms)
import SwipeScreen from './index'; // kept in code but not shown in tab bar
import EventsScreen from './events';
import WallScreen from './wall';
import GroupsScreen from './groups';
import MessagesScreen from './messages';
import ProfileScreen from './profile';

const TABS = [
  { key: 'wall', title: 'Toile', icon: 'images-outline' },
  { key: 'events', title: 'Événements', icon: 'calendar-outline' },
  { key: 'groups', title: 'Groupes', icon: 'people-outline' },
  { key: 'messages', title: 'Messages', icon: 'chatbubbles-outline' },
  { key: 'profile', title: 'Profil', icon: 'person-outline' },
];

const SCREENS = [WallScreen, EventsScreen, GroupsScreen, MessagesScreen, ProfileScreen];

// Per-tab skeleton shown while a tab is NOT the active one. Keeping inactive tabs
// in their skeleton state (instead of their last-rendered content) means switching
// to a tab always goes skeleton → content, never stale-content → skeleton → content.
const SKELETONS = [WallSkeleton, EventsSkeleton, GroupsSkeleton, MessagesSkeleton, ProfileSkeleton];

function TabIcon({ name, focused, badge, dot }) {
  const icons = {
    events: 'calendar-outline',
    wall: 'images-outline',
    groups: 'people-outline',
    messages: 'chatbubbles-outline',
    profile: 'person-outline',
  };

  return (
    <View style={{ position: 'relative' }}>
      <Ionicons
        name={icons[name] || 'ellipse'}
        size={focused ? 26 : 24}
        color={focused ? '#FF8FA3' : '#B0A098'}
      />
      {badge > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
        </View>
      ) : dot ? (
        <View style={styles.tabDot} />
      ) : null}
    </View>
  );
}

function TabLabel({ label, focused }) {
  return (
    <Text
      style={[
        styles.tabLabel,
        {
          color: focused ? '#FF8FA3' : '#B0A098',
          fontWeight: focused ? '700' : '500',
        },
      ]}
    >
      {label}
    </Text>
  );
}

function BottomTabBar({ activeIndex, onTabPress, colors, unreadCount, groupsHasNew }) {
  const tabBarHeight = Platform.OS === 'ios' ? 88 : 68;
  const bottomPadding = Platform.OS === 'ios' ? 28 : 10;

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
      ]}
    >
      {TABS.map((tab, index) => {
        const isFocused = index === activeIndex;
        const badge = tab.key === 'messages' ? unreadCount : 0;
        const dot = tab.key === 'groups' && groupsHasNew && !isFocused;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(index)}
            activeOpacity={0.7}
          >
            <TabIcon name={tab.key} focused={isFocused} badge={badge} dot={dot} />
            <TabLabel label={tab.title} focused={isFocused} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main Layout ──
export default function TabsLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const segments = useSegments();
  const [unreadCount, setUnreadCount] = useState(0);
  const [groupsHasNew, setGroupsHasNew] = useState(false);
  const pagerRef = useRef(null);
  const groupsIndex = TABS.findIndex((t) => t.key === 'groups');

  const onboarded = hasCompletedOnboarding(user);

  // Check if we're on a sub-route (chat, profil...) — render as stack (no tabs, no pager)
  const isSubRoute =
    segments.includes('chat') ||
    segments.includes('profil') ||
    segments.includes('user') ||
    segments.includes('event') ||
    segments.includes('settings');

  const getActiveIndexFromPath = useCallback(() => {
    const segment = segments[segments.length - 1];
    const idx = TABS.findIndex((t) => t.key === segment);
    return idx >= 0 ? idx : 0;
  }, [segments]);

  const [activeIndex, setActiveIndex] = useState(getActiveIndexFromPath());
  // Lazy mount: a tab screen mounts on first visit (or when adjacent, so swiping
  // reveals content instead of a blank page) and stays mounted afterwards.
  const [visited, setVisited] = useState(() => new Set([getActiveIndexFromPath()]));

  const markVisited = useCallback((index) => {
    setVisited((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  // Redirect to login if not authenticated; to onboarding if profile incomplete.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!onboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isAuthenticated, onboarded]);

  // Poll unread conversations count for the Messages tab badge
  useEffect(() => {
    if (!isAuthenticated) return;
    const check = async () => {
      try {
        const res = await messagesApi.getConversations();
        const convs = res.data?.conversations ?? [];
        setUnreadCount(convs.filter((c) => c.has_unread).length);
      } catch {}
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Poll the current group; show a dot on the Groups tab when there's new activity
  // (a freshly formed group or an update) the user hasn't seen yet.
  useEffect(() => {
    if (!isAuthenticated) return;
    const check = async () => {
      try {
        const res = await groupsApi.getCurrent();
        const group = res.data?.group;
        if (!group) { setGroupsHasNew(false); return; }
        const activityTs = new Date(group.updated_at || group.created_at || 0).getTime();
        const lastSeenStr = await storage.getItem('groups_last_seen');
        const lastSeen = lastSeenStr ? Number(lastSeenStr) : 0;
        setGroupsHasNew(activityTs > lastSeen);
      } catch {}
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Mark the group activity as seen whenever the Groups tab is opened.
  useEffect(() => {
    if (activeIndex === groupsIndex) {
      storage.setItem('groups_last_seen', String(Date.now())).catch(() => {});
      setGroupsHasNew(false);
    }
  }, [activeIndex, groupsIndex]);

  // Sync on segment changes (deep links, etc.) — but never while a sub-route is
  // shown, so the user comes back to the tab they left from.
  useEffect(() => {
    if (isSubRoute) return;
    const idx = getActiveIndexFromPath();
    if (idx !== activeIndex) {
      setActiveIndex(idx);
      markVisited(idx);
      pagerRef.current?.setPageWithoutAnimation?.(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  const goToTab = useCallback(
    (index, fromSwipe = false) => {
      if (index === activeIndex) return;
      setActiveIndex(index);
      markVisited(index);
      if (!fromSwipe) pagerRef.current?.setPage?.(index);
      router.replace(`/(tabs)/${TABS[index].key}`);
    },
    [activeIndex, markVisited]
  );

  if (isLoading) return null;
  if (!isAuthenticated || !onboarded) return null;

  // Sub-routes (chat, profil): render as simple stack (no tab bar, no pager).
  // The `key` keeps this branch a distinct fiber from the tab-pager branch
  // below, so React fully unmounts one mode before mounting the other instead
  // of cross-reconciling a SlotNavigator into a PagerView (which corrupts the
  // tree and throws "Objects are not valid as a React child" on the 2nd visit).
  if (isSubRoute) {
    return (
      <View key="subroute-mode" style={[styles.container, { backgroundColor: colors.background }]}>
        <RenderErrorBoundary name={`sub-route:${segments.join('/')}`}>
          <Slot />
        </RenderErrorBoundary>
      </View>
    );
  }

  return (
    <View key="tabs-mode" style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Swipeable pages */}
      <PagerView
        ref={pagerRef}
        style={styles.container}
        initialPage={activeIndex}
        offscreenPageLimit={1}
        onPageSelected={(e) => {
          const index = e.nativeEvent.position;
          if (index !== activeIndex) goToTab(index, true);
        }}
      >
        {TABS.map((tab, index) => {
          const Screen = SCREENS[index];
          const Skeleton = SKELETONS[index];
          const isActive = index === activeIndex;
          // Only the active tab mounts its real screen; every other tab renders
          // its skeleton. This keeps inactive pages from showing stale content,
          // so a tab switch is always a clean skeleton → content transition.
          return (
            <View key={tab.key} style={styles.container} collapsable={false}>
              {isActive ? (
                <RenderErrorBoundary name={`tab:${tab.key}`}>
                  <Screen />
                </RenderErrorBoundary>
              ) : (
                <Skeleton colors={colors} isDark={colorScheme === 'dark'} />
              )}
            </View>
          );
        })}
      </PagerView>

      {/* Bottom Tab Bar */}
      <BottomTabBar
        activeIndex={activeIndex}
        onTabPress={goToTab}
        colors={colors}
        unreadCount={unreadCount}
        groupsHasNew={groupsHasNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
  },
  tabDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF8FA3',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 12,
  },
});
