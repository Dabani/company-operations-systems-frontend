import { describe, expect, it } from 'vitest';
import { checkPassword, passwordAcceptable } from './passwordRules';

const ok = (pw: string, conf = pw, email = 'jane.doe@example.com') => passwordAcceptable(checkPassword(pw, conf, email));

describe('checkPassword', () => {
  it('accepts a strong password', () => { expect(ok('Str0ng-Passw0rd!x')).toBe(true); });
  it('rejects short, missing number/symbol, mismatch', () => {
    expect(ok('Sh0rt!')).toBe(false);
    expect(ok('NoNumbersHere!!!!')).toBe(false);
    expect(ok('NoSymbols12345678')).toBe(false);
    expect(ok('Str0ng-Passw0rd!x', 'different')).toBe(false);
  });
  it('rejects a password containing the e-mail name (4+ chars), ignores short names', () => {
    expect(ok('xx-jane.doe-123456!')).toBe(false);
    expect(ok('Str0ng-Passw0rd!x', undefined, 'ab@example.com')).toBe(true);
  });
  it('supports non-latin letters', () => { expect(ok('Ijambobanga-ry\'ingenzi-9!')).toBe(true); });
});
