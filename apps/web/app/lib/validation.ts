// Mirrors apps/api/src/auth/password-rules.ts. There is no shared package
// between web and api, so the rule is duplicated here intentionally — keep
// the constants identical to the server. If the API rule changes, this
// MUST change too, otherwise the frontend will accept passwords the server
// rejects (or vice-versa) and users will see "Password must contain..."
// 400s after their client-side check passed.
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const PASSWORD_RULE_MESSAGE =
  "Password must contain at least one uppercase letter, one number, and one special character";

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordStrength(
  password: string
): "weak" | "medium" | "strong" {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (password.length > PASSWORD_MAX_LENGTH)
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  if (!PASSWORD_PATTERN.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}
