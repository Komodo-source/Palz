import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getColors, Spacing } from '@/constants/theme';
import { usersApi } from '@/services/api';
import {
  COMPATIBILITY_QUESTIONS,
  getDefaultAnswers,
} from '@/utils/compatibility';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_DOT_SIZE = 36;
const SLIDER_GAP = 6;
const TOTAL_STEPS = COMPATIBILITY_QUESTIONS.length;

// ── Label pairs for each slider value ──
const VALUE_LABELS = {
  social_energy: {
    1: 'I cherish my quiet time',
    2: 'Small doses of people',
    3: 'Socializing is tiring',
    4: 'Sometimes fun, often draining',
    5: 'Depends on the day',
    6: 'I enjoy hanging out',
    7: 'People give me energy',
    8: 'I love a good party',
    9: 'Hardly ever tired of people',
    10: 'Let’s never stop!',
  },
  planning_style: {
    1: 'I plan everything',
    2: 'Routines feel safe',
    3: 'I like knowing ahead',
    4: 'Planned is best',
    5: 'I go with the flow',
    6: 'Spontaneity is fun',
    7: 'Last minute works',
    8: 'I thrive on surprises',
    9: 'Plans? What plans?',
    10: 'Fully winging it!',
  },
  conversation_depth: {
    1: 'Small talk is nice',
    2: 'Keeps things easy',
    3: 'I prefer light chats',
    4: 'Casual is comfortable',
    5: 'Both have their place',
    6: 'I like getting real',
    7: 'Meaningful talks shine',
    8: 'Deep convos energize me',
    9: 'I crave depth',
    10: 'Let’s talk universe!',
  },
};

// ── Dot component ──
function SliderDot({ value, selected, onPress, color, isFirst, isLast }) {
  const isSelected = value <= selected;
  const dotSize = isSelected ? SLIDER_DOT_SIZE : SLIDER_DOT_SIZE - 4;

  return (
    <TouchableOpacity
      onPress={() => onPress(value)}
      activeOpacity={0.6}
      style={[
        styles.dot,
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: isSelected ? '#FF6B8A' : color,
          borderWidth: isSelected ? 0 : 1.5,
          borderColor: isSelected ? 'transparent' : 'rgba(255,107,138,0.25)',
          transform: [{ scale: isSelected ? 1 : 0.85 }],
        },
      ]}
    >
      <Text
        style={[
          styles.dotText,
          {
            color: isSelected ? '#fff' : 'rgba(255,107,138,0.5)',
            fontSize: isSelected ? 12 : 10,
          },
        ]}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}

// ── Question Card ──
function QuestionCard({ question, value, onValueChange, colors, animatedStyle }) {
  const labels = VALUE_LABELS[question.id] || {};

  return (    <RNAnimated.View style={[styles.cardWrapper, animatedStyle]}>
      <View style={styles.cardContent}>
        {/* Question icon */}
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,107,138,0.1)' }]}>
          <Ionicons name={question.icon} size={36} color="#FF6B8A" />
        </View>

        {/* Title */}
        <Text style={[styles.questionTitle, { color: colors.text }]}>
          {question.title}
        </Text>

        {/* Question */}
        <Text style={[styles.questionText, { color: colors.textSecondary }]}>
          {question.question}
        </Text>

        {/* Slider */}
        <View style={styles.sliderSection}>
          {/* Labels */}
          <View style={styles.sliderLabels}>
            <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
              {question.lowLabel}
            </Text>
            <Text style={[styles.sliderLabel, styles.sliderLabelRight, { color: colors.textSecondary }]}>
              {question.highLabel}
            </Text>
          </View>

          {/* Dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
              <SliderDot
                key={num}
                value={num}
                selected={value}
                onPress={onValueChange}
                color={colors.backgroundElement}
                isFirst={num === 1}
                isLast={num === 10}
              />
            ))}
          </View>

          {/* Selected value label */}
          <View style={styles.selectedValueSection}>
            <Text style={[styles.selectedValueNumber, { color: '#FF6B8A' }]}>
              {value}
            </Text>
            <Text style={[styles.selectedValueLabel, { color: colors.text }]}>
              {labels[value] || ''}
            </Text>
          </View>
        </View>
      </View>
    </RNAnimated.View>
  );
}

