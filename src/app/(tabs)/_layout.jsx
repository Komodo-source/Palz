import React, { useRef, useCallback, useState, useEffect } from 'react';
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
import { getColors, Spacing } from '@/constants/theme';

// Always import screen components (they work on all platforms)
import SwipeScreen from './index';
import MessagesScreen from './messages';
import ProfileScreen from './profile';

const TABS = [
  { key: 'index', title: 'Discover', icon: 'diamond-outline' },
  { key: 'messages', title: 'Messages', icon: 'chatbubbles-outline' },
  { key: 'profile', title: 'Profile', icon: 'person-outline' },
];

function TabBarIcon({ name, focused }) {
  const icons = {
    index: 'diamond-outline',
    messages: 'chatbubbles-outline',
    profile: 'person-outline',
  };
  return (
    <Ionicons
      name={icons[name] || 'ellipse'}
      size={focused ? 26 : 24}
      color={focused ? '#FF6B8A' : '#B0A098'}
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
                  color: isFocused ? '#FF6B8A' : colors.textSecondary,
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

// ── Native: PagerView Swipeable Layout ──
function NativeSwipeableLayout({ activeIndex, onPageChange }) {
  const pagerRef = useRef(null);
  const currentPageRef = useRef(activeIndex);
  const [PagerViewComponent, setPagerViewComponent] = useState(null);

  // Lazy-load PagerView (native-only)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-pager-view');
        if (mounted) setPagerViewComponent(() => mod.default);
      } catch (e) {
        console.warn('PagerView not available:', e.message);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Sync when activeIndex changes from tab press
  useEffect(() => {
    if (activeIndex !== currentPageRef.current) {
      currentPageRef.current = activeIndex;
      pagerRef.current?.setPage(activeIndex);
    }
  }, [activeIndex]);

  const handlePageSelected = useCallback(
    (e) => {
      const index = e.nativeEvent.position;
      currentPageRef.current = index;
      onPageChange(index);
    },
    [onPageChange]
  );

  if (!PagerViewComponent) {
    return <FallbackContent activeIndex={activeIndex} />;
  }

  return (
    <PagerViewComponent
      ref={pagerRef}
      style={styles.pager}
      initialPage={activeIndex}
      onPageSelected={handlePageSelected}
      overdrag={false}
      pageMargin={0}
    >
      <View key="discover" style={styles.page}>
        <SwipeScreen />
      </View>
      <View key="messages" style={styles.page}>
        <MessagesScreen />
      </View>
      <View key="profile" style={styles.page}>
        <ProfileScreen />
      </View>
    </PagerViewComponent>
  );
}

// ── Web / Fallback: renders the active screen ──
function FallbackContent({ activeIndex }) {
  const screens = [SwipeScreen, MessagesScreen, ProfileScreen];
  const Active = screens[activeIndex];
  return Active ? <Active /> : null;
}

// ── Main Layout ──
export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const segments = useSegments();

  // Check if we're on a sub-route (chat, profil) — render as stack (no tabs, no pager)
  const isSubRoute = segments.includes('chat') || segments.includes('profil');

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

  const handlePageChange = useCallback((index) => {
    setActiveIndex(index);
    const route = TABS[index].key;
    router.replace(`/(tabs)/${route}`);
  }, []);

  // Sub-routes (chat, profil): render as simple stack (no tab bar, no pager)
  if (isSubRoute) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Slot />
      </View>
    );
  }

  const isNative = Platform.OS !== 'web';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Swipeable content */}
      {isNative ? (
        <NativeSwipeableLayout
          activeIndex={activeIndex}
          onPageChange={handlePageChange}
        />
      ) : (
        <FallbackContent activeIndex={activeIndex} />
      )}

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
  pager: {
    flex: 1,
  },
  page: {
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
