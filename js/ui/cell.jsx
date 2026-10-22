/*
 * Zellen der Matrix: Auswahl (gewählte Zelle, offenes Auswahl-Feld), Inhalt, Tastatur und das
 * Auswahl-Feld an der Zelle (Buchstaben, doppeltes A auflösen, klären, Notiz); dazu der
 * Umschalter Ist / Soll, den auch der Aufgaben-Dialog nutzt.
 */
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { Badge, fill } from './components.jsx';
import { fieldProps, mutate, selectedCell, viewMode, viewPrefs } from './core.js';
import { openSettings } from './settings.jsx';

/** Auswahl-Feld an der gewählten Zelle offen? */
export const popOpen = signal(false);

/** Zeichen vor dem Prüftext je Zustand. */
export const PREFIX = { ok: '', bad: '✗ ', warn: '! ', info: '? ', empty: '' };

/** Zelle wählen (und Auswahl-Feld öffnen). @param {string} task @param {string} role @param {boolean} [open] */
export function selectCell(task, role, open = false) {
  selectedCell.value = { task, role };
  popOpen.value = open;
}

/** Knopf einer Zelle fokussieren. @param {string} task @param {string} role */
export function focusCell(task, role) {
  const el = /** @type {HTMLElement | null} */ (document.querySelector(`#matrixTable [data-task="${task}"][data-role="${role}"]`));
  if (el) el.focus();
}

/**
 * Inhalt einer Zelle: Buchstaben, bei „Ist → Soll“ mit altem Stand.
 * @param {{ m: Matrix, task: string, role: string }} props
 */
export function CellContent({ m, task, role }) {
  const c = Model.cell(m, task, role);
  if (!c) return null;
  const compare = m.options.plan && viewPrefs.value.mode === 'compare';
  const md = viewMode(m);
  const q = m.options.notes && c.q;
  const note = m.options.notes && c.note.trim() ? <span class="note-dot" title={c.note} aria-hidden="true" /> : null;
  if (compare && c.s) {
    return (
      <span class="cmp-cell">
        {c.v.length ? <Badge m={m} keys={c.v} size="sm" old /> : <span class="arr">+</span>}
        {c.v.length > 0 && <span class="arr">→</span>}
        {c.s.length ? <Badge m={m} keys={c.s} size="sm" question={q} /> : <i class="b sm empty">–</i>}
        {note}
      </span>
    );
  }
  const k = md === 'soll' && c.s ? c.s : c.v;
  return <>{k.length ? <Badge m={m} keys={k} question={q} /> : q ? <i class="b empty qm">?</i> : null}{note}</>;
}

/** Tastatur in einer Zelle. @param {KeyboardEvent} e @param {Matrix} m @param {string[]} order @param {string} task @param {string} role */
export function onCellKey(e, m, order, task, role) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const md = viewMode(m);
  const ri = m.roles.findIndex(r => r.id === role);
  const ti = order.indexOf(task);
  /** @param {number} dt @param {number} dr */
  const move = (dt, dr) => {
    const t = order[Util.clamp(ti + dt, 0, order.length - 1)];
    const r = m.roles[Util.clamp(ri + dr, 0, m.roles.length - 1)];
    e.preventDefault();
    selectCell(t, r.id);
    focusCell(t, r.id);
  };
  if (e.key === 'ArrowUp') return move(-1, 0);
  if (e.key === 'ArrowDown') return move(1, 0);
  if (e.key === 'ArrowLeft') return move(0, -1);
  if (e.key === 'ArrowRight') return move(0, 1);
  if (e.key === 'Escape') { popOpen.value = false; return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    mutate(x => Ops.setKeys(x, task, role, [], md));
    return;
  }
  if (e.key === '?' && m.options.notes) {
    e.preventDefault();
    mutate(x => { const c = Model.cell(x, task, role); Ops.setQuestion(x, task, role, !(c && c.q)); });
    return;
  }
  const l = m.letters.find(x => x.key === e.key.toUpperCase());
  if (l && e.key.length === 1) {
    e.preventDefault();
    selectCell(task, role, popOpen.value);
    mutate(x => Ops.press(x, task, role, l.key, md));
  }
}

/**
 * Auswahl an der gewählten Zelle: Buchstaben, „klären“, Notiz; bei einem doppelten A Vorschläge.
 * @param {{ m: Matrix }} props
 */
