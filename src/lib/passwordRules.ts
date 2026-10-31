export interface PasswordCheck { key: 'length' | 'letter' | 'number' | 'symbol' | 'email' | 'match'; ok: boolean }

export const PASSWORD_MIN = 12;

/** Mirrors App\Support\PasswordRules on the server (the server remains the authority). */
export function checkPassword(password: string, confirmation: string, email?: string | null): PasswordCheck[] {
  const local = (email ?? '').split('@')[0].toLowerCase();
  return [
    { key: 'length', ok: password.length >= PASSWORD_MIN },
    { key: 'letter', ok: /\p{L}/u.test(password) },
    { key: 'number', ok: /\p{N}/u.test(password) },
    { key: 'symbol', ok: /[^\p{L}\p{N}\s]/u.test(password) },
    { key: 'email', ok: local.length < 4 || !password.toLowerCase().includes(local) },
    { key: 'match', ok: password.length > 0 && password === confirmation },
  ];
}

export const passwordAcceptable = (checks: PasswordCheck[]) => checks.every((c) => c.ok);
