/** Pragmatic email check aligned with common backend EmailStr shapes. */
export function isValidEmailAddress(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export const PASSWORD_MIN_LENGTH = 8;

/** Returns null if OK, otherwise a short user-facing message. */
export function validateAuthPassword(password: string): string | null {
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return null;
}
