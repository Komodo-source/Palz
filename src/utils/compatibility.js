/**
 * Compatibility Questionnaire Scoring Utility
 *
 * Measures friendship compatibility across 3 dimensions:
 * - social_energy: introvert ↔ extrovert
 * - planning_style: planner ↔ spontaneous
 * - conversation_depth: casual ↔ deep
 *
 * Scores range from 0–100. The smaller the difference between two
 * users' answers, the higher their compatibility score.
 *
 * This is used to:
 * - Reduce incompatible friendship matches
 * - Compare social energy and communication styles
 * - Avoid matching users with extreme personality differences
 */

const QUESTION_KEYS = ['social_energy', 'planning_style', 'conversation_depth'];
const MAX_DIFF_PER_QUESTION = 9; // 10 − 1
const MAX_TOTAL_DIFF = MAX_DIFF_PER_QUESTION * QUESTION_KEYS.length; // 27

/**
 * Calculate compatibility score between two users (0–100).
 * @param {Object} answersA - First user's answers: { social_energy, planning_style, conversation_depth }
 * @param {Object} answersB - Second user's answers: { social_energy, planning_style, conversation_depth }
 * @returns {number} Compatibility percentage (0–100)
 */
export function calculateCompatibility(answersA, answersB) {
  if (!answersA || !answersB) return 50;

  let totalDiff = 0;

  for (const key of QUESTION_KEYS) {
    const a = typeof answersA[key] === 'number' ? answersA[key] : 5;
    const b = typeof answersB[key] === 'number' ? answersB[key] : 5;
    totalDiff += Math.abs(a - b);
  }

  const raw = Math.round(100 - (totalDiff / MAX_TOTAL_DIFF) * 100);
  return Math.max(0, Math.min(100, raw));
}

/**
 * Get a friendly label for a compatibility score.
 * @param {number} score - Compatibility score (0–100)
 * @returns {string} Label text
 */
export function getCompatibilityLabel(score) {
  if (score >= 85) return 'Soul Friends';
  if (score >= 65) return 'Great Match';
  if (score >= 45) return 'Could Work';
  return 'Not Quite';
}

/**
 * Get a description for a compatibility score.
 * @param {number} score - Compatibility score (0–100)
 * @returns {string} Short explanation
 */
export function getCompatibilityDescription(score) {
  if (score >= 85) return 'You two just get each other!';
  if (score >= 65) return 'Really good vibes between you.';
  if (score >= 45) return 'Some differences, but worth exploring.';
  return 'Pretty different personalities.';
}

/**
 * Questions configuration used in the onboarding form.
 * `icon` refers to an Ionicons name from @expo/vector-icons.
 */
export const COMPATIBILITY_QUESTIONS = [
  {
    id: 'social_energy',
    title: 'Your Social Battery',
    question: 'How do you recharge?',
    lowLabel: 'Need lots of\nalone time',
    highLabel: 'Could socialize\nall day!',
    icon: 'battery-charging',
  },
  {
    id: 'planning_style',
    title: 'Planning Style',
    question: 'Making plans makes me feel…',
    lowLabel: 'Planned &\nprepared',
    highLabel: 'Spontaneous\n& free',
    icon: 'calendar-outline',
  },
  {
    id: 'conversation_depth',
    title: 'Conversation Vibe',
    question: 'I love conversations\nthat are…',
    lowLabel: 'Light &\nbreezy',
    highLabel: 'Deep &\nmeaningful',
    icon: 'chatbubbles-outline',
  },
];

/**
 * Get the default (midpoint) answers object.
 */
export function getDefaultAnswers() {
  return {
    social_energy: 5,
    planning_style: 5,
    conversation_depth: 5,
  };
}
