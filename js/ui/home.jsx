/*
 * Startseite: alle Matrizen als Karten (Vorschaubild, Variante, Kennzahlen, wichtigster
 * Hinweis), Filter nach Variante, die vier Buchstaben und Faustregeln; Dialoge „Neue Matrix“
 * (Variante und Startinhalt) und „Beispiel öffnen“; Import (JSON, CSV).
 */
import { useState } from 'preact/hooks';
import { Checks } from '../checks.js';
import { Examples } from '../examples.js';
import { IO } from '../io.js';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { Variants } from '../variants.js';
import { Badge, Dialog, fill, pickFile } from './components.jsx';
import { closeDialog, openDialog, openMatrix, render, toast, useRevision } from './core.js';
import { openHelp } from './help.jsx';
import { deleteMatrix, duplicateMatrix } from './manage.js';
import { SyncDocState, SyncRemoteOnly } from './sync.jsx';

/** Datei importieren (JSON: Matrix, Sicherung oder Liste; CSV: eine Matrix). */
export async function importFiles() {
  const file = await pickFile('.json,.csv,application/json,text/csv');
  if (file == null) return;
  let list;
  try { list = IO.parse(file.text, file.name); } catch (e) {
    toast(fill(Texts.io.failed, { msg: e instanceof Error ? e.message : String(e) }));
    return;
  }
  let added = 0;
  let skipped = 0;
  /** @type {Matrix | null} */
  let last = null;
  for (const m of list) {
    const r = IO.resolveImport(m, Store.load(m.id));
    if (r.action === 'same') { skipped++; continue; }
    Store.save(r.matrix);
    last = r.matrix;
    added++;
  }
  toast([added ? fill(Texts.io.imported, { n: added }) : '', skipped ? fill(Texts.io.skipped, { n: skipped }) : ''].filter(Boolean).join(' '));
  if (added === 1 && last) openMatrix(last.id);
  else render();
}

/** Dialog „Neue Matrix“. @param {VariantId} [variant] vorausgewählte Variante */
export function openNewMatrix(variant) {
  openDialog(() => <NewMatrixDialog initial={variant || 'raci'} />);
}

/** Dialog „Beispiel öffnen“. */
export function openExamples() {
  openDialog(() => <ExamplesDialog />);
}

/**
 * Vorschaubild: Zellen als Farbraster (Zeilen = Aufgaben, Spalten = Rollen), Zeilen mit Fehler
 * links rot markiert.
 * @param {{ m: Matrix, width?: number, height?: number }} props
 */
