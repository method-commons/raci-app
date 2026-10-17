/*
 * Dialoge zur Matrix: Einstellungen (Variante, Buchstaben, optionale Bereiche, Prüfregeln,
 * Standard für neue Matrizen), Rollen aus anderer Matrix, Aufgabenliste einfügen.
 * Änderungen in den Einstellungen wirken sofort (mit Rückgängig).
 */
import { useState } from 'preact/hooks';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { Variants } from '../variants.js';
import { Badge, Dialog, fill } from './components.jsx';
import { closeDialog, fieldProps, mutate, openDialog, toast, useMatrix } from './core.js';

/** Einstellungen der Matrix. */
export function openSettings() {
  openDialog(() => <SettingsDialog />);
}

/** Schalter mit Beschriftung. @param {{ id: string, label: string, help: string, on: boolean, disabled?: boolean, onChange: (v: boolean) => void, children?: any }} props */
function Switch({ id, label, help, on, disabled, onChange, children }) {
  return (
    <label class="opt" data-opt={id}>
      <span><b>{label}</b><small>{help}</small>{children}</span>
      <input type="checkbox" class="switch" id={`opt-${id}`} checked={on} disabled={disabled} onChange={e => onChange(/** @type {HTMLInputElement} */ (e.currentTarget).checked)} />
    </label>
  );
}

/** Bedeutungen zur Auswahl im Editor; eine andere aktuelle Bedeutung (z. B. aus RACI-VS) kommt dazu. @type {readonly LetterKind[]} */
const KIND_CHOICES = ['owner', 'exec', 'consult', 'inform', 'other'];

/**
 * Buchstaben: Liste zum Lesen, ein Buchstabe zum Bearbeiten aufgeklappt. Bei Standard-Varianten
 * nur lesen; „Buchstaben anpassen“ wechselt zu „Eigene“.
 * @param {{ m: Matrix }} props
 */
