// Shared regex for basic email format validation
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns true if the string looks like a valid email address. */
export const isValidEmail = (email) => EMAIL_REGEX.test(email);
