import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const IMAGES = [
  'https://images.pexels.com/photos/1267708/pexels-photo-1267708.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/28320375/pexels-photo-28320375.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3937468/pexels-photo-3937468.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/36019348/pexels-photo-36019348.jpeg?auto=compress&cs=tinysrgb&w=800',
];

const DISPLAY_DURATION = 4000;
const FADE_DURATION = 1800;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();

  const [bottomImage, setBottomImage] = useState(0);
  const [topImage, setTopImage] = useState(1);
  const topOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const indices = { bottom: 0, top: 1 };
    let timeout;

    const doTransition = () => {
      Animated.timing(topOpacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;

        const newBottom = indices.top;
        const newTop = (indices.top + 1) % IMAGES.length;

        topOpacity.setValue(0);
        indices.bottom = newBottom;
        indices.top = newTop;

        setBottomImage(newBottom);
        setTopImage(newTop);

        timeout = setTimeout(doTransition, DISPLAY_DURATION);
      });
    };

    timeout = setTimeout(doTransition, DISPLAY_DURATION);

    return () => {
      clearTimeout(timeout);
      topOpacity.stopAnimation();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Background crossfade carousel */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: IMAGES[bottomImage] }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: topOpacity }]}>
          <Image
            source={{ uri: IMAGES[topImage] }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </Animated.View>
      </View>

      {/* Strong gradient at the bottom for text legibility */}
      <View style={styles.bottomGradient} />

      {/* UI layer */}
      <View style={[styles.content, {
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 32,
      }]}>

        {/* Logo */}
        <View style={styles.topBar}>
          <View style={styles.logoPill}>
            <Text style={styles.logoText}>Copines</Text>
          </View>
        </View>

        {/* Headline */}
        <View style={styles.heroArea}>
          <Text style={styles.headline}>Trouvez vos{'\n'}prochaines copines</Text>
          <Text style={styles.tagline}>
            Des rencontres authentiques,{'\n'}des liens durables ✨
          </Text>
        </View>

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {IMAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === bottomImage && styles.dotActive]} />
          ))}
        </View>

        {/* CTA buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Créer un compte</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>J'ai déjà un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#180810',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.56,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,143,163,0.88)',
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroArea: {
    alignItems: 'center',
  },
  headline: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 50,
    letterSpacing: -1,
  },
  tagline: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 24,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF8FA3',
  },
  buttons: {
    gap: 14,
  },
  primaryBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#FF8FA3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
