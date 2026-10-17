/*
 * Ansicht „Matrix“: Aufgaben (nach Phasen) als Zeilen, Rollen als Spalten, je Zelle die
 * Buchstaben. Zelle per Klick (Auswahl mit Notiz und „klären“) oder Tastatur (Buchstabe, Entf,
 * ?, Pfeiltasten) bearbeiten; Prüfung je Zeile, Summen je Rolle, Seitenleiste mit allen Regeln,
 * offenen Punkten und – bei Ist/Soll – dem Vergleich. Schmal: Aufgaben als Liste, bearbeitet
 * im Aufgaben-Dialog.
 */
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { Checks } from '../checks.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { Variants } from '../variants.js';
import { Avatar, Badge, confirmDialog, Dialog, fill, HintList, Ring } from './components.jsx';
import { closeDialog, fieldProps, go, highlighted, mutate, openDialog, selectedCell, selectedRole, toast, useMatrix, viewMode, viewPrefs } from './core.js';
import { openAddRole } from './roles.jsx';
import { openSettings } from './settings.jsx';

/** Auswahl-Feld an der gewählten Zelle offen? */
const popOpen = signal(false);

const PREFIX = { ok: '', bad: '✗ ', warn: '! ', info: '? ', empty: '' };

/** Zelle wählen (und Auswahl-Feld öffnen). @param {string} task @param {string} role @param {boolean} [open] */
export function selectCell(task, role, open = false) {
  selectedCell.value = { task, role };
  popOpen.value = open;
}

/** Knopf einer Zelle fokussieren. @param {string} task @param {string} role */
function focusCell(task, role) {
  const el = /** @type {HTMLElement | null} */ (document.querySelector(`#matrixTable [data-task="${task}"][data-role="${role}"]`));
  if (el) el.focus();
}

/** Eingabefeld einer Aufgabe fokussieren. @param {string} id */
function focusTask(id) {
  const el = /** @type {HTMLInputElement | null} */ (document.querySelector(`#matrixTable tr[data-task-row="${id}"] .task-input`));
  if (el) el.focus();
}

/** Aufgabe anlegen und ihr Eingabefeld fokussieren. @param {string} phase */
function addTask(phase) {
  const t = mutate(m => Ops.addTask(m, { phase }));
  if (t) focusTask(t.id);
}

/**
 * Inhalt einer Zelle: Buchstaben, bei „Ist → Soll“ mit altem Stand.
 * @param {{ m: Matrix, task: string, role: string }} props
 */
