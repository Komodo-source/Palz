import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';

/**
 * Catches render crashes (e.g. "Objects are not valid as a React child"),
 * logs the exact component stack that produced the bad value, and shows a
 * recoverable fallback instead of killing the whole app.
 *
 * Look for "[RENDER CRASH]" in the logs — the component stack names the
 * precise component that rendered the invalid value.
 */
export default class RenderErrorBoundary extends React.Component {
  state = { error: null, stackTop: '', prevName: this.props.name };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // Auto-recover: when the route (name) changes, clear any held error so the
  // next screen renders instead of staying stuck on the fallback.
  static getDerivedStateFromProps(props, state) {
    if (props.name !== state.prevName) {
      return { prevName: props.name, error: null, stackTop: '' };
    }
    return null;
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[RENDER CRASH] in "${this.props.name || 'screen'}":`, error?.message);
    if (errorInfo?.componentStack) {
      console.error('[RENDER CRASH] component stack:', errorInfo.componentStack);
      // Keep the innermost frames so the fallback screen names the culprit
      const top = String(errorInfo.componentStack)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 5)
        .join('\n');
      this.setState({ stackTop: top });
    }
  }

  handleBack = () => {
    this.setState({ error: null, stackTop: '' });
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/wall');
    } catch {}
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.emoji}>🍒</Text>
          <Text style={styles.title}>Oups, un souci d&apos;affichage</Text>
          <Text style={styles.sub} numberOfLines={4}>
            {String(this.state.error?.message || 'Erreur inconnue')}
          </Text>
          {this.state.stackTop ? (
            <Text style={styles.stack} numberOfLines={6}>
              {this.state.stackTop}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.btn} onPress={this.handleBack} activeOpacity={0.8}>
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '800', color: '#222222', textAlign: 'center' },
  sub: { fontSize: 13, color: '#717171', textAlign: 'center', lineHeight: 19 },
  stack: {
    fontSize: 10,
    color: '#9A9A9A',
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#C4325E',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
