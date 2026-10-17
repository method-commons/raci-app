import { describe, expect, it } from 'vitest';
import { TextsDe } from '../../js/i18n/de.js';
import { TextsEn } from '../../js/i18n/en.js';
import { Languages, Texts } from '../../js/texts.js';

/** Struktur (Schlüssel und Arten) eines Textobjekts; Listen nur mit ihrer Art. */
function shape(v) {
  if (Array.isArray(v)) return `array:${v.length ? (typeof v[0] === 'object' ? JSON.stringify(shape(v[0])) : typeof v[0]) : 'empty'}`;
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, shape(v[k])]));
  return typeof v;
}
/** Platzhalter je Text. */
function placeholders(v, path = '', out = {}) {
  if (typeof v === 'string') out[path] = [...v.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  else if (Array.isArray(v)) v.forEach((x, i) => placeholders(x, `${path}[${i > 0 ? 'n' : 0}]`, out));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) placeholders(v[k], `${path}.${k}`, out);
  return out;
}

describe('Sprachdateien', () => {
  it('haben dieselbe Struktur', () => {
    expect(shape(TextsEn)).toEqual(shape(TextsDe));
  });

  it('haben dieselben Platzhalter', () => {
    expect(placeholders(TextsEn)).toEqual(placeholders(TextsDe));
  });

  it('erkennen Tätigkeiten je Sprache', () => {
    expect(new RegExp(TextsDe.checks.verbPattern, 'u').test('Kasse abrechnen')).toBe(true);
    expect(new RegExp(TextsDe.checks.verbPattern, 'u').test('Kasse')).toBe(false);
    expect(new RegExp(TextsEn.checks.verbPattern, 'u').test('Cash up')).toBe(true);
    expect(new RegExp(TextsEn.checks.verbPattern, 'u').test('Till')).toBe(false);
  });

  it('wählen Deutsch in den Tests', () => {
    expect(Languages.detect()).toBe('de');
    expect(Texts).toBe(TextsDe);
    Languages.choose('en');
  });
});
