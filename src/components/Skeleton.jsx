import React, { useEffect, useRef, useContext, createContext } from 'react';
import { View, ScrollView, Animated, Dimensions, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
const SkeletonCtx = createContext(null);

// ── One animation per mounted skeleton screen ─────────────────────
export function SkeletonContainer({ children, style }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const colorScheme = useRef(null);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <SkeletonCtx.Provider value={opacity}>
      <View style={style}>{children}</View>
    </SkeletonCtx.Provider>
  );
}

// ── Single shimmer block ──────────────────────────────────────────
export function SkeletonBox({ width, height, borderRadius = 8, style, isDark = false }) {
  const opacity = useContext(SkeletonCtx);
  const bg = isDark ? '#4D3F38' : '#F0DCE0';

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: bg },
        opacity != null ? { opacity } : null,
        style,
      ]}
    />
  );
}

// ── Wall (La Toile) ───────────────────────────────────────────────
const WALL_PAD = 16;
const WALL_GAP = 10;
const WALL_COL = (W - WALL_PAD * 2 - WALL_GAP) / 2;
const WALL_IMG_HEIGHTS = [210, 260, 195, 250];

export function WallSkeleton({ colors, isDark }) {
  const S = (props) => <SkeletonBox isDark={isDark} {...props} />;

  return (
    <SkeletonContainer style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: WALL_PAD, paddingTop: 72, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 6 }}>
            <S width={130} height={34} borderRadius={8} />
            <S width={100} height={14} borderRadius={6} />
          </View>
          <S width={100} height={40} borderRadius={16} />
        </View>
        <S width={W - WALL_PAD * 2} height={44} borderRadius={14} />
      </View>

      {/* 2-column masonry grid */}
      <View style={{ flexDirection: 'row', paddingHorizontal: WALL_PAD, gap: WALL_GAP, paddingTop: 8 }}>
        {[[WALL_IMG_HEIGHTS[0], WALL_IMG_HEIGHTS[2]], [WALL_IMG_HEIGHTS[1], WALL_IMG_HEIGHTS[3]]].map(
          (colHeights, ci) => (
            <View key={ci} style={{ width: WALL_COL, gap: WALL_GAP }}>
              {colHeights.map((imgH, ri) => (
                <View
                  key={ri}
                  style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.backgroundElement }}
                >
                  <S width={WALL_COL} height={imgH} borderRadius={0} />
                  <View style={{ padding: 10, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <S width={26} height={26} borderRadius={13} />
                      <S width={WALL_COL * 0.48} height={12} borderRadius={6} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <S width={(WALL_COL - 26) / 2} height={28} borderRadius={10} />
                      <S width={(WALL_COL - 26) / 2} height={28} borderRadius={10} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </View>
    </SkeletonContainer>
  );
}

// ── Messages ──────────────────────────────────────────────────────
export function MessagesSkeleton({ colors, isDark }) {
  const S = (props) => <SkeletonBox isDark={isDark} {...props} />;

  return (
    <SkeletonContainer style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.four,
          paddingTop: 72,
          paddingBottom: Spacing.two,
          gap: 10,
        }}
      >
        <S width={160} height={34} borderRadius={8} style={{ flex: 1 }} />
        <S width={40} height={28} borderRadius={12} />
      </View>

      {/* Events row */}
      <View
        style={{
          paddingTop: 8,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          marginBottom: 4,
        }}
      >
        <View style={{ paddingHorizontal: Spacing.four, marginBottom: 10 }}>
          <S width={90} height={13} borderRadius={6} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: 10 }}
          scrollEnabled={false}
        >
          {[0, 1, 2].map((i) => (
            <S key={i} width={130} height={100} borderRadius={16} />
          ))}
        </ScrollView>
      </View>

      {/* Conversation rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.four,
            paddingVertical: 13,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            gap: Spacing.three,
          }}
        >
          <S width={58} height={58} borderRadius={29} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <S width={W * 0.35} height={16} borderRadius={6} />
              <S width={36} height={12} borderRadius={6} />
            </View>
            <S width={W * 0.5} height={14} borderRadius={6} />
          </View>
        </View>
      ))}
    </SkeletonContainer>
  );
}

// ── Groups (Cercles) ──────────────────────────────────────────────
export function GroupsSkeleton({ colors, isDark }) {
  const S = (props) => <SkeletonBox isDark={isDark} {...props} />;
  const cardW = W - Spacing.four * 2;

  return (
    <SkeletonContainer style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: Spacing.four, paddingTop: 72, paddingBottom: 8, gap: 6 }}>
        <S width={130} height={34} borderRadius={8} />
        <S width={190} height={14} borderRadius={6} />
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', marginHorizontal: Spacing.four, marginTop: 12, gap: 8 }}>
        <S width={80} height={36} borderRadius={18} />
        <S width={80} height={36} borderRadius={18} />
      </View>

      {/* Group card */}
      <View
        style={{
          marginHorizontal: Spacing.four,
          marginTop: 16,
          borderRadius: 24,
          backgroundColor: colors.backgroundElement,
          padding: 20,
          gap: 16,
        }}
      >
        {/* Member avatars */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <S key={i} width={52} height={52} borderRadius={26} />
          ))}
        </View>

        {/* Compatibility */}
        <S width={180} height={18} borderRadius={9} style={{ alignSelf: 'center' }} />

        {/* Common interest tag */}
        <S width={130} height={32} borderRadius={16} style={{ alignSelf: 'center' }} />

        {/* Activity suggestions */}
        <View style={{ gap: 10 }}>
          <S width={150} height={15} borderRadius={6} />
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                gap: 8,
              }}
            >
              <S width={cardW * 0.55} height={15} borderRadius={6} />
              <S width={cardW * 0.75} height={12} borderRadius={6} />
              <S width={70} height={12} borderRadius={6} />
            </View>
          ))}
        </View>

        {/* Rendezvous block */}
        <S width={cardW - 40} height={60} borderRadius={14} />

        {/* Vote buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <S width={(cardW - 40 - 12) / 2} height={48} borderRadius={16} />
          <S width={(cardW - 40 - 12) / 2} height={48} borderRadius={16} />
        </View>
      </View>
    </SkeletonContainer>
  );
}

// ── Events (Sorties) ──────────────────────────────────────────────
export function EventsSkeleton({ colors, isDark }) {
  const S = (props) => <SkeletonBox isDark={isDark} {...props} />;
  const cardW = W - Spacing.four * 2;

  return (
    <SkeletonContainer style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header: title + Créer button */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: Spacing.four,
          paddingTop: 72,
          paddingBottom: 8,
        }}
      >
        <View style={{ gap: 6 }}>
          <S width={120} height={34} borderRadius={8} />
          <S width={140} height={14} borderRadius={6} />
        </View>
        <S width={96} height={40} borderRadius={16} />
      </View>

      {/* Filter chips row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.four, gap: 8, marginTop: 8 }}>
        {[88, 76, 96, 104].map((w, i) => (
          <S key={i} width={w} height={34} borderRadius={17} />
        ))}
      </View>

      {/* Category chips row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.four, gap: 8, marginTop: 12 }}
        scrollEnabled={false}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <S key={i} width={92} height={38} borderRadius={19} />
        ))}
      </ScrollView>

      {/* Event cards */}
      <View style={{ paddingHorizontal: Spacing.four, gap: 14, marginTop: 16 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              borderRadius: 22,
              backgroundColor: colors.backgroundElement,
              padding: 16,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <S width={cardW * 0.5} height={18} borderRadius={8} />
              <S width={64} height={26} borderRadius={13} />
            </View>
            <S width={cardW * 0.7} height={13} borderRadius={6} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <S width={14} height={14} borderRadius={7} />
              <S width={cardW * 0.4} height={13} borderRadius={6} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <View style={{ flexDirection: 'row', gap: -8 }}>
                {[0, 1, 2].map((j) => (
                  <S key={j} width={30} height={30} borderRadius={15} style={{ marginLeft: j === 0 ? 0 : -8 }} />
                ))}
              </View>
              <S width={104} height={38} borderRadius={16} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonContainer>
  );
}

// ── User profile ──────────────────────────────────────────────────
const GALLERY_H = Math.round(Dimensions.get('window').height * 0.74);

export function UserProfileSkeleton({ colors, isDark }) {
  const S = (props) => <SkeletonBox isDark={isDark} {...props} />;

  return (
    <SkeletonContainer style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Photo gallery area */}
      <S width={W} height={GALLERY_H} borderRadius={0} />

      {/* Profile info */}
      <View style={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <S width={180} height={28} borderRadius={8} />
          <S width={50} height={20} borderRadius={10} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <S width={14} height={14} borderRadius={7} />
          <S width={120} height={14} borderRadius={6} />
        </View>
        <S width={W - 40} height={14} borderRadius={6} />
        <S width={(W - 40) * 0.7} height={14} borderRadius={6} />

        {/* Interest chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {[80, 100, 70, 95, 110, 75].map((w, i) => (
            <S key={i} width={w} height={32} borderRadius={16} />
          ))}
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <S width={(W - 52) / 2} height={52} borderRadius={20} />
          <S width={(W - 52) / 2} height={52} borderRadius={20} />
        </View>
      </View>
    </SkeletonContainer>
  );
}