// ── Main Screen ──
export default function OnboardingScreen() {
  const { user, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(getDefaultAnswers());
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Animation values for each card — only the first card is visible initially
  const slideAnims = useRef(
    COMPATIBILITY_QUESTIONS.map((_, i) =>
      new RNAnimated.Value(i === 0 ? 0 : SCREEN_WIDTH * 0.5)
    )
  ).current;

  // Fade/progress animations
  const progressAnim = useRef(new RNAnimated.Value(0)).current;
  const resultOpacity = useRef(new RNAnimated.Value(0)).current;

  const animateToStep = useCallback(
    (toStep) => {
      const direction = toStep > step ? 1 : -1;

      // Slide out current
      RNAnimated.timing(slideAnims[step], {
        toValue: -direction * SCREEN_WIDTH * 0.3,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        // Reset positions — hide non-target cards offscreen
        slideAnims.forEach((anim, i) => {
          if (i === toStep) anim.setValue(direction * SCREEN_WIDTH * 0.3);
          else anim.setValue(direction * SCREEN_WIDTH * 0.5);
        });

        // Slide in new
        RNAnimated.timing(slideAnims[toStep], {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Update progress
        RNAnimated.timing(progressAnim, {
          toValue: (toStep / TOTAL_STEPS) * 100,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });

      setStep(toStep);
    },
    [step, slideAnims, progressAnim]
  );

  const handleValueChange = useCallback(
    (questionIndex, newValue) => {
      setAnswers((prev) => ({
        ...prev,
        [COMPATIBILITY_QUESTIONS[questionIndex].id]: newValue,
      }));
    },
    []
  );

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1);
    } else {
      handleFinish();
    }
  }, [step, animateToStep]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      animateToStep(step - 1);
    }
  }, [step, animateToStep]);

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Save to backend
      await usersApi.updateProfile({ interests: answers });

      // Refresh user data in auth context
      await refreshUser();

      // Show result briefly
      setShowResult(true);
      RNAnimated.timing(resultOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Auto-redirect after a moment
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (err) {
      console.error('Save questionnaire error:', err);
      // Even if save fails, let user through
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  // ── Result overlay ──
  if (showResult) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <RNAnimated.View style={[styles.resultContainer, { opacity: resultOpacity }]}>
          <View style={styles.resultContent}>
            <View style={[styles.resultCircle, { backgroundColor: 'rgba(255,107,138,0.1)' }]}>
              <Ionicons name="sparkles" size={48} color="#FF6B8A" />
            </View>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              You're all set!
            </Text>
            <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
              Your friendship style has been saved.
            </Text>
            <View style={[styles.resultScoreCard, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.resultScoreLabel, { color: colors.textSecondary }]}>
                Social Energy
              </Text>
              <Text style={[styles.resultScoreValue, { color: '#FF6B8A' }]}>
                {answers.social_energy}/10
              </Text>
              <View style={[styles.resultDivider, { backgroundColor: colors.backgroundSelected }]} />
              <Text style={[styles.resultScoreLabel, { color: colors.textSecondary }]}>
                Planning Style
              </Text>
              <Text style={[styles.resultScoreValue, { color: '#FF6B8A' }]}>
                {answers.planning_style}/10
              </Text>
              <View style={[styles.resultDivider, { backgroundColor: colors.backgroundSelected }]} />
              <Text style={[styles.resultScoreLabel, { color: colors.textSecondary }]}>
                Conversation Depth
              </Text>
              <Text style={[styles.resultScoreValue, { color: '#FF6B8A' }]}>
                {answers.conversation_depth}/10
              </Text>
            </View>
            <Text style={[styles.resultTagline, { color: colors.textSecondary }]}>
              Finding your people…
            </Text>
          </View>
        </RNAnimated.View>
      </View>
    );
  }

  // ── Loading state while saving ──
  if (saving) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF6B8A" />
        <Text style={[styles.savingText, { color: colors.textSecondary }]}>
          Saving your answers…
        </Text>
      </View>
    );
  }

  // ── Main questionnaire ──
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={step > 0 ? handleBack : handleSkip}
          activeOpacity={0.7}
          style={styles.topBarButton}
        >
          <Text style={[styles.topBarButtonText, { color: colors.textSecondary }]}>
            {step > 0 ? '← Back' : 'Skip'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.stepCounter, { color: colors.textSecondary }]}>
          {step + 1} / {TOTAL_STEPS}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBg, { backgroundColor: colors.backgroundSelected }]}>
        <RNAnimated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Question cards */}
      <View style={styles.cardsContainer}>
        {COMPATIBILITY_QUESTIONS.map((q, index) => (
          <QuestionCard
            key={q.id}
            question={q}
            value={answers[q.id]}
            onValueChange={(v) => handleValueChange(index, v)}
            colors={colors}
            animatedStyle={{
              opacity: slideAnims[index].interpolate({
                inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
                outputRange: [0, 1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateX: slideAnims[index].interpolate({
                    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
                    outputRange: [-60, 0, 60],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          />
        ))}
      </View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Step dots */}
        <View style={styles.dotsContainer}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dotIndicator,
                {
                  backgroundColor: i === step ? '#FF6B8A' : colors.backgroundSelected,
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Next / Done button */}
        <TouchableOpacity
          style={[styles.nextButton, { opacity: saving ? 0.6 : 1 }]}
          onPress={handleNext}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step < TOTAL_STEPS - 1 ? 'Next' : 'Done'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  topBarButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.half,
  },
  topBarButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Progress
  progressBg: {
    height: 4,
    marginHorizontal: Spacing.four,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B8A',
    borderRadius: 2,
  },

  // Cards
  cardsContainer: {
    flex: 1,
    position: 'relative',
  },
  cardWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  cardContent: {
    alignItems: 'center',
    gap: Spacing.three,
  },

  // Emoji circle
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },

  // Question text
  questionTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  questionText: {
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.four,
  },

  // Slider
  sliderSection: {
    width: '100%',
    paddingHorizontal: Spacing.two,
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 100,
  },
  sliderLabelRight: {
    textAlign: 'right',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SLIDER_GAP,
    flexWrap: 'wrap',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontWeight: '700',
  },

  // Selected value
  selectedValueSection: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  selectedValueNumber: {
    fontSize: 36,
    fontWeight: '800',
  },
  selectedValueLabel: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Bottom section
  bottomSection: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Platform.OS === 'ios' ? Spacing.six : Spacing.four,
    gap: Spacing.four,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  dotIndicator: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF6B8A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Saving
  savingText: {
    fontSize: 16,
    marginTop: Spacing.three,
    fontWeight: '500',
  },

  // Result overlay
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  resultContent: {
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
  },
  resultCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  resultSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultScoreCard: {
    width: '100%',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  resultScoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultScoreValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  resultDivider: {
    height: 1,
    marginVertical: Spacing.half,
  },
  resultTagline: {
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: Spacing.one,
  },
});
