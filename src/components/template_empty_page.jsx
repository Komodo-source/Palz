import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';


const PALETTE = {
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
};

export default function LoginScreen() {

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({

});
