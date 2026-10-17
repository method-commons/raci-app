/*
 * Ansicht „Bericht“: Matrix mit Legende, Prüfergebnis, Rollen-Hinweise, offene Punkte und – bei
 * Ist/Soll – die Änderungen auf einer Seite; Drucken/PDF, Markdown, CSV, JSON.
 */
import { Checks } from '../checks.js';
import { IO } from '../io.js';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { Variants } from '../variants.js';
import { Badge, download, fill, Legend } from './components.jsx';
import { toast, useMatrix, viewMode } from './core.js';

export function ReportView() {
  const m = useMatrix();
  const R = Texts.report;
  const md = viewMode(m);
  const no = Model.numbers(m);
  const s = Checks.summary(m, md);
  const open = Checks.hints(m, md).filter(h => h.state !== 'ok');
  const taskHints = open.filter(h => !h.roles);
  const roleHints = open.filter(h => h.roles);
  const notes = m.options.notes ? Model.ordered(m).flatMap(t => m.roles.map(r => ({ t, r, c: Model.cell(m, t.id, r.id) }))).filter(x => x.c && (x.c.q || x.c.note.trim())) : [];
  const diff = m.options.plan ? Checks.diff(m) : [];
  const roleName = (/** @type {string} */ id) => { const r = m.roles.find(x => x.id === id); return r ? r.name || Texts.ui.untitledRole : ''; };
  const copy = async () => {
    try { await navigator.clipboard.writeText(IO.markdown(m, { mode: md })); toast(R.copied); } catch (e) { toast(R.copyFailed); }
  };
  const meta = [Variants.texts(m.variant).name, m.context.trim(), m.options.plan ? R.modes[md] : '', `${R.asOf} ${Util.formatDay(Util.today(), Texts.locale, 0)}`].filter(Boolean).join(' · ');
  return (
    <div class="page report-page">
      <div class="export-bar no-print">
        <button type="button" class="btn primary" id="printBtn" onClick={() => window.print()}>⎙ {R.print}</button>
        <button type="button" class="btn" id="copyMdBtn" onClick={copy}>{R.copyMd}</button>
        <button type="button" class="btn" id="mdBtn" onClick={() => download(IO.markdown(m, { mode: md }), Util.fileName(m.name, 'md'), 'text/markdown')}>{R.downloadMd}</button>
        <button type="button" class="btn" id="csvBtn" onClick={() => download('\uFEFF' + IO.csv(m, md), Util.fileName(m.name, 'csv'), 'text/csv')}>{R.csv}</button>
        <button type="button" class="btn" id="jsonBtn" onClick={() => download(IO.matrixJson(m), Util.fileName(m.name, 'json'), 'application/json')}>{R.json}</button>
      </div>
      <div class="paper" id="report">
        <div class="paper-head">
          <div><h1>{m.name || Texts.ui.untitledMatrix}</h1><div class="sub">{meta}</div></div>
          <Legend m={m} />
        </div>
        <div class="tbl-wrap">
          <table class="pmx" id="reportTable">
            <thead>
              <tr>
                <th class="left">{R.task}</th>
                {m.roles.map(r => <th key={r.id}>{r.name || Texts.ui.untitledRole}{m.options.people && r.person.trim() && <small>{r.person}</small>}</th>)}
                <th>{R.check}</th>
              </tr>
            </thead>
            <tbody>
              {Model.groups(m).map(g => (
                <>
                  {g.phase && <tr class="ph" key={`p-${g.phase.id}`}><td colSpan={m.roles.length + 2}>{g.phase.name || Texts.ui.untitledPhase}</td></tr>}
                  {g.tasks.map(t => {
                    const st = Checks.status(m, t, md);
                    return (
                      <tr key={t.id}>
                        <td class="left"><span class="id">{no[t.id]}</span> {t.name || Texts.ui.untitledTask}{t.ref.trim() && <small> ↗ {t.ref}</small>}</td>
                        {m.roles.map(r => <td key={r.id}><Badge m={m} keys={Model.keys(m, t.id, r.id, md)} size="sm" /></td>)}
                        <td class={`st st-${st.level}`}>{st.text}</td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div class="rep">
          <div class={`box${taskHints.length ? ' warn-box' : ' ok-box'}`}>
            <h4>{fill(R.checkTitle, { clear: s.clear, n: s.tasks })}</h4>
            {taskHints.length ? <ul>{taskHints.map(h => <li key={h.key}><b>{h.title}:</b> {h.detail}</li>)}</ul> : <p>{R.allOk}</p>}
          </div>
          <div class={`box${roleHints.length ? ' warn-box' : ' ok-box'}`}>
            <h4>{R.roles}</h4>
            {roleHints.length ? <ul>{roleHints.map(h => <li key={h.key}><b>{h.title}:</b> {h.detail}</li>)}</ul> : <p>{R.allOk}</p>}
          </div>
          {notes.length > 0 && (
            <div class="box">
              <h4>{R.open}</h4>
              <ul>{notes.map(({ t, r, c }) => <li key={`${t.id}-${r.id}`}><b>{no[t.id]} · {r.name || Texts.ui.untitledRole}</b>{c && c.q ? ` (${R.question})` : ''}{c && c.note.trim() ? `: ${c.note}` : ''}</li>)}</ul>
            </div>
          )}
          {diff.length > 0 && (
            <div class="box">
              <h4>{R.changes}</h4>
              <ul>{diff.map(d => <li key={`${d.task}-${d.role}`}><b>{no[d.task]} · {roleName(d.role)}</b>: {Model.label(d.from) || '–'} → {Model.label(d.to) || '–'}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
