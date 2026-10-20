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

  /** @typedef {{ id: string, savedAt: number, data: Matrix }} StoredDoc */

  /**
   * Eintrag lesen (normalisiert), `null` wenn nicht vorhanden oder beschädigt. Gespeichert wird
   * `{ savedAt, data }` wie in den anderen Methoden-Apps; ältere Einträge (Matrix direkt) werden
   * ebenso gelesen und beim nächsten Speichern umgestellt.
   * @param {string} id @returns {StoredDoc | null}
   */
  function readDoc(id) {
    const raw = get(PREFIX + id);
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw);
      const wrapped = rec != null && typeof rec === 'object' && 'savedAt' in rec && 'data' in rec;
      const data = Model.normalize(wrapped ? rec.data : rec);
      return { id, savedAt: (wrapped ? Number(rec.savedAt) : Date.parse(data.updatedAt)) || 0, data };
    } catch (e) { return null; }
  }

  /**
   * Beobachter für Schreiben und Löschen von Dokumenten (die Ablage meldet so Änderungen,
   * siehe js/ui/sync.jsx). Ohne Beobachter geschieht nichts.
   * @type {{ written: (id: string) => void, removed: (id: string) => void }}
   */
  let observer = { written: () => {}, removed: () => {} };
  /** @param {{ written: (id: string) => void, removed: (id: string) => void }} o */
  function observe(o) { observer = o; }

  /** @param {string} id @param {Matrix} data @param {number} [savedAt] z. B. beim Übernehmen aus einer Ablage @returns {boolean} */
  function writeDoc(id, data, savedAt = Date.now()) {
    const ok = set(PREFIX + id, JSON.stringify({ savedAt, data }));
    if (ok) observer.written(id);
    return ok;
  }

  /** @param {string} id */
  function removeDoc(id) {
    remove(PREFIX + id);
    observer.removed(id);
  }

  /** ID einer Matrix zu einem Speicherschlüssel (z. B. aus einem `storage`-Ereignis), sonst `null`. @param {string | null} key */
  function docIdFromKey(key) {
    return key && key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
  }

  /** Alle gespeicherten Einträge, zuletzt gespeicherte zuerst. @returns {StoredDoc[]} */
  function listDocs() {
    return keys().filter(k => k.startsWith(PREFIX))
      .map(k => readDoc(k.slice(PREFIX.length)))
      .filter(/** @returns {d is StoredDoc} */ d => d != null)
      .sort((x, y) => y.savedAt - x.savedAt);
  }

  /** Matrix laden, `null` wenn nicht vorhanden oder beschädigt. @param {string} id @returns {Matrix | null} */
  function load(id) {
    return readDoc(id)?.data ?? null;
  }

  /** Matrix speichern. @param {Matrix} m @returns {boolean} */
  function save(m) {
    return writeDoc(m.id, m);
  }

  /** Alle gespeicherten Matrizen, zuletzt bearbeitete zuerst. @returns {Matrix[]} */
  function all() {
    return listDocs().map(d => d.data).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
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

  return { PREFIX, DEFAULTS_KEY, readDoc, writeDoc, removeDoc, docIdFromKey, listDocs, observe, load, save, all, defaults, saveDefaults };
})();
