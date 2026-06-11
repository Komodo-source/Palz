import '@/global.css';
import { Platform } from 'react-native';

// ── Palette douce, féminine & cozy ──
export const PALETTE = {
  rose: '#FF8FA3',
  roseLight: '#FFB5C2',
  rosePale: '#FFF0F3',
  lavender: '#E8D5F5',
  lavenderPale: '#F8F4FF',
  cream: '#FFF9F5',
  white: '#FFFFFF',
  textDark: '#4A3728',
  textMid: '#7A6B60',
  textLight: '#B0A098',
  border: '#F0E0E0',
  cardBg: '#FFFFFF',
  success: '#98D8AA',
  error: '#FF6B6B',
  shadow: '#FFB5C2',
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
    accent: '#FF7FA0',         // rose — brighter than light mode to pop on dark bg
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
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
