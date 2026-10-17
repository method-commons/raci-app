/*
 * Store – Speicherung im Browser (localStorage). Jede Matrix liegt unter einem eigenen
 * Schlüssel; dazu der Standard für neue Matrizen (optionale Bereiche, Prüfregeln).
 * Exportiert den Namensraum `Store`.
 */
import { Model } from './model.js';

export const Store = (() => {
  const PREFIX = 'raci:matrix:';
  const DEFAULTS_KEY = 'raci:defaults';

  // Web Storage kann fehlen oder gesperrt sein (z. B. privates Fenster) – dann leere Werte.
  /** @param {string} key @returns {string | null} */
  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  /** @param {string} key @param {string} value */
  function set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  /** @param {string} key */
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignorieren */ }
  }
  /** @returns {string[]} */
  function keys() {
    try { return Object.keys(localStorage); } catch (e) { return []; }
  }

  /** Matrix laden (normalisiert), `null` wenn nicht vorhanden oder beschädigt. @param {string} id @returns {Matrix | null} */
  function load(id) {
    const raw = get(PREFIX + id);
    if (!raw) return null;
    try { return Model.normalize(JSON.parse(raw)); } catch (e) { return null; }
  }

  /** Matrix speichern. @param {Matrix} m @returns {boolean} */
  function save(m) {
    return set(PREFIX + m.id, JSON.stringify(m));
  }

  /** @param {string} id */
  function removeMatrix(id) {
    remove(PREFIX + id);
  }

  /** Alle gespeicherten Matrizen, zuletzt bearbeitete zuerst. @returns {Matrix[]} */
  function all() {
    return keys().filter(k => k.startsWith(PREFIX))
      .map(k => load(k.slice(PREFIX.length)))
      .filter(/** @returns {m is Matrix} */ m => m != null)
      .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  }

  /** Ist der Speicherschlüssel der einer Matrix? Liefert die ID. @param {string | null} key */
  function matrixIdOfKey(key) {
    return key && key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
  }

  /** Standard für neue Matrizen (optionale Bereiche und Prüfregeln) oder `null`. @returns {{ options: MatrixOptions, rules: MatrixRules } | null} */
  function defaults() {
    try {
      const raw = JSON.parse(get(DEFAULTS_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      return { options: Model.normOptions(raw.options), rules: Model.normRules(raw.rules) };
    } catch (e) { return null; }
  }

  /** Standard für neue Matrizen speichern. @param {{ options: MatrixOptions, rules: MatrixRules }} d */
  function saveDefaults(d) {
    return set(DEFAULTS_KEY, JSON.stringify({ options: d.options, rules: d.rules }));
  }

  return { PREFIX, DEFAULTS_KEY, load, save, removeMatrix, all, matrixIdOfKey, defaults, saveDefaults };
})();
