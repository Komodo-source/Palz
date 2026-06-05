/**
 * Safely convert a value to a string for rendering as a React child.
 * Returns the fallback for objects, null, and undefined.
 * @param {any} val
 * @param {string} fallback
 * @returns {string}
 */
export function safeStr(val, fallback = '') {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

/**
 * Parse a database JSON text field into its native value.
 * PostgreSQL returns JSON columns as strings, so we need to parse them.
 *
 * @param {any} raw - The raw value from the database
 * @returns {any} - The parsed value, or the raw value if it's not a JSON string
 */
export function parseDbJson(raw) {
  if (!raw) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Get profile image URLs as an array from a user object.
 * @param {object} user - The user object from the API
 * @returns {string[]} - Array of image URLs (empty if none)
 */
export function getProfileImages(user) {
  if (!user?.profile_image) return [];
  const parsed = parseDbJson(user.profile_image);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Get the first profile image URL from a user object.
 * @param {object} user - The user object from the API
 * @returns {string|null} - First image URL or null
 */
export function getFirstProfileImage(user) {
  const images = getProfileImages(user);
  return images.length > 0 ? images[0] : null;
}

/**
 * Parse user interests into sports and hobbies arrays.
 * @param {object} user - The user object from the API
 * @returns {{ sports: string[], hobbies: string[] }}
 */
export function parseUserInterests(user) {
  const raw = user?.interests;
  if (!raw) return { sports: [], hobbies: [] };
  const parsed = parseDbJson(raw);
  return {
    sports: Array.isArray(parsed.sports) ? parsed.sports : [],
    hobbies: Array.isArray(parsed.hobbies) ? parsed.hobbies : [],
  };
}
