/*
 * Dialoge zur Matrix: Aufgabe bearbeiten (Name, Phase, Verweis, Buchstaben je Rolle in Ist oder
 * Soll, verschieben, entfernen – auf schmalen Bildschirmen die eigentliche Bearbeitung) und Phase
 * bearbeiten.
 */
import { useState } from 'preact/hooks';
import { Checks } from '../checks.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { OtherState, PREFIX, StateSwitch } from './cell.jsx';
import { Avatar, Badge, confirmDialog, Dialog, fill } from './components.jsx';
import { closeDialog, fieldProps, mutate, openDialog, useMatrix, viewMode } from './core.js';

/** Aufgabe bearbeiten (auch die Ansicht auf schmalen Bildschirmen). @param {string} id */
export function openTaskDialog(id) {
  openDialog(() => <TaskDialog id={id} />);
}

/** @param {{ id: string }} props */
function TaskDialog({ id }) {
  const m = useMatrix();
  // Stand, der bearbeitet wird: anfangs der der Ansicht, bei Ist/Soll umschaltbar
  const [chosen, setChosen] = useState(/** @type {PlanMode | null} */ (null));
  const t = m && m.tasks.find(x => x.id === id);
  if (!m || !t) return null;
  const T = Texts.matrix;
  const md = m.options.plan ? chosen || viewMode(m) : 'ist';
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
        <h3 class="sheet-title">{T.rolesTitle}</h3>
        {m.options.plan && <StateSwitch md={md} set={setChosen} id="tdMode" />}
        <p class="sub small">{T.sheetHint}</p>
        <div class="sheet-roles">
          {m.roles.map(r => {
            const k = Model.keys(m, t.id, r.id, md);
            return (
              <div class="srow" key={r.id} data-sheet-role={r.id}>
                <span class="srole">{m.options.people && r.person.trim() && <Avatar name={r.person} sm />}<span>{r.name || Texts.ui.untitledRole}<OtherState m={m} task={t.id} role={r.id} md={md} /></span></span>
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

/** Phase bearbeiten (vor allem auf schmalen Bildschirmen). @param {string} id */
export function openPhaseDialog(id) {
  openDialog(() => <PhaseDialog id={id} />);
}

/** @param {{ id: string }} props */
function PhaseDialog({ id }) {
  const m = useMatrix();
  const p = m && m.phases.find(x => x.id === id);
  if (!m || !p) return null;
  const T = Texts.matrix;
  const n = m.tasks.filter(t => t.phase === id).length;
  const remove = () => confirmDialog({ title: T.removePhase, text: fill(T.removePhaseText, { name: p.name || Texts.ui.untitledPhase }), ok: Texts.ui.delete, danger: true, onOk: () => mutate(x => Ops.removePhase(x, id)) });
  return (
    <Dialog title={T.editPhase} id="phaseDialog">
      <div class="dialog-body">
        <label class="field-lbl" for="pdName">{T.phase}</label>
        <input class="input" id="pdName" placeholder={T.phasePlaceholder} {...fieldProps(() => p.name, v => { p.name = v; })} />
        <p class="sub small">{fill(T.phaseTasks, { n })}</p>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn sm danger-text" id="pdRemove" onClick={remove}>{T.removePhase}</button>
        <span class="spacer" />
        <button type="button" class="icon-btn" title={Texts.ui.moveUp} aria-label={Texts.ui.moveUp} data-action="phaseUp" onClick={() => mutate(x => Ops.movePhase(x, id, -1))}>↑</button>
        <button type="button" class="icon-btn" title={Texts.ui.moveDown} aria-label={Texts.ui.moveDown} data-action="phaseDown" onClick={() => mutate(x => Ops.movePhase(x, id, 1))}>↓</button>
        <button type="button" class="btn primary" onClick={closeDialog}>{Texts.ui.done}</button>
      </div>
    </Dialog>
  );
}