export function Thumb({ m, width = 132, height = 108 }) {
  const md = Model.mode(m);
  const tasks = Model.ordered(m).slice(0, 16);
  const roles = m.roles.slice(0, 9);
  const rows = Math.max(tasks.length, 6);
  const cols = Math.max(roles.length, 4);
  const cw = (width - 14) / cols;
  const ch = (height - 10) / rows;
  /** @param {string[]} k */
  const color = k => {
    if (!k.length) return 'var(--surface)';
    const ls = k.map(x => Model.letter(m, x));
    const l = ls.find(x => x && x.kind === 'owner') || ls[0];
    return l ? `var(--lc-${l.color})` : 'var(--border-strong)';
  };
  return (
    <svg class="thumb" viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: `${height}px` }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => {
        const t = tasks[i];
        const bad = t && Checks.status(m, t, md).level === 'bad';
        return (
          <g key={i}>
            {bad && <rect x="2" y={5 + i * ch} width="3" height={ch - 1.5} rx="1" fill="var(--bad)" />}
            {Array.from({ length: cols }, (_, j) => {
              const r = roles[j];
              const k = t && r ? Model.keys(m, t.id, r.id, md) : [];
              return <rect key={j} x={8 + j * cw} y={5 + i * ch} width={cw - 2} height={ch - 1.5} rx="1.5" fill={color(k)} stroke="var(--border)" stroke-width=".6" stroke-dasharray={t && r ? undefined : '2 1.5'} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** Kennzahlen-Chips einer Matrix. @param {{ m: Matrix }} props */
function Stats({ m }) {
  const H = Texts.home;
  const s = Checks.summary(m);
  const changes = m.options.plan ? Checks.diff(m).length : 0;
  return (
    <div class="stats">
      <span class="chip">{Util.count(m.tasks.length, H.tasks.one, H.tasks.many)}</span>
      <span class="chip">{Util.count(m.roles.length, H.roles.one, H.roles.many)}</span>
      {m.tasks.length > 0 && <span class={`chip ${s.clear === s.tasks ? 'good' : 'warn'}`} data-stat="clear">{fill(H.clear, { clear: s.clear, n: s.tasks })}</span>}
      {s.bad > 0 && <span class="chip bad" data-stat="bad">{fill(H.bad, { n: s.bad })}</span>}
      {m.options.notes && s.questions > 0 && <span class="chip warn">{fill(H.questions, { n: s.questions })}</span>}
      {changes > 0 && <span class="chip acc">{fill(H.changes, { n: changes })}</span>}
    </div>
  );
}

/** Karte einer Matrix. @param {{ m: Matrix }} props */
function MatrixCard({ m }) {
  const hints = Checks.hints(m);
  const hint = hints.find(h => h.state === 'bad') || hints.find(h => h.state === 'warn');
  const day = m.updatedAt.slice(0, 10);
  const done = m.tasks.length > 0 && !hint;
  return (
    <article class="card mcard-home" data-matrix={m.id}>
      <a class="thumb-link" href={`#/m/${m.id}/matrix`} aria-hidden="true" tabIndex={-1}><Thumb m={m} /></a>
      <div class="mcard-body">
        <span class="method-chip">{Variants.texts(m.variant).name}</span>
        <h2><a class="card-link" href={`#/m/${m.id}/matrix`}>{m.name || Texts.ui.untitledMatrix}</a></h2>
        {m.context && <div class="sub small ctx">{m.context}</div>}
        <Stats m={m} />
      </div>
      <div class="mcard-foot">
        {hint && <span class={`${hint.state} small foot-hint`} title={hint.detail}>{hint.state === 'bad' ? '✗' : '⚠'} {hint.title}: {hint.detail}</span>}
        {done && <span class="good small">✓ {Texts.home.allOk}</span>}
        <span class="spacer" />
        <span class="sub small">{Util.formatDay(day, Texts.locale)}</span>
        <SyncDocState id={m.id} />
        <button type="button" class="icon-btn sm" title={Texts.manage.duplicate} aria-label={Texts.manage.duplicate} data-action="duplicate" onClick={() => duplicateMatrix(m)}>⧉</button>
        <button type="button" class="icon-btn sm" title={Texts.ui.delete} aria-label={Texts.ui.delete} data-action="delete" onClick={() => deleteMatrix(m)}>✕</button>
      </div>
    </article>
  );
}

/** Die vier Buchstaben mit Leitfrage und die Faustregeln. */
function LettersStrip() {
  const m = Model.create({ variant: 'raci' });
  const L = Texts.variants.raci.letters;
  const order = ['R', 'A', 'C', 'I'];
  return (
    <section class="card letters-strip" aria-label={Texts.variants.raci.name}>
      {order.map(k => {
        const t = /** @type {Record<string, { name: string, question: string, text: string }>} */ (L)[k];
        return (
          <div key={k} data-letter={k}>
            <b><Badge m={m} keys={[k]} />{t.name}</b>
            <p>{t.text}</p>
            <q>{t.question}</q>
          </div>
        );
      })}
      <div>
        <b>{Texts.home.rulesTitle}</b>
        <ul>{Texts.home.rules.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <button type="button" class="link sm" onClick={() => openHelp('method')}>{Texts.home.learn}</button>
      </div>
    </section>
  );
}

export function Home() {
  useRevision();
  const [filter, setFilter] = useState('');
  const all = Store.all();
  const used = [...new Set(all.map(m => m.variant))];
  const list = filter ? all.filter(m => m.variant === filter) : all;
  const H = Texts.home;
  const total = all.reduce((n, m) => n + m.tasks.length, 0);
  return (
    <div class="page home">
      <div class="page-head">
        <div>
          <h1>{H.title}</h1>
          <div class="sub">{all.length ? fill(H.summary, { n: all.length, tasks: total }) : H.intro}</div>
        </div>
        <span class="spacer" />
        {used.length > 1 && (
          <div class="seg wrap filter" role="group" aria-label={H.filter} id="variantFilter">
            <button type="button" class={filter ? '' : 'on'} onClick={() => setFilter('')}>{H.all}</button>
            {Variants.ORDER.filter(v => used.includes(v)).map(v => (
              <button type="button" key={v} class={filter === v ? 'on' : ''} data-filter={v} onClick={() => setFilter(v)}>{Variants.texts(v).name}</button>
            ))}
          </div>
        )}
        <div class="actions">
          <button type="button" class="btn" id="exampleBtn" onClick={openExamples}>{H.example}</button>
          <button type="button" class="btn" id="importBtn" onClick={importFiles}>{H.import}</button>
          <button type="button" class="btn primary" id="newBtn" onClick={() => openNewMatrix()}>+ {H.new}</button>
        </div>
      </div>
      <div class="boards" id="boards">
        {list.map(m => <MatrixCard key={m.id} m={m} />)}
        <button type="button" class="card board-new" id="newCard" onClick={() => openNewMatrix()}>
          <span class="plus" aria-hidden="true">+</span>{H.new}<small>{H.newHelp}</small>
        </button>
      </div>
      <SyncRemoteOnly />
      <LettersStrip />
    </div>
  );
}

/** @typedef {'empty' | 'template' | 'roles' | 'list'} Start */

/** @param {{ initial: VariantId }} props */
function NewMatrixDialog({ initial }) {
  const N = Texts.newDialog;
  const [variant, setVariant] = useState(initial);
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [start, setStart] = useState(/** @type {Start} */ ('empty'));
  const [tpl, setTpl] = useState(/** @type {keyof typeof Texts.templates} */ ('event'));
  const others = Store.all().filter(x => x.roles.length);
  const [from, setFrom] = useState(others.length ? others[0].id : '');
  const [list, setList] = useState('');
  const preview = Model.create({ variant });
  const vt = Variants.texts(variant);
  const create = () => {
    const d = Store.defaults();
    const m = Model.create({ name: name.trim() || vt.name, context, variant, options: d ? d.options : undefined, rules: d ? d.rules : undefined });
    if (start === 'template') Ops.applyTemplate(m, Texts.templates[tpl]);
    if (start === 'roles') { const src = Store.load(from); if (src) { Ops.copyRoles(m, src); if (src.roles.some(r => r.person)) m.options.people = true; } }
    if (start === 'list') Ops.addTaskList(m, list);
    Store.save(m);
    closeDialog();
    openMatrix(m.id);
  };
  /** @param {Start} k @param {any} extra */
  const Radio = (k, extra) => (
    <label class="radio" key={k} data-start={k}>
      <input type="radio" name="nmStart" checked={start === k} onChange={() => setStart(k)} />
      <span>{N.starts[k].label}<small>{N.starts[k].help}</small>{start === k && extra}</span>
    </label>
  );
  const letterTexts = /** @type {Record<string, { text: string }>} */ (Variants.texts(variant === 'custom' ? 'raci' : variant).letters);
  return (
    <Dialog title={N.title} wide id="newDialog">
      <p class="sub small dialog-intro">{N.intro}</p>
      <div class="pick">
        <div>
          <div class="pick-grid" role="radiogroup" aria-label={N.variant}>
            {Variants.ORDER.map(v => {
              const t = Variants.texts(v);
              const pm = Model.create({ variant: v });
              return (
                <button type="button" role="radio" aria-checked={variant === v} key={v} class={`mcard${variant === v ? ' on' : ''}${v === 'custom' ? ' custom' : ''}`} data-pick={v} onClick={() => setVariant(v)}>
                  <b>{t.name}{v === 'raci' && <span class="chip acc sm">{N.standard}</span>}</b>
                  {v !== 'custom' && <span class="ltrs">{pm.letters.map(l => <Badge key={l.key} m={pm} keys={[l.key]} size="sm" />)}</span>}
                  <span class="small sub">{t.description}</span>
                </button>
              );
            })}
          </div>
          <form class="new-form" onSubmit={e => { e.preventDefault(); create(); }}>
            <label class="field-lbl" for="nmName">{N.name}</label>
            <input class="input" id="nmName" value={name} placeholder={vt.name} onInput={e => setName(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
            <label class="field-lbl" for="nmContext">{N.context}</label>
            <input class="input" id="nmContext" value={context} placeholder={N.contextPlaceholder} onInput={e => setContext(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
            <button type="submit" hidden />
          </form>
        </div>
        <div class="pick-side">
          <h3>{fill(N.letters, { name: vt.name })}</h3>
          <dl class="def">
            {preview.letters.map(l => (
              <div key={l.key} class="def-row">
                <dt><Badge m={preview} keys={[l.key]} /></dt>
                <dd><b>{l.name}</b> – {l.meaning}<small>{letterTexts[l.key] ? letterTexts[l.key].text : ''}</small></dd>
              </div>
            ))}
          </dl>
          <h3>{N.start}</h3>
          <div class="radio-row">
            {Radio('empty', null)}
            {Radio('template', (
              <select class="input select sm" id="nmTemplate" value={tpl} onChange={e => setTpl(/** @type {any} */ (e.currentTarget).value)}>
                {Object.entries(Texts.templates).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
              </select>
            ))}
            {Radio('roles', others.length ? (
              <select class="input select sm" id="nmFrom" value={from} onChange={e => setFrom(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}>
                {others.map(x => <option key={x.id} value={x.id}>{x.name || Texts.ui.untitledMatrix}</option>)}
              </select>
            ) : <small class="sub">{N.noMatrices}</small>)}
            {Radio('list', (
              <textarea class="input" id="nmList" rows={5} value={list} placeholder={N.listPlaceholder} onInput={e => setList(/** @type {HTMLTextAreaElement} */ (e.currentTarget).value)} />
            ))}
          </div>
        </div>
      </div>
      <div class="dialog-foot">
        <span class="sub small">{N.hint}</span>
        <span class="spacer" />
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class="btn primary" id="nmCreate" onClick={create}>{N.create}</button>
      </div>
    </Dialog>
  );
}

function ExamplesDialog() {
  const list = Examples.list();
  /** @param {string} key */
  const open = key => {
    const m = Examples.load(key);
    if (!m) return;
    Store.save(m);
    closeDialog();
    openMatrix(m.id);
  };
  return (
    <Dialog title={Texts.examples.title} wide id="examplesDialog">
      <div class="dialog-body examples">
        <p class="sub">{Texts.examples.intro}</p>
        <div class="example-list">
          {list.map(({ key, matrix }) => (
            <button type="button" key={key} class="example card" data-example={key} onClick={() => open(key)}>
              <Thumb m={matrix} width={110} height={90} />
              <span class="example-text">
                <span class="method-chip">{Variants.texts(matrix.variant).name}</span>
                <b>{matrix.name}</b>
                <span class="sub small">{matrix.context}</span>
                <span class="sub small">{Util.count(matrix.tasks.length, Texts.home.tasks.one, Texts.home.tasks.many)} · {Util.count(matrix.roles.length, Texts.home.roles.one, Texts.home.roles.many)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