export function CellPopover({ m }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [chosen, setChosen] = useState(/** @type {PlanMode | null} */ (null));
  const sel = selectedCell.value;
  const T = Texts.matrix;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !sel) return undefined;
    const place = () => {
      const a = document.querySelector(`#matrixTable [data-task="${sel.task}"][data-role="${sel.role}"]`);
      if (!a) return;
      const r = a.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let left = r.left + r.width / 2 - w / 2;
      left = Util.clamp(left, 8, window.innerWidth - w - 8);
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  });
  useEffect(() => {
    /** @param {MouseEvent} e */
    const away = e => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-cell]')) popOpen.value = false;
    };
    /** @param {KeyboardEvent} e */
    const esc = e => { if (e.key === 'Escape') { popOpen.value = false; if (sel) focusCell(sel.task, sel.role); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [sel]);
  if (!sel) return null;
  const task = m.tasks.find(t => t.id === sel.task);
  const role = m.roles.find(r => r.id === sel.role);
  if (!task || !role) return null;
  const md = m.options.plan ? chosen || viewMode(m) : 'ist';
  const cur = Model.keys(m, task.id, role.id, md);
  const c = Model.cell(m, task.id, role.id);
  const owner = m.letters.find(l => l.kind === 'owner');
  const exec = m.letters.find(l => l.kind === 'exec');
  const consult = m.letters.find(l => l.kind === 'consult');
  const combo = owner && exec && m.options.combined ? Model.sortKeys(m.letters, [owner.key, exec.key]) : null;
  // Doppelter Buchstabe mit Regel „genau/höchstens einer“ (z. B. zwei A)
  const single = cur.map(k => Model.letter(m, k)).find(l => l && (l.count === 'one' || l.count === 'max1'));
  const other = single ? m.roles.find(r => r.id !== role.id && Model.keys(m, task.id, r.id, md).includes(single.key)) : undefined;
  /** @param {string[]} keys */
  const set = keys => mutate(x => Ops.setKeys(x, task.id, role.id, keys, md));
  const isCur = (/** @type {string[]} */ k) => Model.same(cur, k);
  return (
    <div class="pop" id="cellPopover" ref={ref} role="dialog" aria-label={fill(T.cellTitle, { task: task.name || Texts.ui.untitledTask, role: role.name || Texts.ui.untitledRole })}>
      <h4>{task.name || Texts.ui.untitledTask}</h4>
      <div class="sub small">{fill(T.roleOf, { role: role.name || Texts.ui.untitledRole })}{m.options.people && role.person ? ` (${role.person})` : ''}</div>
      {m.options.plan && <StateSwitch md={md} set={setChosen} id="cellMode" />}
      <OtherState m={m} task={task.id} role={role.id} md={md} />
      <div class="pick-letters">
        {m.letters.map(l => (
          <button type="button" key={l.key} class={`pl${isCur([l.key]) ? ' cur' : ''}`} data-pick-key={l.key} aria-pressed={isCur([l.key])} title={`${l.name} – ${l.meaning}`} onClick={() => set(isCur([l.key]) ? [] : [l.key])}>
            <Badge m={m} keys={[l.key]} size="lg" />
          </button>
        ))}
        {combo && (
          <button type="button" class={`pl${isCur(combo) ? ' cur' : ''}`} data-pick-key={Model.label(combo)} aria-pressed={isCur(combo)} onClick={() => set(isCur(combo) ? [] : combo)}>
            <Badge m={m} keys={combo} size="lg" />
          </button>
        )}
        <button type="button" class="pl" data-pick-key="" title={T.clearCell} aria-label={T.clearCell} onClick={() => set([])}><i class="b lg empty">–</i></button>
      </div>
      {single && other && (
        <div class="hint bad-hint" id="conflictHint">
          <span>{fill(T.conflict, { key: single.key, role: other.name || Texts.ui.untitledRole })}</span>
          <span class="row wrap">
            {consult && <button type="button" class="btn sm" data-action="otherToConsult" onClick={() => mutate(x => Ops.setKeys(x, task.id, other.id, [...Model.keys(x, task.id, other.id, md).filter(k => k !== single.key), consult.key], md))}>{fill(T.otherTo, { role: other.name || Texts.ui.untitledRole, to: consult.key })}</button>}
            {exec && single.kind === 'owner' && <button type="button" class="btn sm" data-action="hereOnly" onClick={() => set([exec.key])}>{fill(T.hereOnly, { to: exec.key })}</button>}
          </span>
        </div>
      )}
      {m.options.notes && <>
        <label class="check-inline q-toggle">
          <input type="checkbox" id="cellQuestion" checked={!!(c && c.q)} onChange={e => { const v = /** @type {HTMLInputElement} */ (e.currentTarget).checked; mutate(x => Ops.setQuestion(x, task.id, role.id, v)); }} />
          {T.question} <span class="sub small">– {T.questionHelp}</span>
        </label>
        <label class="field-lbl" for="cellNote">{T.note}</label>
        <textarea class="input" id="cellNote" rows={2} placeholder={T.notePlaceholder}
          {...fieldProps(() => (c ? c.note : ''), v => { const x = /** @type {Matrix} */ (m); Ops.setNote(x, task.id, role.id, v); })} />
      </>}
      {!m.options.notes && (
        <div class="sub small" id="notesOff">
          {T.notesOff} <button type="button" class="link sm" id="notesEnable" onClick={() => { popOpen.value = false; openSettings(); }}>{T.notesEnable}</button>
        </div>
      )}
      <div class="sub small keys-help">{T.keysHelp}{m.options.notes && T.keysHelpNotes}</div>
    </div>
  );
}

/**
 * Umschalter Ist / Soll in Aufgaben-Dialog und Zellen-Auswahl (nur bei Ist/Soll).
 * @param {{ md: PlanMode, set: (md: PlanMode) => void, id: string }} props
 */
export function StateSwitch({ md, set, id }) {
  const T = Texts.matrix;
  return (
    <div class="state-switch">
      <span class="sub small">{T.editState}</span>
      <div class="seg" role="group" aria-label={T.editState} id={id}>
        {/** @type {const} */ (['ist', 'soll']).map(k => (
          <button type="button" key={k} class={md === k ? 'on' : ''} aria-pressed={md === k} data-mode={k} onClick={() => set(k)}>{T.modes[k]}</button>
        ))}
      </div>
    </div>
  );
}

/** Der andere Stand einer Zelle als Hinweis („Ist: A/R“), wenn er abweicht. @param {{ m: Matrix, task: string, role: string, md: PlanMode }} props */
export function OtherState({ m, task, role, md }) {
  if (!m.options.plan) return null;
  const other = md === 'ist' ? 'soll' : 'ist';
  const a = Model.keys(m, task, role, md);
  const b = Model.keys(m, task, role, other);
  if (Model.same(a, b)) return null;
  return <small class="other-state">{Texts.matrix.modes[other]}: {Model.label(b) || '–'}</small>;
}