function LetterEditor({ m }) {
  const S = Texts.settings;
  const custom = m.variant === 'custom';
  const [open, setOpen] = useState(/** @type {string | null} */ (null));
  const [keyErr, setKeyErr] = useState(/** @type {string | null} */ (null));
  const toggle = (/** @type {string} */ key) => { setKeyErr(null); setOpen(open === key ? null : key); };
  /** @param {Letter} l @param {Partial<Letter>} patch */
  const update = (l, patch) => mutate(x => Ops.updateLetter(x, l.key, patch));
  return (
    <div class="letters-edit" id="letterEditor">
      <div class="letter-list">
        {m.letters.map(l => {
          const isOpen = custom && open === l.key;
          const head = <>
            <Badge m={m} keys={[l.key]} />
            <span class="letter-text"><b>{l.name || '–'}</b><small>{l.meaning || '–'}</small></span>
            <span class={`rule-chip${l.count === 'one' || l.count === 'min1' ? ' strict' : ''}`}>{S.counts[l.count]}</span>
          </>;
          return (
            <div class={`letter-item${isOpen ? ' open' : ''}`} key={l.key} data-letter={l.key}>
              {custom
                ? <button type="button" class="letter-head" aria-expanded={isOpen} aria-label={fill(S.editLetter, { key: l.key })} onClick={() => toggle(l.key)}>{head}<span class="chev" aria-hidden="true">▾</span></button>
                : <div class="letter-head">{head}</div>}
              {isOpen && <div class="letter-form">
                <div class="letter-form-two">
                  <div>
                    <label class="field-lbl" for="letterKey">{S.letterKey}</label>
                    <input class={`input key-input${keyErr != null ? ' invalid' : ''}`} id="letterKey" value={l.key} maxLength={3} aria-invalid={keyErr != null}
                      onChange={e => {
                        const el = /** @type {HTMLInputElement} */ (e.currentTarget);
                        const v = el.value;
                        if (update(l, { key: v })) { setKeyErr(null); setOpen(l.key); } else { setKeyErr(v.trim().toUpperCase()); el.value = l.key; }
                      }} />
                  </div>
                  <div>
                    <label class="field-lbl" for="letterName">{S.letterName}</label>
                    <input class="input" id="letterName" {...fieldProps(() => l.name, v => { l.name = v; })} />
                  </div>
                </div>
                {keyErr != null && <p class="field-err" id="letterKeyErr">{fill(S.keyTaken, { value: keyErr, key: l.key })}</p>}
                <div>
                  <label class="field-lbl" for="letterMeaning">{S.letterMeaning}</label>
                  <input class="input" id="letterMeaning" {...fieldProps(() => l.meaning, v => { l.meaning = v; })} />
                  <p class="sub small">{S.meaningHelp}</p>
                </div>
                <div>
                  <span class="field-lbl">{S.letterCount}</span>
                  <div class="seg full" role="group" aria-label={S.letterCount} id="letterCount">
                    {Variants.COUNTS.map(c => <button type="button" key={c} class={l.count === c ? 'on' : ''} data-count={c} aria-pressed={l.count === c} onClick={() => update(l, { count: c })}>{S.counts[c]}</button>)}
                  </div>
                  <p class="sub small">{S.countHelp}</p>
                </div>
                <div>
                  <span class="field-lbl">{S.letterColor}</span>
                  <div class="swatches" role="group" aria-label={S.letterColor} id="letterColor">
                    {Variants.COLORS.map(c => <button type="button" key={c} class={`b sw lc-${c}${l.color === c ? ' on' : ''}`} data-color={c} aria-pressed={l.color === c} title={S.colors[c]} aria-label={S.colors[c]} onClick={() => update(l, { color: c })}>{l.key}</button>)}
                  </div>
                </div>
                <div>
                  <span class="field-lbl">{S.letterKind}</span>
                  <div class="seg wrap" role="group" aria-label={S.letterKind} id="letterKind">
                    {(KIND_CHOICES.includes(l.kind) ? KIND_CHOICES : [...KIND_CHOICES.slice(0, -1), l.kind, 'other']).map(k => (
                      <button type="button" key={k} class={l.kind === k ? 'on' : ''} data-kind={k} aria-pressed={l.kind === k} onClick={() => update(l, { kind: k })}>{S.kinds[k]}</button>
                    ))}
                  </div>
                  <p class="sub small">{S.kindHelp}</p>
                </div>
                <div class="letter-preview">
                  <span class="cell-demo"><Badge m={m} keys={[l.key]} /></span>
                  <span class="small">{S.preview} · {(n => n ? fill(S.usage, { n }) : S.usageNone)(Model.usage(m, l.key))}</span>
                </div>
                <div class="letter-form-foot">
                  <button type="button" class="btn sm danger-text" id="removeLetterBtn" disabled={m.letters.length <= 1} onClick={() => { setOpen(null); mutate(x => Ops.removeLetter(x, l.key)); }}>✕ {S.removeLetter}</button>
                  <span class="spacer" />
                  <button type="button" class="btn sm" onClick={() => toggle(l.key)}>▲ {S.collapse}</button>
                </div>
              </div>}
            </div>
          );
        })}
      </div>
      {custom
        ? <button type="button" class="btn sm dashed" id="addLetterBtn" onClick={() => { const l = mutate(x => Ops.addLetter(x)); if (l) { setKeyErr(null); setOpen(l.key); } }}>{S.addLetter}</button>
        : <div class="letters-customize"><button type="button" class="btn sm" id="customizeLetters" onClick={() => mutate(x => Ops.setVariant(x, 'custom'))}>✎ {S.customize}</button><span class="sub small">{S.customizeHelp}</span></div>}
    </div>
  );
}

