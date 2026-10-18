/*
 * Matrix als Tabelle (Aufgaben nach Phasen als Zeilen, Rollen als Spalten, Prüfspalte, Summen je
 * Rolle) und – für schmale Bildschirme – als Liste der Aufgaben mit ihren Rollen.
 */
import { Checks } from '../checks.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { CellContent, onCellKey, popOpen, PREFIX, selectCell } from './cell.jsx';
import { Avatar, Badge, confirmDialog, fill } from './components.jsx';
import { fieldProps, go, highlighted, mutate, selectedCell, selectedRole, viewMode } from './core.js';
import { openAddRole } from './roles.jsx';
import { openPhaseDialog, openTaskDialog } from './task-dialogs.jsx';

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

/** Text der Prüfspalte. @param {{ m: Matrix, t: Task }} props */
function StatusCell({ m, t }) {
  const s = Checks.status(m, t, viewMode(m));
  return <td class={`st st-${s.level}`} data-status={s.level}>{PREFIX[s.level]}{s.text}</td>;
}

/** Zeile einer Phase: Name, verschieben, entfernen. @param {{ phase: Phase, cols: number }} props */
function PhaseRow({ phase, cols }) {
  const T = Texts.matrix;
  const remove = () => confirmDialog({ title: T.removePhase, text: fill(T.removePhaseText, { name: phase.name || Texts.ui.untitledPhase }), ok: Texts.ui.delete, danger: true, onOk: () => mutate(x => Ops.removePhase(x, phase.id)) });
  return (
    <tr class="phase-row" data-phase={phase.id}>
      <td colSpan={cols}>
        <div class="phase-line">
          <input class="input bare phase-input" aria-label={T.phase} placeholder={T.phasePlaceholder} {...fieldProps(() => phase.name, v => { phase.name = v; })} />
          <button type="button" class="icon-btn sm" title={Texts.ui.moveUp} aria-label={Texts.ui.moveUp} onClick={() => mutate(x => Ops.movePhase(x, phase.id, -1))}>↑</button>
          <button type="button" class="icon-btn sm" title={Texts.ui.moveDown} aria-label={Texts.ui.moveDown} onClick={() => mutate(x => Ops.movePhase(x, phase.id, 1))}>↓</button>
          <button type="button" class="icon-btn sm" title={T.removePhase} aria-label={T.removePhase} data-action="removePhase" onClick={remove}>✕</button>
        </div>
      </td>
    </tr>
  );
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
export function MatrixTable({ m }) {
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
              {g.phase && <PhaseRow key={`p-${g.phase.id}`} phase={g.phase} cols={cols} />}
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

/** Schmale Bildschirme: Aufgaben als Liste mit ihren Rollen. @param {{ m: Matrix }} props */
export function MobileList({ m }) {
  const T = Texts.matrix;
  const md = viewMode(m);
  const no = Model.numbers(m);
  return (
    <div class="m-list" id="mobileList">
      {Model.groups(m).map(g => (
        <section key={g.phase ? g.phase.id : 'none'} class="m-group">
          {g.phase && (
            <button type="button" class="m-phase" data-m-phase={g.phase.id} aria-label={`${T.editPhase}: ${g.phase.name || Texts.ui.untitledPhase}`} onClick={() => openPhaseDialog(/** @type {Phase} */ (g.phase).id)}>
              <span>{g.phase.name || Texts.ui.untitledPhase}</span><span class="m-phase-edit" aria-hidden="true">✎</span>
            </button>
          )}
          {!g.phase && m.options.phases && m.phases.length > 0 && g.tasks.length > 0 && <h3>{T.noPhase}</h3>}
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
      {m.options.phases && (
        <button type="button" class="link sm m-add-phase" id="mAddPhase" onClick={() => { const p = mutate(x => Ops.addPhase(x)); if (p) openPhaseDialog(p.id); }}>{T.addPhase}</button>
      )}
    </div>
  );
}
