/*
 * Variants – die Buchstabensätze: RACI, RASCI, RACI-VS, DACI und eigene Buchstaben. Eine
 * Matrix kopiert die Buchstaben ihrer Variante (mit Namen in der Sprache der App) und trägt sie
 * danach selbst; Prüfungen und Farben richten sich nach der Bedeutung (`kind`) eines Buchstabens,
 * nicht nach seinem Kürzel. Exportiert den Namensraum `Variants`.
 */
import { Texts } from './texts.js';

/** @typedef {{ key: string, kind: LetterKind, count: CountRule, color: LetterColor }} LetterDef */

export const Variants = (() => {
  /** @type {readonly VariantId[]} */
  const ORDER = ['raci', 'rasci', 'raci-vs', 'daci', 'custom'];

  /** @type {Record<string, LetterDef>} */
  const L = {
    R: { key: 'R', kind: 'exec', count: 'min1', color: 'teal' },
    A: { key: 'A', kind: 'owner', count: 'one', color: 'indigo' },
    C: { key: 'C', kind: 'consult', count: 'any', color: 'orange' },
    I: { key: 'I', kind: 'inform', count: 'any', color: 'gray' },
  };

  /** Buchstaben je Variante (eigene beginnen mit RACI). @type {Record<string, LetterDef[]>} */
  const DEFS = {
    raci: [L.R, L.A, L.C, L.I],
    rasci: [L.R, L.A, { key: 'S', kind: 'support', count: 'any', color: 'cyan' }, L.C, L.I],
    'raci-vs': [L.R, L.A, L.C, L.I, { key: 'V', kind: 'verify', count: 'any', color: 'violet' }, { key: 'S', kind: 'signoff', count: 'max1', color: 'pink' }],
    daci: [{ key: 'D', kind: 'driver', count: 'one', color: 'teal' }, { key: 'A', kind: 'owner', count: 'one', color: 'indigo' }, L.C, L.I],
  };
  DEFS.custom = DEFS.raci;

  /** Reihenfolge der Buchstaben in einer Zelle („A/R“, nicht „R/A“). @type {readonly LetterKind[]} */
  const KIND_ORDER = ['owner', 'driver', 'exec', 'support', 'consult', 'verify', 'signoff', 'inform', 'other'];
  /** @type {readonly CountRule[]} */
  const COUNTS = ['one', 'min1', 'max1', 'any'];
  /** @type {readonly LetterColor[]} */
  const COLORS = ['indigo', 'teal', 'cyan', 'orange', 'violet', 'blue', 'pink', 'gray'];

  /** Ist das eine bekannte Variante? @param {unknown} id @returns {id is VariantId} */
  function known(id) {
    return typeof id === 'string' && /** @type {readonly string[]} */ (ORDER).includes(id);
  }

  /** Texte einer Variante in der Sprache der App. @param {VariantId} id */
  function texts(id) {
    return Texts.variants[id];
  }

  /**
   * Buchstaben einer Variante mit Namen und Bedeutung (eigene: wie RACI).
   * @param {VariantId} id @returns {Letter[]}
   */
  function letters(id) {
    const t = /** @type {Record<string, { name: string, meaning: string }>} */ (texts(id === 'custom' ? 'raci' : id).letters);
    return DEFS[id].map(d => ({ ...d, name: t[d.key].name, meaning: t[d.key].meaning }));
  }

  /**
   * Passende Variante zu einer Menge von Kürzeln (z. B. beim CSV-Import).
   * @param {Iterable<string>} keys @returns {VariantId}
   */
  function guess(keys) {
    const set = new Set(keys);
    if (set.has('D')) return 'daci';
    if (set.has('V')) return 'raci-vs';
    if (set.has('S')) return 'rasci';
    return [...set].every(k => 'RACI'.includes(k)) ? 'raci' : 'custom';
  }

  return { ORDER, DEFS, KIND_ORDER, COUNTS, COLORS, known, texts, letters, guess };
})();