function SettingsDialog() {
  const m = useMatrix();
  if (!m) return null;
  const S = Texts.settings;
  const opts = /** @type {(keyof MatrixOptions)[]} */ (['phases', 'combined', 'people', 'notes', 'plan', 'external']);
  const consult = m.letters.find(l => l.kind === 'consult');
  const min1 = m.letters.filter(l => l.count === 'min1').map(l => l.key).join(', ');
  return (
    <Dialog title={S.title} wide id="settingsDialog">
      <div class="settings">
        <div class="settings-col">
          <h3>{S.general}</h3>
          <label class="field-lbl" for="setName">{Texts.matrix.name}</label>
          <input class="input" id="setName" {...fieldProps(() => m.name, v => { m.name = v; })} />
          <label class="field-lbl" for="setContext">{Texts.matrix.context}</label>
          <input class="input" id="setContext" {...fieldProps(() => m.context, v => { m.context = v; })} />
          <h3 class="mt">{S.variant}</h3>
          <div class="seg wrap" role="group" aria-label={S.variant} id="variantSeg">
            {Variants.ORDER.map(v => (
              <button type="button" key={v} class={m.variant === v ? 'on' : ''} data-variant={v} onClick={() => mutate(x => Ops.setVariant(x, v))}>{Variants.texts(v).name}</button>
            ))}
          </div>
          <p class="sub small">{S.variantHelp}</p>
          <h3 class="mt">{S.letters}</h3>
          <LetterEditor m={m} />
          <h3 class="mt">{S.options}</h3>
          {opts.map(k => <Switch key={k} id={k} label={S.opt[k].label} help={S.opt[k].help} on={m.options[k]} onChange={v => mutate(x => Ops.setOption(x, k, v))} />)}
        </div>
        <div class="settings-col alt">
          <h3>{S.rules}</h3>
          <Switch id="count" label={S.rule.count.label} help={S.rule.count.help} on disabled onChange={() => {}} />
          <Switch id="minExec" label={S.rule.minExec.label + (min1 ? ` (${min1})` : '')} help={S.rule.minExec.help} on={m.rules.minExec} onChange={v => mutate(x => Ops.setRule(x, 'minExec', v))} />
          <Switch id="manyConsult" label={S.rule.manyConsult.label.replace(/\bC\b/, consult ? consult.key : 'C')} help={S.rule.manyConsult.help} on={m.rules.manyConsult > 0} onChange={v => mutate(x => Ops.setRule(x, 'manyConsult', v ? 5 : 0))}>
            {m.rules.manyConsult > 0 && <input type="number" class="input num-input" id="manyConsultN" min={2} max={50} value={m.rules.manyConsult} onChange={e => { const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value); mutate(x => Ops.setRule(x, 'manyConsult', Math.max(2, v))); }} />}
          </Switch>
          <Switch id="bottleneck" label={S.rule.bottleneck.label} help={S.rule.bottleneck.help} on={m.rules.bottleneck > 0} onChange={v => mutate(x => Ops.setRule(x, 'bottleneck', v ? 80 : 0))}>
            {m.rules.bottleneck > 0 && <span class="num-wrap"><input type="number" class="input num-input" id="bottleneckN" min={10} max={100} step={5} value={m.rules.bottleneck} onChange={e => { const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value); mutate(x => Ops.setRule(x, 'bottleneck', Math.max(10, v))); }} /> %</span>}
          </Switch>
          <Switch id="emptyRole" label={S.rule.emptyRole.label} help={S.rule.emptyRole.help} on={m.rules.emptyRole} onChange={v => mutate(x => Ops.setRule(x, 'emptyRole', v))} />
          <Switch id="verb" label={S.rule.verb.label} help={S.rule.verb.help} on={m.rules.verb} onChange={v => mutate(x => Ops.setRule(x, 'verb', v))} />
          <p class="hint">{S.keepHint}</p>
        </div>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn sm" id="saveDefault" onClick={() => { Store.saveDefaults({ options: m.options, rules: m.rules }); toast(S.savedDefault); }}>{S.asDefault}</button>
        <span class="spacer" />
        <button type="button" class="btn primary" id="settingsDone" onClick={closeDialog}>{Texts.ui.done}</button>
      </div>
    </Dialog>
  );
}

/** Rollen aus einer anderen Matrix übernehmen. */
export function openCopyRoles() {
  openDialog(() => <CopyRolesDialog />);
}

function CopyRolesDialog() {
  const m = useMatrix();
  const C = Texts.copyRoles;
  const list = Store.all().filter(x => m && x.id !== m.id && x.roles.length);
  return (
    <Dialog title={C.title} id="copyRolesDialog">
      <div class="dialog-body">
        <p class="sub">{list.length ? C.intro : C.none}</p>
        <div class="pick-list">
          {list.map(x => (
            <button type="button" key={x.id} class="pick-item" data-from={x.id} onClick={() => {
              const n = mutate(y => { const k = Ops.copyRoles(y, x); if (k && x.roles.some(r => r.person)) y.options.people = true; return k; });
              closeDialog();
              toast(fill(C.copied, { n: n || 0 }));
            }}>
              <b>{x.name || Texts.ui.untitledMatrix}</b>
              <span class="sub small">{x.roles.map(r => r.name).join(', ')}</span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/** Aufgabenliste einfügen. */
export function openTaskList() {
  openDialog(() => <TaskListDialog />);
}

function TaskListDialog() {
  const [text, setText] = useState('');
  const L = Texts.taskList;
  const add = () => {
    const n = mutate(m => Ops.addTaskList(m, text));
    closeDialog();
    toast(fill(L.added, { n: n || 0 }));
  };
  return (
    <Dialog title={L.title} id="taskListDialog">
      <div class="dialog-body">
        <p class="sub small">{L.intro}</p>
        <textarea class="input" id="taskListText" rows={10} value={text} placeholder={Texts.newDialog.listPlaceholder} onInput={e => setText(/** @type {HTMLTextAreaElement} */ (e.currentTarget).value)} />
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class="btn primary" id="taskListAdd" disabled={!text.trim()} onClick={add}>{L.add}</button>
      </div>
    </Dialog>
  );
}