function CellContent({ m, task, role }) {
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

/** Text der Prüfspalte. @param {{ m: Matrix, t: Task }} props */
function StatusCell({ m, t }) {
  const s = Checks.status(m, t, viewMode(m));
  return <td class={`st st-${s.level}`} data-status={s.level}>{PREFIX[s.level]}{s.text}</td>;
}

/** Tastatur in einer Zelle. @param {KeyboardEvent} e @param {Matrix} m @param {string[]} order @param {string} task @param {string} role */
function onCellKey(e, m, order, task, role) {
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

/** Kopf einer Rollenspalte. @param {{ m: Matrix, r: Role, hot: boolean }} props */
function RoleHead({ m, r, hot }) {
  const hl = highlighted.value.roles.includes(r.id);
  const ext = m.options.external && r.external;
  return (
    <th class={`role-th${hot ? ' hot' : ''}${ext ? ' ext' : ''}${hl ? ' hl' : ''}`} data-role-head={r.id} scope="col">
      <button type="button" class="role-head" title={r.description || r.name} onClick={() => { selectedRole.value = r.id; go({ view: 'matrix', mid: m.id, tab: 'roles' }); }}>
        {m.options.people && r.person.trim() && <Avatar name={r.person} sm />}
        <span class="role-name">{r.name || Texts.ui.untitledRole}</span>
        {m.options.people && r.person.trim() && <small>{r.person}</small>}
        {ext && <small>{Texts.matrix.external}</small>}
      </button>
    </th>
  );
}

/** @param {{ m: Matrix }} props */
function MatrixTable({ m }) {
  const T = Texts.matrix;
  const md = viewMode(m);
  const no = Model.numbers(m);
  const order = Model.ordered(m).map(t => t.id);
  const sel = selectedCell.value;
  const hot = new Set(m.roles.filter(r => Checks.roleIssues(m, r, md).some(i => i.rule === 'bottleneck')).map(r => r.id));
  const hl = highlighted.value;
  const groups = Model.groups(m);
  const cols = m.roles.length + 3;
  return (
    <div class="mx-wrap">
      <table class="mx" id="matrixTable">
        <thead>
          <tr>
            <th class="task-th" scope="col">{T.task}</th>
            {m.roles.map(r => <RoleHead key={r.id} m={m} r={r} hot={hot.has(r.id)} />)}
            <th class="add-role-th"><button type="button" class="btn sm dashed" id="addRoleBtn" onClick={() => openAddRole()}>{T.addRole}</button></th>
            <th class="st-th" scope="col">{T.check}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <>
              {g.phase && (
                <tr class="phase-row" key={`p-${g.phase.id}`} data-phase={g.phase.id}>
                  <td colSpan={cols}>
                    <div class="phase-line">
                      <input class="input bare phase-input" aria-label={T.phase} placeholder={T.phasePlaceholder} {...fieldProps(() => /** @type {Phase} */ (g.phase).name, v => { /** @type {Phase} */ (g.phase).name = v; })} />
                      <button type="button" class="icon-btn sm" title={Texts.ui.moveUp} aria-label={Texts.ui.moveUp} onClick={() => mutate(x => Ops.movePhase(x, /** @type {Phase} */ (g.phase).id, -1))}>↑</button>
                      <button type="button" class="icon-btn sm" title={Texts.ui.moveDown} aria-label={Texts.ui.moveDown} onClick={() => mutate(x => Ops.movePhase(x, /** @type {Phase} */ (g.phase).id, 1))}>↓</button>
                      <button type="button" class="icon-btn sm" title={T.removePhase} aria-label={T.removePhase} data-action="removePhase" onClick={() => confirmDialog({ title: T.removePhase, text: fill(T.removePhaseText, { name: /** @type {Phase} */ (g.phase).name || Texts.ui.untitledPhase }), ok: Texts.ui.delete, danger: true, onOk: () => mutate(x => Ops.removePhase(x, /** @type {Phase} */ (g.phase).id)) })}>✕</button>
                    </div>
                  </td>
                </tr>
              )}
              {!g.phase && m.options.phases && m.phases.length > 0 && g.tasks.length > 0 && (
                <tr class="phase-row" key="p-none"><td colSpan={cols}><span class="phase-none">{T.noPhase}</span></td></tr>
              )}
              {g.tasks.map(t => {
                const st = Checks.status(m, t, md);
                const rowCls = [st.level === 'bad' ? 'err' : st.level === 'warn' ? 'warn' : '', hl.tasks.includes(t.id) ? 'hl' : '', sel && sel.task === t.id ? 'sel' : ''].filter(Boolean).join(' ');
                return (
                  <tr key={t.id} class={rowCls} data-task-row={t.id}>
                    <th class="task" scope="row">
                      <div class="task-line">
                        <span class="id">{no[t.id]}</span>
                        <input class="input bare task-input" aria-label={T.taskName} placeholder={T.newTaskPlaceholder} {...fieldProps(() => t.name, v => { t.name = v; })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(t.phase); } }} />
                        <button type="button" class="icon-btn sm task-more" title={T.editTask} aria-label={T.editTask} data-action="editTask" onClick={() => openTaskDialog(t.id)}>⋯</button>
                      </div>
                      {t.ref.trim() && <small class="ref">↗ {t.ref}</small>}
                    </th>
                    {m.roles.map(r => {
                      const on = sel && sel.task === t.id && sel.role === r.id;
                      const cls = [hot.has(r.id) ? 'hotc' : '', hl.roles.includes(r.id) ? 'hl' : '', on ? 'cell-sel' : '', m.options.external && r.external ? 'ext' : ''].filter(Boolean).join(' ');
                      return (
                        <td key={r.id} class={cls}>
                          <button type="button" class="cellbtn" data-cell data-task={t.id} data-role={r.id}
                            aria-label={fill(T.cellTitle, { task: t.name || Texts.ui.untitledTask, role: r.name || Texts.ui.untitledRole })}
                            onClick={() => selectCell(t.id, r.id, !(on && popOpen.value))}
                            onFocus={() => { if (!on) selectCell(t.id, r.id, false); }}
                            onKeyDown={e => onCellKey(e, m, order, t.id, r.id)}>
                            <CellContent m={m} task={t.id} role={r.id} />
                          </button>
                        </td>
                      );
                    })}
                    <td class="add-role-td" />
                    <StatusCell m={m} t={t} />
                  </tr>
                );
              })}
              {(g.phase || !m.options.phases || !m.phases.length) && (
                <tr class="add-row" key={`a-${g.phase ? g.phase.id : 'none'}`}>
                  <td colSpan={cols}><button type="button" class="link sm" data-add-task={g.phase ? g.phase.id : ''} onClick={() => addTask(g.phase ? g.phase.id : '')}>{T.addTask}</button></td>
                </tr>
              )}
            </>
          ))}
          {m.options.phases && (
            <tr class="add-row"><td colSpan={cols}><button type="button" class="link sm" id="addPhaseBtn" onClick={() => mutate(x => Ops.addPhase(x))}>{T.addPhase}</button></td></tr>
          )}
        </tbody>
        {m.roles.length > 0 && m.tasks.length > 0 && (
          <tfoot>
            <tr>
              <th scope="row">{T.sum}<small>{m.letters.map(l => l.key).join(' · ')}</small></th>
              {m.roles.map(r => {
                const s = Checks.roleStats(m, r, md);
                return (
                  <td key={r.id} data-tally={r.id}>
                    <div class="tally" style={{ gridTemplateColumns: `repeat(${m.letters.length}, 1fr)` }}>
                      {m.letters.map(l => <span key={l.key} class={`lt-${l.color}${s.counts[l.key] ? '' : ' z'}`} title={`${l.key}: ${s.counts[l.key] || 0}`}>{s.counts[l.key] || 0}</span>)}
                    </div>
                  </td>
                );
              })}
              <td /><td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * Auswahl an der gewählten Zelle: Buchstaben, „klären“, Notiz; bei einem doppelten A Vorschläge.
 * @param {{ m: Matrix }} props
 */
function CellPopover({ m }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
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
  const md = viewMode(m);
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
      <div class="sub small">{fill(T.roleOf, { role: role.name || Texts.ui.untitledRole })}{m.options.people && role.person ? ` (${role.person})` : ''}{m.options.plan ? ` · ${T.modes[md]}` : ''}</div>
      {m.options.plan && md === 'soll' && c && c.s && <div class="sub small">{T.modes.ist}: {Model.label(c.v) || '–'}</div>}
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
      <div class="sub small keys-help">{T.keysHelp}</div>
    </div>
  );
}

/** Aufgabe bearbeiten (auch die Ansicht auf schmalen Bildschirmen). @param {string} id */
export function openTaskDialog(id) {
  openDialog(() => <TaskDialog id={id} />);
}

/** @param {{ id: string }} props */
function TaskDialog({ id }) {
  const m = useMatrix();
  const t = m && m.tasks.find(x => x.id === id);
  if (!m || !t) return null;
  const T = Texts.matrix;
  const md = viewMode(m);
  const st = Checks.status(m, t, md);
  const no = Model.numbers(m);
  const remove = () => confirmDialog({ title: T.removeTask, text: fill(T.removeTaskText, { name: t.name || Texts.ui.untitledTask }), ok: Texts.ui.delete, danger: true, onOk: () => mutate(x => Ops.removeTask(x, id)) });
  return (
    <Dialog title={`${no[t.id]} ${t.name || Texts.ui.untitledTask}`} id="taskDialog">
      <div class="dialog-body">
        {(st.level === 'bad' || st.level === 'warn') && <div class={`hint ${st.level === 'bad' ? 'bad-hint' : 'warn'}`}>{PREFIX[st.level]}{st.text}</div>}
        <div class="form-grid">
          <label for="tdName">{T.taskName}</label>
          <input class="input" id="tdName" {...fieldProps(() => t.name, v => { t.name = v; })} />
          {m.options.phases && m.phases.length > 0 && <>
            <label for="tdPhase">{T.phase}</label>
            <select class="input select" id="tdPhase" value={t.phase} onChange={e => { const v = /** @type {HTMLSelectElement} */ (e.currentTarget).value; mutate(x => Ops.updateTask(x, id, { phase: v })); }}>
              <option value="">{T.noPhase}</option>
              {m.phases.map(p => <option key={p.id} value={p.id}>{p.name || Texts.ui.untitledPhase}</option>)}
            </select>
          </>}
          <label for="tdRef">{T.ref}</label>
          <input class="input" id="tdRef" placeholder={T.refPlaceholder} {...fieldProps(() => t.ref, v => { t.ref = v; })} />
        </div>
        <h3 class="sheet-title">{T.rolesTitle}{m.options.plan ? ` · ${T.modes[md]}` : ''}</h3>
        <p class="sub small">{T.sheetHint}</p>
        <div class="sheet-roles">
          {m.roles.map(r => {
            const k = Model.keys(m, t.id, r.id, md);
            return (
              <div class="srow" key={r.id} data-sheet-role={r.id}>
                <span class="srole">{m.options.people && r.person.trim() && <Avatar name={r.person} sm />}{r.name || Texts.ui.untitledRole}</span>
                <span class="mini-seg">
                  {m.letters.map(l => (
                    <button type="button" key={l.key} class={k.includes(l.key) ? 'on' : ''} aria-pressed={k.includes(l.key)} data-key={l.key} title={l.name} onClick={() => mutate(x => Ops.press(x, t.id, r.id, l.key, md))}>
                      {k.includes(l.key) ? <Badge m={m} keys={[l.key]} size="sm" /> : <i class="b sm off">{l.key}</i>}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn sm danger-text" id="tdRemove" onClick={remove}>{T.removeTask}</button>
        <span class="spacer" />
        <button type="button" class="icon-btn" title={Texts.ui.moveUp} aria-label={Texts.ui.moveUp} onClick={() => mutate(x => Ops.moveTask(x, id, -1))}>↑</button>
        <button type="button" class="icon-btn" title={Texts.ui.moveDown} aria-label={Texts.ui.moveDown} onClick={() => mutate(x => Ops.moveTask(x, id, 1))}>↓</button>
        <button type="button" class="btn primary" onClick={closeDialog}>{Texts.ui.done}</button>
      </div>
    </Dialog>
  );
}

/** Schmale Bildschirme: Aufgaben als Liste mit ihren Rollen. @param {{ m: Matrix }} props */
function MobileList({ m }) {
  const T = Texts.matrix;
  const md = viewMode(m);
  const no = Model.numbers(m);
  return (
    <div class="m-list" id="mobileList">
      {Model.groups(m).map(g => (
        <section key={g.phase ? g.phase.id : 'none'} class="m-group">
          {g.phase && <h3>{g.phase.name || Texts.ui.untitledPhase}</h3>}
          {g.tasks.map(t => {
            const st = Checks.status(m, t, md);
            return (
              <button type="button" key={t.id} class={`m-task card${st.level === 'bad' ? ' err' : ''}`} data-m-task={t.id} onClick={() => openTaskDialog(t.id)}>
                <span class="t"><span class="id">{no[t.id]}</span>{t.name || Texts.ui.untitledTask}<span class="spacer" />
                  <span class={`chip sm ${st.level === 'ok' ? 'good' : st.level === 'bad' ? 'bad' : st.level === 'empty' ? 'muted' : 'warn'}`}>{st.text}</span>
                </span>
                <span class="rl">
                  {m.roles.map(r => {
                    const k = Model.keys(m, t.id, r.id, md);
                    return k.length ? <span key={r.id}><Badge m={m} keys={k} size="sm" />{r.name || Texts.ui.untitledRole}</span> : null;
                  })}
                </span>
              </button>
            );
          })}
          <button type="button" class="link sm" onClick={() => { const nt = mutate(x => Ops.addTask(x, { phase: g.phase ? g.phase.id : '' })); if (nt) openTaskDialog(nt.id); }}>{T.addTask}</button>
        </section>
      ))}
    </div>
  );
}

/** Seitenleiste: Prüfung. @param {{ m: Matrix }} props */
function ChecksCard({ m }) {
  const T = Texts.matrix;
  const md = viewMode(m);
  const s = Checks.summary(m, md);
  return (
    <section class="card pad" id="checks" aria-label={Texts.matrix.check}>
      <h3>{T.check}</h3>
      {s.tasks > 0 && (
        <div class="score">
          <Ring value={s.clear} total={s.tasks} label={`${s.clear}/${s.tasks}`} />
          <div><b>{T.clearTitle}</b><div class="sub small">{T.clearHelp}</div></div>
        </div>
      )}
      <HintList hints={Checks.hints(m, md)} />
    </section>
  );
}

/** Seitenleiste: offene Punkte (klären, Notizen). @param {{ m: Matrix }} props */
function OpenCard({ m }) {
  const no = Model.numbers(m);
  const list = Model.ordered(m).flatMap(t => m.roles.map(r => ({ t, r, c: Model.cell(m, t.id, r.id) }))).filter(x => x.c && (x.c.q || x.c.note.trim()));
  if (!list.length) return null;
  return (
    <section class="card pad" id="openPoints">
      <h3>{Texts.matrix.openTitle} <span class="chip warn sm">{list.filter(x => x.c && x.c.q).length}</span></h3>
      {list.map(({ t, r, c }) => (
        <button type="button" key={`${t.id}-${r.id}`} class="open-item" onClick={() => { selectCell(t.id, r.id, true); focusCell(t.id, r.id); }}>
          <b>{no[t.id]} · {r.name || Texts.ui.untitledRole}</b> {c && c.q && <span class="chip warn sm">{Texts.matrix.question}</span>}
          {c && c.note.trim() && <span class="sub small">{c.note}</span>}
        </button>
      ))}
    </section>
  );
}

/** Seitenleiste: Ist → Soll. @param {{ m: Matrix }} props */
function PlanCard({ m }) {
  const T = Texts.matrix;
  const diff = Checks.diff(m);
  const tasks = new Set(diff.map(d => d.task)).size;
  const owner = m.letters.find(l => l.kind === 'owner');
  return (
    <section class="card pad" id="planCard">
      <h3>{T.planTitle}</h3>
      <div class="score">
        <Ring value={tasks} total={m.tasks.length} label={String(diff.length)} tone="var(--accent)" />
        <div><b>{diff.length ? fill(T.planChanges, { n: diff.length, tasks }) : T.planNone}</b></div>
      </div>
      {owner && (
        <table class="cmp" id="ownerCompare">
          <thead><tr><th>{fill(T.perRole, { key: owner.key })}</th><th>{T.modes.ist}</th><th>{T.modes.soll}</th></tr></thead>
          <tbody>
            {m.roles.map(r => {
              const a = Checks.roleStats(m, r, 'ist').owner;
              const b = Checks.roleStats(m, r, 'soll').owner;
              return <tr key={r.id} class={a !== b ? 'chg' : ''}><td>{r.name || Texts.ui.untitledRole}</td><td>{a}</td><td class={b < a ? 'good' : ''}>{b}</td></tr>;
            })}
          </tbody>
        </table>
      )}
      {diff.length > 0 && (
        <button type="button" class="btn sm" id="applyPlanBtn" onClick={() => confirmDialog({ title: T.applyPlan, text: fill(T.applyPlanText, { n: diff.length }), ok: T.applyPlan, onOk: () => { const n = mutate(x => Ops.applyPlan(x)); toast(fill(T.applied, { n: n || 0 })); } })}>{T.applyPlan}</button>
      )}
      <div class="legend plan-legend">
        <span><Badge m={m} keys={[owner ? owner.key : m.letters[0].key]} size="sm" old /><span class="arr">→</span><i class="b sm empty">–</i> {T.legendDropped}</span>
        <span><span class="arr">+</span> {T.legendNew}</span>
        <span><span class="arr">→</span> {T.legendChanged}</span>
      </div>
    </section>
  );
}

export function MatrixView() {
  const m = useMatrix();
  const T = Texts.matrix;
  const plan = m.options.plan;
  const on = /** @type {(keyof MatrixOptions)[]} */ (Object.keys(m.options)).filter(k => m.options[k]);
  return (
    <div class="page matrix-page">
      <div class="crumb-row">
        <input class="input bare title-input" id="matrixName" aria-label={T.name} placeholder={Texts.ui.untitledMatrix} {...fieldProps(() => m.name, v => { m.name = v; })} />
        <span class="method-chip">{Variants.texts(m.variant).name}</span>
        <input class="input bare ctx-input" id="matrixContext" aria-label={T.context} placeholder={T.context} {...fieldProps(() => m.context, v => { m.context = v; })} />
        <span class="spacer" />
        {plan && (
          <div class="seg" role="group" aria-label={T.mode} id="planMode">
            {/** @type {const} */ (['ist', 'soll', 'compare']).map(k => (
              <button type="button" key={k} class={viewPrefs.value.mode === k ? 'on' : ''} data-mode={k} onClick={() => { viewPrefs.value = { ...viewPrefs.value, mode: k }; }}>{T.modes[k]}</button>
            ))}
          </div>
        )}
        <span class="sub small opt-on hide-narrow">{T.optionalOn} {on.map(k => <span key={k} class="chip acc sm">{Texts.settings.opt[k].label}</span>)}</span>
        <button type="button" class="link sm" id="settingsLink" onClick={() => openSettings()}>{T.settings}</button>
      </div>
      <div class="work">
        <div class="main-col">
          <div class="card mx-card">
            <MatrixTable m={m} />
          </div>
          <MobileList m={m} />
          <div class="legend-row"><Legend2 m={m} /></div>
        </div>
        <aside class="side">
          <ChecksCard m={m} />
          {plan && <PlanCard m={m} />}
          {m.options.notes && <OpenCard m={m} />}
        </aside>
      </div>
      {popOpen.value && <CellPopover m={m} />}
    </div>
  );
}

/** Legende unter der Matrix. @param {{ m: Matrix }} props */
function Legend2({ m }) {
  return (
    <div class="legend letters-legend">
      {m.letters.map(l => <span key={l.key}><Badge m={m} keys={[l.key]} size="sm" /> {l.name}{l.meaning ? ` – ${l.meaning}` : ''}</span>)}
    </div>
  );
}
