import { cloneElement } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

// Poppins variants to preload via `useFonts`.
export const PoppinsFonts = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

// Map a React Native `fontWeight` to the matching Poppins variant.
// Custom fonts don't auto-resolve weights on Android, so we pick the file explicitly.
function poppinsForWeight(weight) {
  switch (String(weight)) {
    case '500':
      return 'Poppins_500Medium';
    case '600':
      return 'Poppins_600SemiBold';
    case '700':
    case '800':
    case '900':
    case 'bold':
      return 'Poppins_700Bold';
    default:
      return 'Poppins_400Regular';
  }
}

// Patch the default render of <Text> / <TextInput> so every text node uses
// Poppins by default, while respecting an explicitly provided fontFamily.
let patched = false;
export function applyDefaultFont() {
  if (patched) return;
  patched = true;

  [Text, TextInput].forEach((Component) => {
    const original = Component.render;
    Component.render = function render(...args) {
      const element = original.apply(this, args);
      const flattened = StyleSheet.flatten(element.props.style) || {};
      // Don't override a font the caller chose deliberately (e.g. the mono code style).
      const fontFamily = flattened.fontFamily ?? poppinsForWeight(flattened.fontWeight);
      return cloneWithFont(element, fontFamily);
    };
  });
}

function cloneWithFont(element, fontFamily) {
  return cloneElement(element, {
    style: [{ fontFamily }, element.props.style],
  });
}
