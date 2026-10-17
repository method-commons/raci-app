/*
 * Examples – mitgelieferte Beispiel-Matrizen. Jede Datei unter examples/ heißt
 * `<name>.<sprache>.json` (z. B. `stadtfest.de.json`) und enthält eine Matrix im
 * Exportformat; sie wird automatisch eingelesen. Fehlt ein Beispiel in der Sprache der App,
 * erscheint die deutsche Fassung. Exportiert den Namensraum `Examples`.
 */
import { Languages } from './texts.js';
import { Model } from './model.js';
import { Util } from './util.js';

/** @type {Record<string, { default: any }>} */
const files = import.meta.glob('../examples/*.json', { eager: true });

export const Examples = (() => {
  /** Beispiele je Name und Sprache. @type {Record<string, Record<string, any>>} */
  const raw = {};
  for (const [path, mod] of Object.entries(files)) {
    const m = path.match(/([^/]+)\.([a-z]{2})\.json$/);
    if (!m) continue;
    (raw[m[1]] ||= {})[m[2]] = mod.default;
  }

  /** Rohdaten eines Beispiels in der Sprache (sonst Deutsch bzw. die erste vorhandene). @param {string} key @param {string} lang */
  function pick(key, lang) {
    const byLang = raw[key];
    return byLang[lang] || byLang.de || Object.values(byLang)[0];
  }

  /**
   * Beispiele in der Sprache der App (normalisiert, sortiert nach Name).
   * @param {string} [lang] @returns {{ key: string, matrix: Matrix }[]}
   */
  function list(lang = Languages.detect()) {
    return Object.keys(raw)
      .map(key => ({ key, matrix: Model.normalize(pick(key, lang)) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Beispiel als neue Matrix (neue ID, aktuelle Zeitstempel).
   * @param {string} key @param {string} [lang] @returns {Matrix | null}
   */
  function load(key, lang = Languages.detect()) {
    if (!raw[key]) return null;
    const m = Model.normalize(pick(key, lang));
    const stamp = Util.now();
    m.id = Util.uid('m');
    m.createdAt = stamp;
    m.updatedAt = stamp;
    return m;
  }

  return { list, load, raw };
})();
