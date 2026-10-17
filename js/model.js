/*
 * Model – Datenmodell einer RACI-Matrix: Anlegen, Normalisieren (Import, Speicher), Zugriff auf
 * Zellen, Reihenfolge und Nummern der Aufgaben. Exportiert den Namensraum `Model`.
 * Das Format ist in docs/DATENFORMAT.md beschrieben.
 */
import { Util } from './util.js';
import { Variants } from './variants.js';

export const Model = (() => {
  const SCHEMA_VERSION = 1;

  /**
   * Umwandlungen älterer Versionen: `MIGRATIONS[n]` macht aus Version n die Version n + 1.
   * @type {Record<number, (raw: any) => any>}
   */
  const MIGRATIONS = {};

  /** Optionale Bereiche: aus, außer Phasen und „A/R“. @type {MatrixOptions} */
  const DEFAULT_OPTIONS = { phases: true, combined: true, people: false, notes: false, plan: false, external: false };
  /** @type {MatrixRules} */
  const DEFAULT_RULES = { minExec: true, manyConsult: 5, bottleneck: 80, emptyRole: true, verb: true };

  /** @param {unknown} v @param {string} [d] */
  const str = (v, d = '') => (typeof v === 'string' ? v : d);
  /** @param {unknown} v @param {boolean} d */
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  /** @param {unknown} v @param {number} d @param {number} min @param {number} max */
  const int = (v, d, min, max) => (typeof v === 'number' && Number.isFinite(v) ? Util.clamp(Math.round(v), min, max) : d);
  /** @param {unknown} v @returns {any[]} */
  const arr = v => (Array.isArray(v) ? v : []);
  /** @param {unknown} v @returns {Record<string, any>} */
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? /** @type {Record<string, any>} */ (v) : {});

  /** Eindeutige ID (vorhandene behalten, doppelte ersetzen). @param {unknown} id @param {Set<string>} seen @param {string} prefix */
  function uniqueId(id, seen, prefix) {
    let v = typeof id === 'string' && id.trim() ? id.trim() : Util.uid(prefix);
    while (seen.has(v)) v = Util.uid(prefix);
    seen.add(v);
    return v;
  }

  /** Kürzel vereinheitlichen (höchstens drei Zeichen, Großbuchstaben). @param {unknown} k */
  const normKey = k => str(k).trim().toUpperCase().slice(0, 3);

  /** @param {unknown} raw @param {VariantId} variant @returns {Letter[]} */
  function normLetters(raw, variant) {
    /** @type {Set<string>} */
    const seen = new Set();
    /** @type {Letter[]} */
    const list = [];
    for (const x of arr(raw)) {
      const l = obj(x);
      const key = normKey(l.key);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push({
        key,
        kind: Variants.KIND_ORDER.includes(l.kind) ? l.kind : 'other',
        count: Variants.COUNTS.includes(l.count) ? l.count : 'any',
        color: Variants.COLORS.includes(l.color) ? l.color : 'gray',
        name: str(l.name),
        meaning: str(l.meaning),
      });
    }
    return list.length ? list : Variants.letters(variant);
  }

  /** @param {unknown} raw @returns {MatrixOptions} */
  function normOptions(raw) {
    const o = obj(raw);
    const d = DEFAULT_OPTIONS;
    return { phases: bool(o.phases, d.phases), combined: bool(o.combined, d.combined), people: bool(o.people, d.people), notes: bool(o.notes, d.notes), plan: bool(o.plan, d.plan), external: bool(o.external, d.external) };
  }

  /** @param {unknown} raw @returns {MatrixRules} */
  function normRules(raw) {
    const r = obj(raw);
    const d = DEFAULT_RULES;
    return { minExec: bool(r.minExec, d.minExec), manyConsult: int(r.manyConsult, d.manyConsult, 0, 50), bottleneck: int(r.bottleneck, d.bottleneck, 0, 100), emptyRole: bool(r.emptyRole, d.emptyRole), verb: bool(r.verb, d.verb) };
  }

  /**
   * Kürzel einer Zelle ordnen: bekannte nach Bedeutung (A vor R), unbekannte dahinter.
   * @param {Letter[]} letters @param {string[]} keys
   */
  function sortKeys(letters, keys) {
    /** @param {string} k */
    const rank = k => {
      const l = letters.find(x => x.key === k);
      return l ? Variants.KIND_ORDER.indexOf(l.kind) * 100 + letters.indexOf(l) : 10000;
    };
    return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }

  /** @param {unknown} raw @param {Letter[]} letters @returns {string[]} */
  function normKeys(raw, letters) {
    return sortKeys(letters, [...new Set(arr(raw).map(normKey).filter(Boolean))]);
  }

  /** @param {string[]} a @param {string[]} b */
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /** @param {unknown} raw @param {Letter[]} letters @returns {Cell | null} */
  function normCell(raw, letters) {
    const c = obj(raw);
    const v = normKeys(c.v, letters);
    let s = Array.isArray(c.s) ? normKeys(c.s, letters) : null;
    if (s && same(s, v)) s = null;
    const cell = { v, s, q: bool(c.q, false), note: str(c.note) };
    return isEmpty(cell) ? null : cell;
  }

  /** Leere Zelle (wird nicht gespeichert)? @param {Cell} c */
  function isEmpty(c) {
    return !c.v.length && c.s == null && !c.q && !c.note;
  }

  /**
   * Beliebige Eingabe (Import, Speicher) in eine gültige Matrix umwandeln.
   * @param {unknown} input @returns {Matrix}
   */
  function normalize(input) {
    let raw = obj(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Keine Matrix');
    let version = typeof raw.version === 'number' ? raw.version : SCHEMA_VERSION;
    if (version > SCHEMA_VERSION) throw new Error('Neuere Version');
    while (version < SCHEMA_VERSION) {
      const step = MIGRATIONS[version];
      if (!step) throw new Error('Unbekannte Version');
      raw = step(raw);
      version++;
    }
    const variant = Variants.known(raw.variant) ? raw.variant : 'raci';
    const letters = normLetters(raw.letters, variant);

    /** @type {Set<string>} */
    const ids = new Set();
    const phases = arr(raw.phases).map(x => obj(x)).map(p => ({ id: uniqueId(p.id, ids, 'p'), name: str(p.name) }));
    const phaseIds = new Set(phases.map(p => p.id));
    const tasks = arr(raw.tasks).map(x => obj(x)).map(t => ({ id: uniqueId(t.id, ids, 't'), phase: phaseIds.has(t.phase) ? t.phase : '', name: str(t.name), ref: str(t.ref) }));
    const roles = arr(raw.roles).map(x => obj(x)).map(r => ({ id: uniqueId(r.id, ids, 'r'), name: str(r.name), description: str(r.description), person: str(r.person), deputy: str(r.deputy), external: bool(r.external, false) }));

    const rawCells = obj(raw.cells);
    /** @type {Record<string, Record<string, Cell>>} */
    const cells = {};
    for (const t of tasks) {
      const row = obj(rawCells[t.id]);
      for (const r of roles) {
        const c = normCell(row[r.id], letters);
        if (c) (cells[t.id] ||= {})[r.id] = c;
      }
    }
    const stamp = Util.now();
    return {
      version: SCHEMA_VERSION,
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : Util.uid('m'),
      name: str(raw.name),
      context: str(raw.context),
      variant,
      letters,
      options: normOptions(raw.options),
      rules: normRules(raw.rules),
      phases,
      tasks,
      roles,
      cells,
      createdAt: str(raw.createdAt, stamp),
      updatedAt: str(raw.updatedAt, stamp),
    };
  }

  /**
   * Neue, leere Matrix.
   * @param {{ name?: string, context?: string, variant?: VariantId, options?: Partial<MatrixOptions>, rules?: Partial<MatrixRules> }} [init]
   */
  function create(init = {}) {
    const variant = init.variant || 'raci';
    // Bei DACI entscheidet dieselbe Rolle naturgemäß alle Fragen – Engpass-Prüfung zunächst aus
    const rules = init.rules || (variant === 'daci' ? { ...DEFAULT_RULES, bottleneck: 0 } : undefined);
    return normalize({ name: init.name || '', context: init.context || '', variant, letters: Variants.letters(variant), options: init.options, rules, phases: [], tasks: [], roles: [], cells: {} });
  }

  /** Zelle (oder `null`). @param {Matrix} m @param {string} task @param {string} role */
  function cell(m, task, role) {
    return (m.cells[task] && m.cells[task][role]) || null;
  }

  /** Stand, den Ansicht und Prüfung zeigen, wenn nichts anderes gewählt ist. @param {Matrix} m @returns {PlanMode} */
  function mode(m) {
    return m.options.plan ? 'soll' : 'ist';
  }

  /**
   * Buchstaben einer Zelle im gewählten Stand (Soll ohne eigene Angabe = Ist).
   * @param {Matrix} m @param {string} task @param {string} role @param {PlanMode} [md]
   */
  function keys(m, task, role, md = mode(m)) {
    const c = cell(m, task, role);
    if (!c) return [];
    return md === 'soll' && c.s ? c.s : c.v;
  }

  /** Buchstabe zu einem Kürzel. @param {Matrix} m @param {string} key */
  function letter(m, key) {
    return m.letters.find(l => l.key === key);
  }

  /** Kürzel zusammengesetzt („A/R“). @param {string[]} k */
  const label = k => k.join('/');

  /**
   * Aufgaben in Anzeigereihenfolge, bei Phasen gruppiert (Aufgaben ohne Phase zuerst).
   * @param {Matrix} m @returns {{ phase: Phase | null, tasks: Task[] }[]}
   */
  function groups(m) {
    if (!m.options.phases) return [{ phase: null, tasks: m.tasks }];
    const loose = m.tasks.filter(t => !t.phase);
    /** @type {{ phase: Phase | null, tasks: Task[] }[]} */
    const out = loose.length || !m.phases.length ? [{ phase: null, tasks: loose }] : [];
    for (const p of m.phases) out.push({ phase: p, tasks: m.tasks.filter(t => t.phase === p.id) });
    return out;
  }

  /** Aufgaben in Anzeigereihenfolge. @param {Matrix} m */
  function ordered(m) {
    return groups(m).flatMap(g => g.tasks);
  }

  /**
   * Nummern der Aufgaben: „1.3“ mit Phasen (Phase.Aufgabe), sonst fortlaufend.
   * @param {Matrix} m @returns {Record<string, string>}
   */
  function numbers(m) {
    /** @type {Record<string, string>} */
    const out = {};
    if (!m.options.phases) {
      m.tasks.forEach((t, i) => { out[t.id] = String(i + 1); });
      return out;
    }
    for (const g of groups(m)) {
      const p = g.phase ? m.phases.indexOf(g.phase) + 1 : 0;
      g.tasks.forEach((t, i) => { out[t.id] = p ? `${p}.${i + 1}` : String(i + 1); });
    }
    return out;
  }

  return { SCHEMA_VERSION, MIGRATIONS, DEFAULT_OPTIONS, DEFAULT_RULES, normalize, normOptions, normRules, normCell, normKeys, sortKeys, isEmpty, same, create, cell, mode, keys, letter, label, groups, ordered, numbers };
})();
