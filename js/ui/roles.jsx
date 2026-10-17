/*
 * Ansicht „Rollen“: Rollen mit Person und Vertretung, senkrecht gelesen (Beteiligung,
 * Verteilung der Buchstaben, Engpass), Bearbeiten der gewählten Rolle und Vorschläge zum
 * Entlasten. Dazu der Dialog „Neue Rolle“.
 */
import { useState } from 'preact/hooks';
import { Checks } from '../checks.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { Avatar, Badge, confirmDialog, Dialog, fill, Legend } from './components.jsx';
import { closeDialog, fieldProps, matrix, mutate, openDialog, selectedRole, useMatrix, viewMode } from './core.js';

/** Dialog „Neue Rolle“ (Name, bei Personen auch Person). */
export function openAddRole() {
  openDialog(() => <AddRoleDialog />);
}

function AddRoleDialog() {
  const [name, setName] = useState('');
  const [person, setPerson] = useState('');
  const m = matrix;
  const R = Texts.roles;
  const add = () => {
    mutate(x => { selectedRole.value = Ops.addRole(x, { name: name.trim() || R.newRole, person: person.trim() }).id; });
    closeDialog();
  };
  return (
    <Dialog title={R.newRole} id="addRoleDialog">
      <form class="dialog-body form-grid" onSubmit={e => { e.preventDefault(); add(); }}>
        <label for="arName">{R.name}</label>
        <input class="input" id="arName" value={name} placeholder={R.newRole} onInput={e => setName(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
        {m && m.options.people && <>
          <label for="arPerson">{R.person}</label>
          <input class="input" id="arPerson" value={person} onInput={e => setPerson(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
        </>}
        <button type="submit" hidden />
      </form>
      <div class="dialog-foot">
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class="btn primary" id="arAdd" onClick={add}>{Texts.matrix.addRole.replace(/^\+\s*/, '')}</button>
      </div>
    </Dialog>
  );
}

/** Verteilung der Buchstaben einer Rolle als Balken. @param {{ m: Matrix, counts: Record<string, number>, max: number }} props */
function LoadBar({ m, counts, max }) {
  return (
    <div class="load" aria-hidden="true">
      {m.letters.filter(l => counts[l.key]).map(l => (
        <span key={l.key} class={`lb-${l.color}`} style={{ width: `${(counts[l.key] * 100) / max}%` }} title={`${l.key}: ${counts[l.key]}`}>{counts[l.key]}</span>
      ))}
    </div>
  );
}

/** Chip mit dem wichtigsten Befund einer Rolle. @param {{ m: Matrix, issues: RoleIssue[] }} props */
function IssueChip({ m, issues }) {
  const R = Texts.roles;
  const i = issues[0];
  if (!i) return <span class="chip good">✓</span>;
  const owner = m.letters.find(l => l.kind === 'owner');
  return <span class="chip warn" data-issue={i.rule}>{fill(R.issues[i.rule], { n: i.n ?? 0, key: owner ? owner.key : '' })}</span>;
}

/** Gewählte Rolle bearbeiten. @param {{ m: Matrix, r: Role }} props */
function RoleForm({ m, r }) {
  const R = Texts.roles;
  const remove = () => confirmDialog({ title: R.remove, text: fill(R.removeText, { name: r.name || Texts.ui.untitledRole }), ok: Texts.ui.delete, danger: true, onOk: () => mutate(x => Ops.removeRole(x, r.id)) });
  return (
    <section class="card pad" id="roleForm">
      <h3>{R.role}</h3>
      <label class="field-lbl" for="rfName">{R.name}</label>
      <input class="input" id="rfName" {...fieldProps(() => r.name, v => { r.name = v; })} />
      <label class="field-lbl" for="rfDesc">{R.description}</label>
      <textarea class="input" id="rfDesc" rows={2} placeholder={R.descriptionPlaceholder} {...fieldProps(() => r.description, v => { r.description = v; })} />
      {m.options.people && (
        <div class="row two">
          <div><label class="field-lbl" for="rfPerson">{R.person}</label><input class="input" id="rfPerson" {...fieldProps(() => r.person, v => { r.person = v; })} /></div>
          <div><label class="field-lbl" for="rfDeputy">{R.deputy}</label><input class="input" id="rfDeputy" {...fieldProps(() => r.deputy, v => { r.deputy = v; })} /></div>
        </div>
      )}
      {m.options.external && <>
        <div class="field-lbl">{R.kind}</div>
        <div class="seg" role="group" aria-label={R.kind} id="rfKind">
          <button type="button" class={r.external ? '' : 'on'} onClick={() => mutate(() => { r.external = false; })}>{R.internal}</button>
          <button type="button" class={r.external ? 'on' : ''} data-kind="external" onClick={() => mutate(() => { r.external = true; })}>{R.external}</button>
        </div>
      </>}
      <div class="row form-actions">
        <button type="button" class="icon-btn" title={Texts.ui.moveUp} aria-label={Texts.ui.moveUp} onClick={() => mutate(x => Ops.moveRole(x, r.id, -1))}>←</button>
        <button type="button" class="icon-btn" title={Texts.ui.moveDown} aria-label={Texts.ui.moveDown} onClick={() => mutate(x => Ops.moveRole(x, r.id, 1))}>→</button>
        <span class="spacer" />
        <button type="button" class="btn sm danger-text" id="rfRemove" onClick={remove}>{R.remove}</button>
      </div>
    </section>
  );
}

/** Vorschläge zum Entlasten. @param {{ m: Matrix, r: Role }} props */
function Relieve({ m, r }) {
  const R = Texts.roles;
  const md = viewMode(m);
  const s = Checks.roleStats(m, r, md);
  const list = Checks.suggestions(m, r, md);
  const no = Model.numbers(m);
  const name = (/** @type {string} */ id) => { const x = m.roles.find(y => y.id === id); return x ? x.name || Texts.ui.untitledRole : ''; };
  const keys = Checks.leadLabel(m);
  return (
    <section class="card pad" id="relieve">
      <h3>{R.relieve}</h3>
      <p class="sub small">{fill(R.relieveIntro, { n: s.involved, total: m.tasks.length, lead: s.lead, keys })}</p>
      {!list.length && <p class="sub small">{R.noSuggestions}</p>}
      {list.map((g, i) => {
        const t = m.tasks.find(x => x.id === g.task);
        return (
          <div class="sugg" key={`${g.task}-${i}`} data-suggestion={g.kind}>
            <span class="sugg-key">{g.from.length ? <Badge m={m} keys={g.from} size="sm" /> : null}</span>
            <div>
              <b>{no[g.task]} {t ? t.name || Texts.ui.untitledTask : ''}</b>
              <p class="sub small">{fill(R.suggestion[g.kind], { from: Model.label(g.from), to: Model.label(g.to), other: g.other ? name(g.other.role) : '', otherTo: g.other ? Model.label(g.other.to) : '' })}</p>
            </div>
            <button type="button" class="btn sm" data-action="applySuggestion" onClick={() => mutate(x => Ops.applySuggestion(x, g, md))}>{R.apply}</button>
          </div>
        );
      })}
      {list.length > 0 && <p class="hint small">{R.suggestionsHint}</p>}
    </section>
  );
}

export function RolesView() {
  const m = useMatrix();
  const R = Texts.roles;
  const md = viewMode(m);
  const rows = m.roles.map(r => ({ r, s: Checks.roleStats(m, r, md), issues: Checks.roleIssues(m, r, md) }));
  const max = Math.max(1, ...rows.map(x => Object.values(x.s.counts).reduce((a, b) => a + b, 0)));
  const sel = m.roles.find(r => r.id === selectedRole.value) || null;
  const ext = m.roles.filter(r => r.external).length;
  const people = new Set(m.roles.map(r => r.person.trim()).filter(Boolean)).size;
  const avg = m.roles.length ? rows.reduce((a, x) => a + x.s.involved, 0) / m.roles.length : 0;
  const bottle = rows.filter(x => x.issues.some(i => i.rule === 'bottleneck'));
  const empty = rows.filter(x => x.s.involved === 0).length;
  return (
    <div class="page roles-page">
      <div class="crumb-row">
        <h1>{R.title}</h1>
        <span class="sub">{fill(R.summary, { n: m.roles.length, people, ext })}</span>
        <span class="spacer" />
        <Legend m={m} />
        <button type="button" class="btn primary" id="addRoleBtn2" onClick={() => openAddRole()}>{Texts.matrix.addRole}</button>
      </div>
      <div class="kpis">
        <div class="card kpi"><small>{R.kpiRoles}</small><b>{m.roles.length}</b><span>{fill(R.kpiRolesSub, { internal: m.roles.length - ext, ext })}</span></div>
        <div class="card kpi"><small>{R.kpiAvg}</small><b>{avg.toLocaleString(Texts.locale, { maximumFractionDigits: 1 })}</b><span>{fill(R.kpiAvgSub, { n: m.tasks.length })}</span></div>
        <div class={`card kpi${bottle.length ? ' warn-kpi' : ''}`} id="kpiBottleneck"><small>{R.kpiBottleneck}</small><b>{bottle.length}</b><span>{bottle.length ? bottle.map(x => x.r.name).join(', ') : R.kpiBottleneckSub}</span></div>
        <div class="card kpi"><small>{R.kpiEmpty}</small><b class={empty ? 'warn' : 'good'}>{empty}</b><span>{R.kpiEmptySub}</span></div>
      </div>
      <div class="work roles-work">
        <div class="card table-card">
          {!m.roles.length ? <p class="pad sub">{R.noRoles}</p> : (
            <div class="tbl-wrap">
              <table class="rtbl" id="rolesTable">
                <thead><tr><th>{R.role}</th>{m.options.people && <th>{R.person}</th>}<th class="num">{R.involved}</th><th>{R.distribution}</th><th>{R.hint}</th></tr></thead>
                <tbody>
                  {rows.map(({ r, s, issues }) => (
                    <tr key={r.id} class={sel && sel.id === r.id ? 'sel' : ''} data-role-row={r.id} tabIndex={0} onClick={() => { selectedRole.value = r.id; }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedRole.value = r.id; } }}>
                      <td><b>{r.name || Texts.ui.untitledRole}</b>{m.options.external && r.external && <span class="chip sm">{R.external}</span>}{r.description && <small>{r.description}</small>}</td>
                      {m.options.people && <td>{r.person.trim() ? <span class="who"><Avatar name={r.person} sm />{r.person}</span> : <span class="sub">–</span>}</td>}
                      <td class="num"><b>{s.involved}</b><small>/ {m.tasks.length}</small></td>
                      <td><LoadBar m={m} counts={s.counts} max={max} /></td>
                      <td><IssueChip m={m} issues={issues} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p class="table-foot sub small">{R.readVertical}</p>
        </div>
        <aside class="side">
          {sel ? <>
            <RoleForm m={m} r={sel} />
            <Relieve m={m} r={sel} />
          </> : <section class="card pad"><p class="sub small">{R.select}</p></section>}
        </aside>
      </div>
    </div>
  );
}
