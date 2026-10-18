/*
 * Ops – Änderungen an einer Matrix: Phasen, Aufgaben, Rollen, Zellen, Ist/Soll, Variante und
 * Buchstaben, Einstellungen, Vorschläge, Vorlagen und Aufgabenlisten, Duplizieren.
 * Alle Funktionen ändern die übergebene Matrix direkt (Verlauf und Speichern: js/ui/core.js).
 * Exportiert den Namensraum `Ops`.
 */
import { Model } from './model.js';
import { Util } from './util.js';
import { Variants } from './variants.js';

export const Ops = (() => {
  /** Bearbeitungszeit setzen. @param {Matrix} m */
  function touch(m) {
    m.updatedAt = Util.now();
  }

  /** Element in einer Liste um eine Stelle verschieben. @template {{ id: string }} T @param {T[]} list @param {string} id @param {-1 | 1} dir */
  function shift(list, id, dir) {
    const i = list.findIndex(x => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    return true;
  }

  // ===== Phasen =====
  /** @param {Matrix} m @param {string} [name] @returns {Phase} */
  function addPhase(m, name = '') {
    const p = { id: Util.uid('p'), name };
    m.phases.push(p);
    return p;
  }

  /** Phase entfernen; ihre Aufgaben bleiben (ohne Phase). @param {Matrix} m @param {string} id */
  function removePhase(m, id) {
    m.phases = m.phases.filter(p => p.id !== id);
    for (const t of m.tasks) if (t.phase === id) t.phase = '';
  }

  /** @param {Matrix} m @param {string} id @param {-1 | 1} dir */
  function movePhase(m, id, dir) {
    return shift(m.phases, id, dir);
  }

  // ===== Aufgaben =====
  /**
   * Aufgabe anlegen (am Ende ihrer Phase).
   * @param {Matrix} m @param {{ name?: string, phase?: string, ref?: string }} [init] @returns {Task}
   */
  function addTask(m, init = {}) {
    const phase = init.phase && m.phases.some(p => p.id === init.phase) ? init.phase : '';
    const t = { id: Util.uid('t'), phase, name: init.name || '', ref: init.ref || '' };
    m.tasks.push(t);
    return t;
  }

  /** @param {Matrix} m @param {string} id */
  function task(m, id) {
    return m.tasks.find(t => t.id === id);
  }

  /** Aufgabe ändern (Name, Phase, Verweis). @param {Matrix} m @param {string} id @param {Partial<Omit<Task, 'id'>>} patch */
  function updateTask(m, id, patch) {
    const t = task(m, id);
    if (!t) return;
    if (patch.name != null) t.name = patch.name;
    if (patch.ref != null) t.ref = patch.ref;
    if (patch.phase != null && (patch.phase === '' || m.phases.some(p => p.id === patch.phase))) {
      if (t.phase !== patch.phase) {
        // ans Ende der neuen Phase
        m.tasks = [...m.tasks.filter(x => x !== t), t];
        t.phase = patch.phase;
      }
    }
  }

  /** Aufgabe mit ihren Zellen entfernen. @param {Matrix} m @param {string} id */
  function removeTask(m, id) {
    m.tasks = m.tasks.filter(t => t.id !== id);
    delete m.cells[id];
  }

  /**
   * Aufgabe innerhalb ihrer Gruppe (Phase) nach oben bzw. unten verschieben.
   * @param {Matrix} m @param {string} id @param {-1 | 1} dir
   */
  function moveTask(m, id, dir) {
    const t = task(m, id);
    if (!t) return false;
    const group = m.options.phases ? m.tasks.filter(x => x.phase === t.phase) : m.tasks;
    const other = group[group.indexOf(t) + dir];
    if (!other) return false;
    const i = m.tasks.indexOf(t);
    const j = m.tasks.indexOf(other);
    [m.tasks[i], m.tasks[j]] = [m.tasks[j], m.tasks[i]];
    return true;
  }

  // ===== Rollen =====
  /** @param {Matrix} m @param {Partial<Omit<Role, 'id'>>} [init] @returns {Role} */
  function addRole(m, init = {}) {
    const r = { id: Util.uid('r'), name: init.name || '', description: init.description || '', person: init.person || '', deputy: init.deputy || '', external: !!init.external };
    m.roles.push(r);
    return r;
  }

  /** Rolle mit ihren Zellen entfernen. @param {Matrix} m @param {string} id */
  function removeRole(m, id) {
    m.roles = m.roles.filter(r => r.id !== id);
    for (const row of Object.keys(m.cells)) {
      delete m.cells[row][id];
      if (!Object.keys(m.cells[row]).length) delete m.cells[row];
    }
  }

  /** @param {Matrix} m @param {string} id @param {-1 | 1} dir */
  function moveRole(m, id, dir) {
    return shift(m.roles, id, dir);
  }

  /** Rollen einer anderen Matrix übernehmen (gleichnamige werden übersprungen). @param {Matrix} m @param {Matrix} from */
  function copyRoles(m, from) {
    const names = new Set(m.roles.map(r => Util.fold(r.name.trim())));
    let n = 0;
    for (const r of from.roles) {
      if (names.has(Util.fold(r.name.trim()))) continue;
      addRole(m, { ...r });
      n++;
    }
    return n;
  }

  // ===== Zellen =====
  /** Zelle holen oder anlegen. @param {Matrix} m @param {string} t @param {string} r @returns {Cell} */
  function ensure(m, t, r) {
    const row = (m.cells[t] ||= {});
    return (row[r] ||= { v: [], s: null, q: false, note: '' });
  }

  /** Leere Zelle (und leere Zeile) entfernen. @param {Matrix} m @param {string} t @param {string} r */
  function tidy(m, t, r) {
    const c = Model.cell(m, t, r);
    if (c && c.s && Model.same(c.s, c.v)) c.s = null;
    if (c && Model.isEmpty(c)) delete m.cells[t][r];
    if (m.cells[t] && !Object.keys(m.cells[t]).length) delete m.cells[t];
  }

  /**
   * Buchstaben einer Zelle setzen – im Ist oder im Soll.
   * @param {Matrix} m @param {string} t @param {string} r @param {string[]} keys @param {PlanMode} [md]
   */
  function setKeys(m, t, r, keys, md = Model.mode(m)) {
    if (!task(m, t) || !m.roles.some(x => x.id === r)) return;
    const c = ensure(m, t, r);
    const k = Model.sortKeys(m.letters, [...new Set(keys)]);
    if (md === 'soll') c.s = k;
    else {
      // Ein Soll ohne Abweichung bleibt beim Ändern des Ists „wie Ist“
      if (c.s == null && m.options.plan) c.s = c.v;
      c.v = k;
    }
    tidy(m, t, r);
  }

  /** Dürfen diese Kürzel zusammen in einer Zelle stehen (A/R)? @param {Matrix} m @param {string[]} keys */
  function canCombine(m, keys) {
    if (!m.options.combined || keys.length !== 2) return false;
    const kinds = keys.map(k => { const l = Model.letter(m, k); return l ? l.kind : 'other'; }).sort().join();
    return kinds === 'exec,owner';
  }

  /**
   * Taste bzw. Klick auf einen Buchstaben: vorhandenen entfernen, zu „A/R“ ergänzen oder ersetzen.
   * @param {Matrix} m @param {string} t @param {string} r @param {string} key @param {PlanMode} [md]
   */
  function press(m, t, r, key, md = Model.mode(m)) {
    const cur = Model.keys(m, t, r, md);
    let next;
    if (cur.includes(key)) next = cur.filter(k => k !== key);
    else if (cur.length === 1 && canCombine(m, [cur[0], key])) next = [cur[0], key];
    else next = [key];
    setKeys(m, t, r, next, md);
  }

  /** „Klären“ setzen. @param {Matrix} m @param {string} t @param {string} r @param {boolean} q */
  function setQuestion(m, t, r, q) {
    if (!task(m, t) || !m.roles.some(x => x.id === r)) return;
    ensure(m, t, r).q = q;
    tidy(m, t, r);
  }

  /** Notiz setzen. @param {Matrix} m @param {string} t @param {string} r @param {string} note */
  function setNote(m, t, r, note) {
    if (!task(m, t) || !m.roles.some(x => x.id === r)) return;
    ensure(m, t, r).note = note;
    tidy(m, t, r);
  }

  /** Soll als neuen Ist-Stand übernehmen. @param {Matrix} m */
  function applyPlan(m) {
    let n = 0;
    for (const row of Object.keys(m.cells)) {
      for (const r of Object.keys(m.cells[row])) {
        const c = m.cells[row][r];
        if (!c.s) continue;
        c.v = c.s;
        c.s = null;
        n++;
        tidy(m, row, r);
      }
    }
    return n;
  }

  /** Vorschlag anwenden. @param {Matrix} m @param {Suggestion} s @param {PlanMode} [md] */
  function applySuggestion(m, s, md) {
    setKeys(m, s.task, s.role, s.to, md);
    if (s.other) setKeys(m, s.task, s.other.role, s.other.to, md);
  }

  /**
   * Kürzel aller Zellen (Ist und Soll) umwandeln, danach ordnen und leere Zellen entfernen.
   * @param {Matrix} m @param {(keys: string[]) => string[]} conv
   */
  function mapKeys(m, conv) {
    for (const row of Object.keys(m.cells)) {
      for (const r of Object.keys(m.cells[row])) {
        const c = m.cells[row][r];
        /** @param {string[]} k */
        const apply = k => Model.sortKeys(m.letters, [...new Set(conv(k))]);
        c.v = apply(c.v);
        if (c.s) c.s = apply(c.s);
        tidy(m, row, r);
      }
    }
  }

  /** Kürzel in allen Zellen umbenennen bzw. entfernen (`to` = null). @param {Matrix} m @param {string} from @param {string | null} to */
  function renameKey(m, from, to) {
    mapKeys(m, k => k.flatMap(x => (x === from ? (to ? [to] : []) : [x])));
  }

  /** Kürzel aller Zellen neu ordnen (nach geänderter Bedeutung oder Variante). @param {Matrix} m */
  function resortCells(m) {
    mapKeys(m, k => k);
  }

  // ===== Variante und Buchstaben =====
  /**
   * Variante wechseln: Buchstaben der Vorlage übernehmen (eigene: aktuelle behalten).
   * Zellen bleiben; unbekannte Kürzel werden angemerkt.
   * @param {Matrix} m @param {VariantId} id
   */
  function setVariant(m, id) {
    m.variant = id;
    if (id !== 'custom') m.letters = Variants.letters(id);
    resortCells(m);
  }

  /** Eigenen Buchstaben ergänzen. @param {Matrix} m @returns {Letter} */
  function addLetter(m) {
    const used = new Set(m.letters.map(l => l.key));
    const key = [...'OXEPNBTUWYZGHKLMFJQ'].find(k => !used.has(k)) || Util.uid('').slice(0, 3).toUpperCase();
    /** @type {Letter} */
    const l = { key, kind: 'other', count: 'any', color: 'blue', name: '', meaning: '' };
    m.letters.push(l);
    m.variant = 'custom';
    return l;
  }

  /**
   * Buchstaben ändern; ein neues Kürzel wird in allen Zellen übernommen, eine neue Bedeutung
   * (`kind`) ordnet die Buchstaben in den Zellen neu („A/R“).
   * @param {Matrix} m @param {string} key @param {Partial<Letter>} patch
   * @returns {boolean} false, wenn das neue Kürzel leer oder schon vergeben ist
   */
  function updateLetter(m, key, patch) {
    const l = Model.letter(m, key);
    if (!l) return false;
    if (patch.key != null) {
      const k = patch.key.trim().toUpperCase().slice(0, 3);
      if (!k || (k !== key && Model.letter(m, k))) return false;
      l.key = k;
      if (k !== key) renameKey(m, key, k);
    }
    if (patch.name != null) l.name = patch.name;
    if (patch.meaning != null) l.meaning = patch.meaning;
    if (patch.count && Variants.COUNTS.includes(patch.count)) l.count = patch.count;
    if (patch.color && Variants.COLORS.includes(patch.color)) l.color = patch.color;
    if (patch.kind && Variants.KIND_ORDER.includes(patch.kind) && patch.kind !== l.kind) {
      l.kind = patch.kind;
      resortCells(m);
    }
    m.variant = 'custom';
    return true;
  }

  /** Buchstaben entfernen (auch aus allen Zellen). @param {Matrix} m @param {string} key */
  function removeLetter(m, key) {
    if (m.letters.length <= 1) return;
    m.letters = m.letters.filter(l => l.key !== key);
    renameKey(m, key, null);
    m.variant = 'custom';
  }

  // ===== Einstellungen =====
  /** @template {keyof MatrixOptions} K @param {Matrix} m @param {K} key @param {MatrixOptions[K]} value */
  function setOption(m, key, value) {
    m.options[key] = value;
  }

  /** @template {keyof MatrixRules} K @param {Matrix} m @param {K} key @param {MatrixRules[K]} value */
  function setRule(m, key, value) {
    m.rules = Model.normRules({ ...m.rules, [key]: value });
  }

  // ===== Vorlagen, Listen, Duplizieren =====
  /**
   * Aufgaben aus einer Liste: eine Aufgabe je Zeile, „# Name“ beginnt eine Phase.
   * @param {Matrix} m @param {string} text @returns {number} Zahl der Aufgaben
   */
  function addTaskList(m, text) {
    let phase = '';
    let n = 0;
    for (const line of text.split(/\r?\n/)) {
      const s = line.replace(/^\s*[-*•]\s*/, '').trim();
      if (!s) continue;
      if (s.startsWith('#')) {
        phase = addPhase(m, s.replace(/^#+\s*/, '')).id;
        m.options.phases = true;
        continue;
      }
      addTask(m, { name: s, phase });
      n++;
    }
    return n;
  }

  /**
   * Vorlage anwenden: Phasen mit Aufgaben und Rollen.
   * @param {Matrix} m @param {{ phases: { name: string, tasks: string[] }[], roles: string[] }} tpl
   */
  function applyTemplate(m, tpl) {
    for (const p of tpl.phases) {
      const ph = addPhase(m, p.name);
      for (const name of p.tasks) addTask(m, { name, phase: ph.id });
    }
    for (const name of tpl.roles) addRole(m, { name });
    m.options.phases = true;
  }

  /**
   * Kopie mit neuen IDs (Matrix, Phasen, Aufgaben, Rollen).
   * @param {Matrix} m @param {string} suffix @returns {Matrix}
   */
  function duplicate(m, suffix) {
    const copy = /** @type {Matrix} */ (JSON.parse(JSON.stringify(m)));
    /** @type {Record<string, string>} */
    const map = {};
    for (const p of copy.phases) { map[p.id] = Util.uid('p'); p.id = map[p.id]; }
    for (const t of copy.tasks) { map[t.id] = Util.uid('t'); t.id = map[t.id]; if (t.phase) t.phase = map[t.phase]; }
    for (const r of copy.roles) { map[r.id] = Util.uid('r'); r.id = map[r.id]; }
    /** @type {Record<string, Record<string, Cell>>} */
    const cells = {};
    for (const [t, row] of Object.entries(copy.cells)) {
      cells[map[t]] = {};
      for (const [r, c] of Object.entries(row)) cells[map[t]][map[r]] = c;
    }
    copy.cells = cells;
    const stamp = Util.now();
    return { ...copy, id: Util.uid('m'), name: `${m.name} ${suffix}`.trim(), createdAt: stamp, updatedAt: stamp };
  }

  return {
    touch, addPhase, removePhase, movePhase, addTask, task, updateTask, removeTask, moveTask,
    addRole, removeRole, moveRole, copyRoles, setKeys, canCombine, press, setQuestion, setNote,
    applyPlan, applySuggestion, renameKey, resortCells, setVariant, addLetter, updateLetter, removeLetter,
    setOption, setRule, addTaskList, applyTemplate, duplicate,
  };
})();
