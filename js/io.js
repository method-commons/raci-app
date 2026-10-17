/*
 * IO – Import und Export: Matrix als JSON, Sicherung aller Matrizen, Matrix als CSV
 * (Tabellenkalkulation, auch zum Einlesen), Bericht als Markdown. Exportiert den Namensraum `IO`.
 */
import { Checks } from './checks.js';
import { Model } from './model.js';
import { Texts } from './texts.js';
import { Util } from './util.js';
import { Variants } from './variants.js';

export const IO = (() => {
  const BACKUP_TYPE = 'raci-backup';

  /** Matrix als JSON-Text. @param {Matrix} m */
  function matrixJson(m) {
    return JSON.stringify(m, null, 2) + '\n';
  }

  /** Sicherung mehrerer Matrizen als JSON-Text. @param {Matrix[]} list @param {Date} [date] */
  function backupJson(list, date = new Date()) {
    return JSON.stringify({ type: BACKUP_TYPE, version: Model.SCHEMA_VERSION, exportedAt: date.toISOString(), matrices: list }, null, 2) + '\n';
  }

  /**
   * Datei lesen: JSON (Matrix, Sicherung oder Liste) oder CSV (eine Matrix).
   * @param {string} text @param {string} [fileName] @returns {Matrix[]}
   */
  function parse(text, fileName = '') {
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    if (!trimmed) throw new Error(Texts.io.empty);
    if (!/^[[{]/.test(trimmed)) return [parseCsv(trimmed, fileName)];
    let raw;
    try { raw = JSON.parse(trimmed); } catch (e) { throw new Error(Texts.io.invalid, { cause: e }); }
    const list = Array.isArray(raw) ? raw : raw && raw.type === BACKUP_TYPE && Array.isArray(raw.matrices) ? raw.matrices : [raw];
    if (!list.length) throw new Error(Texts.io.empty);
    return list.map((/** @type {unknown} */ r) => {
      try { return Model.normalize(r); } catch (e) { throw new Error(Texts.io.invalid, { cause: e }); }
    });
  }

  /** Inhalt ohne Zeitstempel (zum Vergleich). @param {Matrix} m */
  const content = m => JSON.stringify({ ...m, updatedAt: '' });

  /**
   * Wie wird eine importierte Matrix übernommen? Neu, schon vorhanden (identisch) oder – bei
   * abweichendem Stand – als Kopie mit neuer ID (nichts wird überschrieben).
   * @param {Matrix} m @param {Matrix | null} existing
   * @returns {{ action: 'new' | 'same' | 'copy', matrix: Matrix }}
   */
  function resolveImport(m, existing) {
    if (!existing) return { action: 'new', matrix: m };
    if (content(existing) === content(m)) return { action: 'same', matrix: existing };
    return { action: 'copy', matrix: { ...m, id: Util.uid('m'), name: `${m.name} ${Texts.io.copySuffix}` } };
  }

  // ===== CSV =====
  /** Trennzeichen der Sprache: Semikolon bei Komma als Dezimalzeichen. */
  const sepOf = () => ((1.5).toLocaleString(Texts.locale).includes(',') ? ';' : ',');

  /** CSV-Feld maskieren. @param {string} s @param {string} sep */
  const csvCell = (s, sep) => (/[\n"]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s);

  /**
   * Matrix als CSV: Nummer, Phase, Aufgabe, je Rolle eine Spalte mit den Buchstaben („A/R“),
   * Prüfung.
   * @param {Matrix} m @param {PlanMode} [md]
   */
  function csv(m, md = Model.mode(m)) {
    const C = Texts.csv;
    const sep = sepOf();
    const phase = /** @param {string} id */ id => { const p = m.phases.find(x => x.id === id); return p ? p.name : ''; };
    const no = Model.numbers(m);
    const head = [C.no, C.phase, C.task, ...m.roles.map(r => r.name || Texts.ui.untitledRole), C.check];
    const rows = Model.ordered(m).map(t => [no[t.id], m.options.phases ? phase(t.phase) : '', t.name, ...m.roles.map(r => Model.label(Model.keys(m, t.id, r.id, md))), Checks.status(m, t, md).text]);
    return [head, ...rows].map(row => row.map(s => csvCell(s, sep)).join(sep)).join('\r\n') + '\r\n';
  }

  /** CSV-Text in Zeilen und Felder zerlegen (Anführungszeichen, Zeilenumbrüche in Feldern). @param {string} text @param {string} sep */
  function splitCsv(text, sep) {
    /** @type {string[][]} */
    const rows = [];
    /** @type {string[]} */
    let row = [];
    let f = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; }
        else if (ch === '"') quoted = false;
        else f += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(f); rows.push(row); row = []; f = '';
      } else f += ch;
    }
    row.push(f);
    rows.push(row);
    return rows.filter(r => r.some(x => x.trim()));
  }

  /**
   * CSV einlesen: Kopfzeile mit „Aufgabe“ (bzw. „Task“), optional „Nr.“, „Phase“ und „Prüfung“;
   * alle übrigen Spalten sind Rollen, die Zellen enthalten Buchstaben („A/R“, „C“).
   * @param {string} text @param {string} [fileName] @returns {Matrix}
   */
  function parseCsv(text, fileName = '') {
    const first = text.split(/\r?\n/)[0];
    const sep = [';', '\t', ','].map(s => ({ s, n: first.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
    const rows = splitCsv(text, sep);
    if (rows.length < 2 || rows[0].length < 2) throw new Error(Texts.io.invalid);
    const head = rows[0].map(h => Util.fold(h.trim()));
    /** @param {'no' | 'phase' | 'task' | 'check'} key */
    const col = key => head.findIndex(h => Object.values(Texts.csvHeaders[key]).some(x => Util.fold(x) === h));
    const taskCol = col('task') >= 0 ? col('task') : 0;
    const skip = new Set([col('no'), col('phase'), col('check'), taskCol]);
    const roleCols = head.map((h, i) => i).filter(i => !skip.has(i));
    const phaseCol = col('phase');
    const m = Model.create({ name: fileName.replace(/\.[^.]+$/, '') || Texts.io.csvName });
    const roles = roleCols.map(i => ({ id: Util.uid('r'), name: rows[0][i].trim(), description: '', person: '', deputy: '', external: false }));
    /** @type {Record<string, string>} */
    const phases = {};
    /** @type {Set<string>} */
    const keys = new Set();
    for (const row of rows.slice(1)) {
      const name = (row[taskCol] || '').trim();
      if (!name) continue;
      const pn = phaseCol >= 0 ? (row[phaseCol] || '').trim() : '';
      if (pn && !phases[pn]) { phases[pn] = Util.uid('p'); m.phases.push({ id: phases[pn], name: pn }); }
      const t = { id: Util.uid('t'), phase: pn ? phases[pn] : '', name, ref: '' };
      m.tasks.push(t);
      roleCols.forEach((i, j) => {
        const k = (row[i] || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
        k.forEach(x => keys.add(x));
        if (k.length) (m.cells[t.id] ||= {})[roles[j].id] = { v: k, s: null, q: false, note: '' };
      });
    }
    m.roles = roles;
    m.variant = Variants.guess(keys);
    m.letters = Variants.letters(m.variant);
    m.options.phases = m.phases.length > 0;
    return Model.normalize(m);
  }

  // ===== Markdown =====
  /** Markdown-Zeichen in Text maskieren. @param {string} s */
  const md = s => String(s).replace(/([\\`*_[\]#|<>])/g, '\\$1');
  /** Tabellenzelle: Zeilenumbrüche entfernen. @param {string} s */
  const cell = s => md(String(s).replace(/\s*\n\s*/g, ' ').trim()) || '–';

  /**
   * Bericht als Markdown: Legende, Matrix (mit Phasen), Prüfung, Rollen, offene Punkte und –
   * bei Ist/Soll – die Änderungen.
   * @param {Matrix} m @param {{ today?: string, mode?: PlanMode }} [opts]
   */
  function markdown(m, opts = {}) {
    const T = Texts;
    const R = T.report;
    const mode = opts.mode || Model.mode(m);
    const no = Model.numbers(m);
    const lines = [`# ${md(m.name || T.ui.untitledMatrix)}`, ''];
    const meta = [Variants.texts(m.variant).name, m.context.trim(), m.options.plan ? R.modes[mode] : '', `${R.asOf} ${Util.formatDay(opts.today || Util.today(), T.locale, 0)}`].filter(Boolean);
    lines.push(md(meta.join(' · ')), '');
    lines.push(m.letters.map(l => `**${md(l.key)}** ${md(l.name)}${l.meaning ? ` – ${md(l.meaning)}` : ''}`).join(' · '), '');

    const roleHead = m.roles.map(r => cell(r.name || T.ui.untitledRole) + (m.options.people && r.person.trim() ? ` (${cell(r.person)})` : ''));
    lines.push(`| ${R.no} | ${R.task} | ${roleHead.join(' | ')} | ${R.check} |`, `|---|---|${m.roles.map(() => ':-:|').join('')}---|`);
    for (const g of Model.groups(m)) {
      if (g.phase) lines.push(`| | **${cell(g.phase.name || T.ui.untitledPhase)}** |${m.roles.map(() => ' |').join('')} |`);
      for (const t of g.tasks) {
        const cells = m.roles.map(r => Model.label(Model.keys(m, t.id, r.id, mode)) || ' ');
        lines.push(`| ${no[t.id]} | ${cell(t.name || T.ui.untitledTask)}${t.ref.trim() ? ` ↗ ${cell(t.ref)}` : ''} | ${cells.join(' | ')} | ${Checks.status(m, t, mode).text} |`);
      }
    }
    lines.push('');

    const s = Checks.summary(m, mode);
    const open = Checks.hints(m, mode).filter(h => h.state !== 'ok');
    lines.push(`## ${Util.fill(R.checkTitle, { clear: s.clear, n: s.tasks })}`, '');
    if (open.length) open.forEach(h => lines.push(`- **${md(h.title)}:** ${md(h.detail)}`));
    else lines.push(R.allOk);
    lines.push('');

    lines.push(`## ${R.roles}`, '');
    for (const r of m.roles) {
      const st = Checks.roleStats(m, r, mode);
      const counts = m.letters.map(l => `${st.counts[l.key] || 0}× ${l.key}`).join(', ');
      const who = m.options.people ? [r.person.trim(), r.deputy.trim() ? `${R.deputy} ${r.deputy.trim()}` : ''].filter(Boolean).join(', ') : '';
      const ext = m.options.external && r.external ? ` (${T.roles.external})` : '';
      lines.push(`- **${md(r.name || T.ui.untitledRole)}**${ext}${who ? ` – ${md(who)}` : ''}: ${Util.fill(R.involved, { n: st.involved, total: m.tasks.length })} · ${counts}`);
    }
    lines.push('');

    const notes = [];
    for (const t of Model.ordered(m)) {
      for (const r of m.roles) {
        const c = Model.cell(m, t.id, r.id);
        if (!c || !m.options.notes || (!c.q && !c.note.trim())) continue;
        notes.push(`- **${no[t.id]} · ${md(r.name || T.ui.untitledRole)}**${c.q ? ` (${R.question})` : ''}${c.note.trim() ? `: ${md(c.note.trim().replace(/\s*\n\s*/g, ' '))}` : ''}`);
      }
    }
    if (notes.length) lines.push(`## ${R.open}`, '', ...notes, '');

    const diff = m.options.plan ? Checks.diff(m) : [];
    if (diff.length) {
      lines.push(`## ${R.changes}`, '');
      const role = /** @param {string} id */ id => { const r = m.roles.find(x => x.id === id); return r ? r.name || T.ui.untitledRole : ''; };
      diff.forEach(d => lines.push(`- ${no[d.task]} · ${md(role(d.role))}: ${Model.label(d.from) || '–'} → ${Model.label(d.to) || '–'}`));
      lines.push('');
    }
    return lines.join('\n');
  }

  return { BACKUP_TYPE, matrixJson, backupJson, parse, parseCsv, splitCsv, resolveImport, csv, markdown };
})();
