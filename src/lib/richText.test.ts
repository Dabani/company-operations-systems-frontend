import { describe, expect, it } from 'vitest';
import { isHtml, plainText, toEditorHtml } from './richText';

describe('rich text helpers', () => {
  it('detects html and plain text', () => {
    expect(isHtml('<p>Hello</p>')).toBe(true);
    expect(isHtml('a < b and c > d')).toBe(false);
    expect(isHtml('')).toBe(false);
  });
  it('gives the plain text length used by validation', () => {
    expect(plainText('<p>Forgot to <strong>clock</strong> in</p>')).toBe('Forgot to clock in');
    expect(plainText('<p>ab</p>').length).toBe(2);          // not 9: the tags do not count
    expect(plainText('<ul><li>one</li><li>two</li></ul>')).toBe('one two');
    expect(plainText('Tom &amp; Jerry <i>x</i>')).toBe('Tom & Jerry x');
  });
  it('keeps the line breaks of older plain-text values', () => {
    expect(toEditorHtml('line 1\nline 2\n\nnext a < b & c')).toBe('<p>line 1<br>line 2</p><p>next a &lt; b &amp; c</p>');
    expect(toEditorHtml('<p>already</p>')).toBe('<p>already</p>');
  });
});
