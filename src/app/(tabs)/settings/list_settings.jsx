import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth';
import { getColors, Spacing, PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getStorageUrl, swipesApi } from '@/services/api';
import { parseDbJson } from '@/utils/parsers';
import { usersApi } from '@/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_W = (SCREEN_WIDTH - 48 - 8) / 3;


export default function ListSettings() {
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);


  useEffect(() => {

  }, []);

  const shareApp = async () => {
    try {
      const result = await Share.share({
        message:
          '',//share url website link
      });
      /*
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }*/
    } catch (error) {
      Alert.alert(error.message);
    }
  };


  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >

      <TouchableOpacity>
        <Text>Visuel</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text>Paramètre de confidentialité</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text>Stats Premium</Text>
      </TouchableOpacity>

      <TouchableOpacity
      onPress={() => {shareApp}}>
        <Text>Partager l'app</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text>Nous noter</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({

});
