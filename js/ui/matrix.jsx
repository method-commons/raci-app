/*
 * Ansicht „Matrix“: Aufgaben (nach Phasen) als Zeilen, Rollen als Spalten, je Zelle die
 * Buchstaben. Zelle per Klick (Auswahl mit Notiz und „klären“) oder Tastatur (Buchstabe, Entf,
 * ?, Pfeiltasten) bearbeiten; Prüfung je Zeile, Summen je Rolle, Seitenleiste mit allen Regeln,
 * offenen Punkten und – bei Ist/Soll – dem Vergleich. Schmal: Aufgaben als Liste, bearbeitet
 * im Aufgaben-Dialog.
 */
import { Checks } from '../checks.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Variants } from '../variants.js';
import { CellPopover, focusCell, popOpen, selectCell } from './cell.jsx';
import { Badge, confirmDialog, fill, HintList, Legend, Ring } from './components.jsx';
import { fieldProps, mutate, toast, useMatrix, viewMode, viewPrefs } from './core.js';
import { MatrixTable, MobileList } from './matrix-table.jsx';
import { openSettings } from './settings.jsx';

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
          <div class="legend-row"><Legend m={m} long /></div>
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
