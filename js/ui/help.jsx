/*
 * Methodik-Hilfe: RACI-Methode, Vorgehen, Varianten, Prüfen, Ist/Soll und Bedienung – als
 * Dialog mit Reitern.
 */
import { useState } from 'preact/hooks';
import { Texts } from '../texts.js';
import { Dialog } from './components.jsx';
import { openDialog } from './core.js';

/** @typedef {keyof typeof Texts.help.sections} Section */

/** @param {Section} [section] */
export function openHelp(section = 'method') {
  openDialog(() => <Help initial={section} />);
}

/** @param {{ initial: Section }} props */
function Help({ initial }) {
  const [sec, setSec] = useState(initial);
  const S = Texts.help.sections;
  const keys = /** @type {Section[]} */ (Object.keys(S));
  const s = S[sec];
  return (
    <Dialog title={Texts.help.title} wide id="helpDialog">
      <div class="help">
        <nav class="help-nav" role="tablist" aria-label={Texts.help.title}>
          {keys.map(k => (
            <button type="button" role="tab" key={k} aria-selected={sec === k} class={sec === k ? 'on' : ''} data-help={k} onClick={() => setSec(k)}>{S[k].title}</button>
          ))}
        </nav>
        <div class="help-body" role="tabpanel">
          <h2>{s.title}</h2>
          {s.paras.map((x, i) => <p key={i}>{x}</p>)}
          {s.list.length > 0 && <ul>{s.list.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
      </div>
    </Dialog>
  );
}
