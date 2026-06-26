import '@/global.css';
import { Platform } from 'react-native';

// ── Palette douce, féminine & cozy ──
export const PALETTE = {
  rose: '#C4325E',
  roseLight: '#E07A95',
  rosePale: '#FFF0F3',
  lavender: '#E8D5F5',
  lavenderPale: '#F8F4FF',
  cream: '#FFFFFF',
  white: '#FFFFFF',
  textDark: '#222222',
  textMid: '#717171',
  textLight: '#9A9A9A',
  border: '#EBEBEB',
  cardBg: '#FFFFFF',
  success: '#98D8AA',
  error: '#FF6B6B',
  shadow: '#E07A95',
};

export const Colors = {
  light: {
    text: PALETTE.textDark,
    background: PALETTE.cream,
    backgroundElement: PALETTE.white,
    backgroundSelected: PALETTE.rosePale,
    textSecondary: PALETTE.textMid,
    accent: PALETTE.rose,
    accentLight: PALETTE.roseLight,
    cardBg: PALETTE.white,
    border: PALETTE.border,
    shadowColor: PALETTE.shadow,
  },
  dark: {
    text: '#EDE8F8',           // cool white with soft purple tint
    background: '#0F0B1A',     // deep purple-black — night sky
    backgroundElement: '#1B1230',  // card / surface
    backgroundSelected: '#271A48', // pressed / selected
    textSecondary: '#9182B4',  // muted purple-grey
    accent: '#E0517A',         // rose — brighter than light mode to pop on dark bg
    accentLight: '#2C1C46',    // deep plum tint for subtle accents
    cardBg: '#1B1230',
    border: '#271A3E',
    shadowColor: '#050210',    // near black-purple for shadows
  },
};

/** Safely get the color palette for a given color scheme. Falls back to 'light'. */
export function getColors(colorScheme) {
  return colorScheme === 'dark' ? Colors.dark : Colors.light;
}

export const Fonts = Platform.select({
  ios: {
    sans: 'Poppins_400Regular',
    serif: 'ui-serif',
    rounded: 'Poppins_400Regular',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Poppins_400Regular',
    serif: 'serif',
    rounded: 'Poppins_400Regular',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

// ── Border-radius scale ──────────────────────────────────────────
// Use these instead of hard-coded borderRadius values across the app.
export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

// ── Shadow presets ───────────────────────────────────────────────
// Pass directly to a style: style={[Shadow.card, { ... }]}. These respect
// iOS shadow + Android elevation and use a neutral dark shadow on light
// mode / pure black on dark so elevation stays consistent.
export const Shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  // Brand-tinted glow used in a few hero spots (primary CTA, success state).
  glow: {
    shadowColor: PALETTE.rose,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ── Typography scale ──────────────────────────────────────────────
// Use for consistent type hierarchy beyond ThemedText variants.
// size / lineHeight pairs keep vertical rhythm predictable.
export const Typography = {
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  body:    { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bodyLg:  { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  h3:      { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  h2:      { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  h1:      { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  display: { fontSize: 44, lineHeight: 48, fontWeight: '800' },
};

// ── Motion tokens ─────────────────────────────────────────────────
// Standard durations + easing curves so animations feel coherent.
// Reuse these in place of magic numbers like 350, 400, etc.
export const Motion = {
  duration: {
    instant: 120,
    fast: 200,
    normal: 350,
    slow: 500,
  },
  easing: {
    // Material-style cubic-bezier(0.2, 0, 0, 1)
    standard: { duration: 350 },
    // Soft entrance with slight overshoot
    emphasized: { duration: 400, easing: undefined },
  },
  spring: {
    gentle: { damping: 22, stiffness: 180, mass: 1 },
    bouncy: { damping: 14, stiffness: 220, mass: 0.9 },
    stiff: { damping: 28, stiffness: 360, mass: 1 },
  },
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// ── Status semantics ──────────────────────────────────────────────
// Used by snackbar / banner / chip color picks so status copy reads the
// same color everywhere.
export const StatusColors = {
  success: PALETTE.success,
  error: PALETTE.error,
  warning: '#F59E0B',
  info: PALETTE.rose,
  neutral: PALETTE.textMid,
};
