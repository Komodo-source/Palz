import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Slot, router, useSegments } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';

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

function TabBarIcon({ name, focused }) {
  const icons = {
    events: 'calendar-outline',
    wall: 'images-outline',
    groups: 'people-outline',
    messages: 'chatbubbles-outline',
    profile: 'person-outline',
  };
  return (
    <Ionicons
      name={icons[name] || 'ellipse'}
      size={focused ? 26 : 24}
      color={focused ? '#FF8FA3' : '#B0A098'}
    />
  );
}

function BottomTabBar({ activeIndex, onTabPress, colors }) {
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
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(index)}
            activeOpacity={0.7}
          >
            <TabBarIcon name={tab.key} focused={isFocused} />
            <Text
              style={[
                styles.tabLabel,
                {
              color: isFocused ? '#FF8FA3' : colors.textSecondary,
              fontWeight: isFocused ? '700' : '500',
                },
              ]}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Renders only the active screen (lazy load — inactive screens never mount) ──
function ActiveScreen({ activeIndex }) {
  if (activeIndex === 0) return <WallScreen />;
  if (activeIndex === 1) return <EventsScreen />;
  if (activeIndex === 2) return <GroupsScreen />;
  if (activeIndex === 3) return <MessagesScreen />;
  if (activeIndex === 4) return <ProfileScreen />;
  return <EventsScreen />;
}

// ── Main Layout ──
export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const segments = useSegments();

  // Redirect to login if not authenticated (and not still loading)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) return null;

  // Check if we're on a sub-route (chat, profil) — render as stack (no tabs, no pager)
  const isSubRoute = segments.includes('chat') || segments.includes('profil') || segments.includes('user') || segments.includes('event');

  const getActiveIndexFromPath = useCallback(() => {
    const segment = segments[segments.length - 1];
    const idx = TABS.findIndex((t) => t.key === segment);
    return idx >= 0 ? idx : 0;
  }, [segments]);

  const [activeIndex, setActiveIndex] = useState(getActiveIndexFromPath());

  // Sync on segment changes (deep links, etc.)
  useEffect(() => {
    const idx = getActiveIndexFromPath();
    if (idx !== activeIndex) {
      setActiveIndex(idx);
    }
  }, [segments]);

  const handleTabPress = useCallback(
    (index) => {
      if (index === activeIndex) return;
      setActiveIndex(index);
      const route = TABS[index].key;
      router.replace(`/(tabs)/${route}`);
    },
    [activeIndex]
  );

  if (!isAuthenticated) return null;

  // Sub-routes (chat, profil): render as simple stack (no tab bar, no pager)
  if (isSubRoute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Slot />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Active screen (no swipe) */}
      <ActiveScreen activeIndex={activeIndex} />

      {/* Bottom Tab Bar */}
      <BottomTabBar
        activeIndex={activeIndex}
        onTabPress={handleTabPress}
        colors={colors}
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
});
