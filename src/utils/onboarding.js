/**
 * The onboarding flow always writes the compatibility answers into `users.interests`
 * as its final save step (after the photo/face verification step has passed).
 * So a non-empty `interests` object is the signal that onboarding was completed.
 */
export function hasCompletedOnboarding(user) {
  if (!user) return false;

  let interests = user.interests;
  if (typeof interests === 'string') {
    try {
      interests = JSON.parse(interests);
    } catch {
      return false;
    }
  }

  return (
    !!interests &&
    typeof interests === 'object' &&
    !Array.isArray(interests) &&
    Object.keys(interests).length > 0
  );
}
