/**
 * Questionnaire de Compatibilité
 *
 * Mesure la compatibilité amicale sur 3 dimensions :
 * - social_energy : introverti ↔ extraverti
 * - planning_style : planifié ↔ spontané
 * - conversation_depth : léger ↔ profond
 *
 * Les scores vont de 0 à 100. Plus la différence entre deux
 * utilisateurs est petite, plus leur compatibilité est élevée.
 */

const QUESTION_KEYS = ['social_energy', 'planning_style', 'conversation_depth'];
const MAX_DIFF_PER_QUESTION = 9;
const MAX_TOTAL_DIFF = MAX_DIFF_PER_QUESTION * QUESTION_KEYS.length;

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

export function getCompatibilityLabel(score) {
  if (score >= 85) return 'Âmes sœurs';
  if (score >= 65) return 'Super match';
  if (score >= 45) return 'Ça peut le faire';
  return 'Pas tout à fait';
}

export function getCompatibilityDescription(score) {
  if (score >= 85) return 'Vous vous comprenez parfaitement !';
  if (score >= 65) return 'De très bonnes vibes entre vous.';
  if (score >= 45) return 'Quelques différences, mais à explorer.';
  return 'Personnalités assez différentes.';
}

export const COMPATIBILITY_QUESTIONS = [
  {
    id: 'social_energy',
    title: 'Énergie Sociale',
    question: 'Comment tu te recharges ?',
    lowLabel: 'Besoin de temps seul(e)',
    highLabel: 'Pourrais sociabiliser toute la journée !',
    icon: 'battery-charging',
  },
  {
    id: 'planning_style',
    title: 'Style de Planification',
    question: 'Faire des plans me fait me sentir…',
    lowLabel: 'Planifié(e) & prêt(e)',
    highLabel: 'Spontané(e) & libre',
    icon: 'calendar-outline',
  },
  {
    id: 'conversation_depth',
    title: 'Style de Conversation',
    question: 'J\'adore les conversations…',
    lowLabel: 'Légères & insouciantes',
    highLabel: 'Profondes & pleines de sens',
    icon: 'chatbubbles-outline',
  },
];

export function getDefaultAnswers() {
  return {
    social_energy: 5,
    planning_style: 5,
    conversation_depth: 5,
  };
}
