export type PasswordRule = {
  key: string;
  label: string;
  test: (password: string) => boolean;
};

// Matches Supabase Auth's own default minimum (6 chars) as a floor, but
// enforces real complexity on top of it - the previous check was just
// `password.length < 6`, which let "111111" through.
export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function validatePassword(password: string): { valid: boolean; failedRule: string | null } {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return { valid: !failed, failedRule: failed ? failed.label : null };
}
