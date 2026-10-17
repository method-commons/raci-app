/*
 * Checks – Prüfung der Matrix nach den RACI-Regeln: waagerecht je Aufgabe (genau ein A,
 * mindestens ein R, nicht zu viele C, Aufgabe als Tätigkeit) und senkrecht je Rolle (Engpass,
 * viele Entscheidungen, Rolle ohne Aufgabe); dazu Kennzahlen, Hinweise für die Seitenleiste,
 * Vorschläge zum Entlasten einer Rolle und die Änderungen Ist → Soll.
 * Exportiert den Namensraum `Checks`.
 */
import { Model } from './model.js';
import { Texts } from './texts.js';
import { Util } from './util.js';
import { Variants } from './variants.js';

export const Checks = (() => {
  /** Bedeutungen, die eine Aufgabe tragen (zählen für Engpass und Belastung). @type {readonly LetterKind[]} */
  const LEAD = ['owner', 'driver', 'exec'];
  /** Mindestanzahl Aufgaben für Prüfungen je Rolle */
  const MIN_TASKS = 3;
  /** „Viele Entscheidungen“: Anteil der Aufgaben mit A in Prozent bzw. mindestens so viele */
  const MANY_OWNER_SHARE = 40;
  const MANY_OWNER_MIN = 3;
  /** Höchstens so viele Aufgaben werden in einem Hinweis genannt */
  const LIST_MAX = 3;

  /** Alle Kürzel einer Aufgabe über alle Rollen. @param {Matrix} m @param {Task} t @param {PlanMode} md */
  function taskKeys(m, t, md) {
    return m.roles.flatMap(r => Model.keys(m, t.id, r.id, md));
  }

  /** Ist der Name als Tätigkeit formuliert (Verb erkannt)? @param {string} name */
  function isActivity(name) {
    return new RegExp(Texts.checks.verbPattern, 'u').test(name);
  }

  /**
   * Befunde zu einer Aufgabe.
   * @param {Matrix} m @param {Task} t @param {PlanMode} [md] @returns {TaskIssue[]}
   */
  function taskIssues(m, t, md = Model.mode(m)) {
    const all = taskKeys(m, t, md);
    /** @type {TaskIssue[]} */
    const out = [];
    if (!all.length) out.push({ rule: 'empty', level: 'info' });
    else {
      for (const l of m.letters) {
        const n = all.filter(k => k === l.key).length;
        if (l.count === 'one' && n === 0) out.push({ rule: 'missing', level: 'bad', key: l.key, n });
        else if ((l.count === 'one' || l.count === 'max1') && n > 1) out.push({ rule: 'tooMany', level: 'bad', key: l.key, n });
        else if (l.count === 'min1' && n === 0 && m.rules.minExec) out.push({ rule: 'missing', level: 'warn', key: l.key, n });
      }
      const unknown = all.filter(k => !Model.letter(m, k));
      if (unknown.length) out.push({ rule: 'unknown', level: 'warn', key: unknown[0], n: unknown.length });
      if (m.rules.manyConsult > 0) {
        for (const l of m.letters.filter(x => x.kind === 'consult')) {
          const n = all.filter(k => k === l.key).length;
          if (n >= m.rules.manyConsult) out.push({ rule: 'manyConsult', level: 'warn', key: l.key, n });
        }
      }
    }
    if (m.options.notes && m.roles.some(r => { const c = Model.cell(m, t.id, r.id); return c && c.q; })) out.push({ rule: 'question', level: 'info' });
    if (m.rules.verb && t.name.trim() && !isActivity(t.name)) out.push({ rule: 'verb', level: 'info' });
    return out;
  }

  /** Eindeutig: belegt und alle Zählregeln erfüllt. @param {TaskIssue[]} issues */
  const isClear = issues => !issues.some(i => i.rule === 'empty' || i.rule === 'missing' || i.rule === 'tooMany' || i.rule === 'unknown');

  /** Kurztext eines Befunds („2× A“, „kein R“, „klären“). @param {TaskIssue} i */
  function issueText(i) {
    const S = Texts.checks.status;
    return Util.fill(S[i.rule], { key: i.key || '', n: i.n ?? 0 });
  }

  /**
   * Zustand einer Aufgabe für die Prüfspalte: wichtigster Befund (Fehler vor Warnung vor
   * „klären“); die Formulierung zählt hier nicht.
   * @param {Matrix} m @param {Task} t @param {PlanMode} [md]
   * @returns {{ level: 'ok' | 'bad' | 'warn' | 'info' | 'empty', text: string }}
   */
  function status(m, t, md) {
    const issues = taskIssues(m, t, md).filter(i => i.rule !== 'verb');
    const top = issues.find(i => i.level === 'bad') || issues.find(i => i.level === 'warn') || issues.find(i => i.rule === 'question') || issues[0];
    if (!top) return { level: 'ok', text: '✓' };
    if (top.rule === 'empty') return { level: 'empty', text: Texts.checks.status.empty };
    return { level: top.level, text: issueText(top) };
  }

  /**
   * Kennzahlen einer Rolle: Anzahl je Kürzel, beteiligte Aufgaben, tragende Aufgaben (A, D, R).
   * @param {Matrix} m @param {Role} r @param {PlanMode} [md]
   */
  function roleStats(m, r, md = Model.mode(m)) {
    /** @type {Record<string, number>} */
    const counts = {};
    let involved = 0;
    let lead = 0;
    let owner = 0;
    for (const t of m.tasks) {
      const k = Model.keys(m, t.id, r.id, md);
      if (!k.length) continue;
      involved++;
      for (const x of k) counts[x] = (counts[x] || 0) + 1;
      const kinds = k.map(x => { const l = Model.letter(m, x); return l ? l.kind : 'other'; });
      if (kinds.some(x => LEAD.includes(x))) lead++;
      if (kinds.includes('owner')) owner++;
    }
    return { counts, involved, lead, owner };
  }

  /**
   * Befunde zu einer Rolle (senkrecht gelesen).
   * @param {Matrix} m @param {Role} r @param {PlanMode} [md] @returns {RoleIssue[]}
   */
  function roleIssues(m, r, md) {
    const n = m.tasks.length;
    if (!n) return [];
    const s = roleStats(m, r, md);
    /** @type {RoleIssue[]} */
    const out = [];
    if (m.rules.emptyRole && s.involved === 0) out.push({ rule: 'emptyRole' });
    if (m.rules.bottleneck > 0 && n >= MIN_TASKS && (s.involved * 100) / n > m.rules.bottleneck) out.push({ rule: 'bottleneck', n: s.lead });
    if (m.rules.bottleneck > 0 && s.owner >= MANY_OWNER_MIN && (s.owner * 100) / n > MANY_OWNER_SHARE) out.push({ rule: 'manyOwner', n: s.owner });
    return out;
  }

  /** Tragende Buchstaben als Text („A oder R“). @param {Matrix} m */
  function leadLabel(m) {
    return m.letters.filter(l => LEAD.includes(l.kind)).sort((a, b) => Variants.KIND_ORDER.indexOf(a.kind) - Variants.KIND_ORDER.indexOf(b.kind)).map(l => l.key).join(Texts.checks.or);
  }

  /**
   * Kennzahlen der Matrix.
   * @param {Matrix} m @param {PlanMode} [md]
   */
  function summary(m, md = Model.mode(m)) {
    let clear = 0, bad = 0, warn = 0, questions = 0, empty = 0;
    for (const t of m.tasks) {
      const issues = taskIssues(m, t, md);
      if (isClear(issues)) clear++;
      if (issues.some(i => i.level === 'bad')) bad++;
      else if (issues.some(i => i.level === 'warn')) warn++;
      if (issues.some(i => i.rule === 'question')) questions++;
      if (issues.some(i => i.rule === 'empty')) empty++;
    }
    const roleWarn = m.roles.filter(r => roleIssues(m, r, md).length).length;
    return { tasks: m.tasks.length, clear, bad, warn, questions, empty, roleWarn };
  }

  /**
   * Aufgaben mit ihren Befunden als Text („1.3 Ware bestellen: 2× A“), gekürzt.
   * @param {Matrix} m @param {{ t: Task, i: TaskIssue }[]} list
   */
  function taskList(m, list) {
    const no = Model.numbers(m);
    const parts = list.slice(0, LIST_MAX).map(({ t, i }) => `${no[t.id]} ${t.name.trim() || Texts.ui.untitledTask}${i.rule === 'verb' ? '' : `: ${issueText(i)}`}`);
    if (list.length > LIST_MAX) parts.push(Util.fill(Texts.checks.more, { n: list.length - LIST_MAX }));
    return parts.join(' · ');
  }

  /**
   * Hinweise für die Seitenleiste: je Regel erfüllt, Fehler oder zu prüfen – mit den
   * betroffenen Aufgaben bzw. Rollen.
   * @param {Matrix} m @param {PlanMode} [md] @returns {Hint[]}
   */
  function hints(m, md = Model.mode(m)) {
    const C = Texts.checks;
    if (!m.tasks.length || !m.roles.length) return [{ key: 'start', state: 'open', title: C.startTitle, detail: C.startText }];
    const all = Model.ordered(m).map(t => ({ t, issues: taskIssues(m, t, md) }));
    /** @param {(i: TaskIssue) => boolean} pred */
    const hits = pred => all.flatMap(({ t, issues }) => issues.filter(pred).slice(0, 1).map(i => ({ t, i })));
    /** @type {Hint[]} */
    const out = [];
    /**
     * @param {string} key @param {string} title @param {{ t: Task, i: TaskIssue }[]} list
     * @param {'warn' | 'bad'} level @param {string} okText
     */
    const add = (key, title, list, level, okText) => out.push({ key, state: list.length ? level : 'ok', title, detail: list.length ? taskList(m, list) : okText, tasks: list.map(x => x.t.id) });

    const empty = hits(i => i.rule === 'empty');
    if (empty.length) out.push({ key: 'empty', state: 'open', title: C.emptyTitle, detail: taskList(m, empty), tasks: empty.map(x => x.t.id) });
    const byRule = [...m.letters].sort((a, b) => Number(a.count === 'min1') - Number(b.count === 'min1') || Variants.KIND_ORDER.indexOf(a.kind) - Variants.KIND_ORDER.indexOf(b.kind));
    for (const l of byRule) {
      if (l.count === 'one' || l.count === 'max1') {
        add(`count-${l.key}`, Util.fill(l.count === 'one' ? C.one : C.max1, { key: l.key }), hits(i => (i.rule === 'missing' || i.rule === 'tooMany') && i.key === l.key), 'bad', C.okAll);
      } else if (l.count === 'min1' && m.rules.minExec) {
        add(`count-${l.key}`, Util.fill(C.min1, { key: l.key }), hits(i => i.rule === 'missing' && i.key === l.key), 'warn', C.okAll);
      }
    }
    const unknown = hits(i => i.rule === 'unknown');
    if (unknown.length) add('unknown', C.unknown, unknown, 'warn', '');
    const consult = m.letters.find(l => l.kind === 'consult');
    if (m.rules.manyConsult > 0 && consult) add('manyConsult', Util.fill(C.manyConsult, { key: consult.key }), hits(i => i.rule === 'manyConsult'), 'warn', Util.fill(C.manyConsultOk, { n: m.rules.manyConsult, key: consult.key }));

    const roleHits = m.roles.map(r => ({ r, issues: roleIssues(m, r, md), s: roleStats(m, r, md) }));
    /** @param {RoleIssue['rule']} rule @param {string} title @param {string} okText @param {(x: { r: Role, s: ReturnType<typeof roleStats> }) => string} text */
    const addRole = (rule, title, okText, text) => {
      const list = roleHits.filter(x => x.issues.some(i => i.rule === rule));
      out.push({ key: rule, state: list.length ? 'warn' : 'ok', title, detail: list.length ? list.map(text).join(' · ') : okText, roles: list.map(x => x.r.id) });
    };
    const n = m.tasks.length;
    const leadKeys = leadLabel(m);
    if (m.rules.bottleneck > 0) addRole('bottleneck', C.bottleneck, C.bottleneckOk, ({ r, s }) => Util.fill(C.bottleneckText, { role: r.name || Texts.ui.untitledRole, n: s.involved, total: n, lead: s.lead, keys: leadKeys }));
    const owner = m.letters.find(l => l.kind === 'owner');
    if (owner && m.rules.bottleneck > 0) addRole('manyOwner', Util.fill(C.manyOwner, { key: owner.key }), C.manyOwnerOk, ({ r, s }) => Util.fill(C.manyOwnerText, { role: r.name || Texts.ui.untitledRole, n: s.owner, key: owner.key }));
    if (m.rules.emptyRole) addRole('emptyRole', C.emptyRole, C.emptyRoleOk, ({ r }) => r.name || Texts.ui.untitledRole);
    if (m.rules.verb) {
      const verb = hits(i => i.rule === 'verb');
      out.push({ key: 'verb', state: verb.length ? 'warn' : 'ok', title: C.verb, detail: verb.length ? `${taskList(m, verb)} – ${C.verbHelp}` : Util.fill(C.verbOk, { n }), tasks: verb.map(x => x.t.id) });
    }
    return out;
  }

  /**
   * Vorschläge, eine Rolle zu entlasten: R abgeben (die entscheidende Rolle wird A/R),
   * C durch I ersetzen, I streichen. Nur Denkanstöße – angewendet wird erst auf Klick.
   * @param {Matrix} m @param {Role} role @param {PlanMode} [md] @returns {Suggestion[]}
   */
  function suggestions(m, role, md = Model.mode(m)) {
    const kindOf = (/** @type {string} */ k) => { const l = Model.letter(m, k); return l ? l.kind : 'other'; };
    const byKind = (/** @type {LetterKind} */ kind) => m.letters.find(l => l.kind === kind);
    const consult = byKind('consult');
    const inform = byKind('inform');
    /** @type {Suggestion[]} */
    const exec = [], cons = [], inf = [];
    for (const t of Model.ordered(m)) {
      const k = Model.keys(m, t.id, role.id, md);
      if (k.length !== 1) continue;
      const kind = kindOf(k[0]);
      if (kind === 'exec' && m.options.combined && consult) {
        const other = m.roles.find(r => r.id !== role.id && (() => { const o = Model.keys(m, t.id, r.id, md); return o.length === 1 && kindOf(o[0]) === 'owner'; })());
        if (other) {
          const from = Model.keys(m, t.id, other.id, md);
          exec.push({ kind: /** @type {const} */ ('execToOwner'), task: t.id, role: role.id, from: k, to: [consult.key], other: { role: other.id, from, to: Model.sortKeys(m.letters, [...from, k[0]]) } });
        }
      } else if (kind === 'consult' && inform) cons.push({ kind: /** @type {const} */ ('consultToInform'), task: t.id, role: role.id, from: k, to: [inform.key] });
      else if (kind === 'inform') inf.push({ kind: /** @type {const} */ ('dropInform'), task: t.id, role: role.id, from: k, to: [] });
    }
    return [...exec, ...cons, ...inf].slice(0, 5);
  }

  /**
   * Änderungen Ist → Soll (Zellen mit eigenem Soll), in Anzeigereihenfolge.
   * @param {Matrix} m @returns {{ task: string, role: string, from: string[], to: string[] }[]}
   */
  function diff(m) {
    /** @type {{ task: string, role: string, from: string[], to: string[] }[]} */
    const out = [];
    for (const t of Model.ordered(m)) {
      for (const r of m.roles) {
        const c = Model.cell(m, t.id, r.id);
        if (c && c.s) out.push({ task: t.id, role: r.id, from: c.v, to: c.s });
      }
    }
    return out;
  }

  return { LEAD, leadLabel, taskIssues, isClear, issueText, status, roleStats, roleIssues, summary, hints, suggestions, diff, isActivity };
})();
