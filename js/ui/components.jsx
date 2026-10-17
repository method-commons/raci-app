/*
 * Kleine, wiederverwendbare Bausteine der Oberfläche: Dialog, Bestätigungsdialog, Buchstaben,
 * Hinweise, Personen-Kreis, Logo, Herunterladen und Datei öffnen.
 */
import { useLayoutEffect, useRef } from 'preact/hooks';
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Util } from '../util.js';
import { closeDialog, highlighted, openDialog } from './core.js';

/** Text mit Platzhaltern. @param {string} text @param {Record<string, string | number>} [params] */
export const fill = (text, params) => Util.fill(text, params);

/**
 * Dialog über der Seite. Escape und Klick auf den Hintergrund schließen; der Fokus landet
 * im ersten Eingabefeld bzw. Knopf.
 * @param {{ title: string, children: any, wide?: boolean, id?: string, onClose?: () => void }} props
 */
export function Dialog({ title, children, wide, id, onClose = closeDialog }) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  // Layout-Effekte laufen direkt nach dem Zeichnen: Ein Escape gleich nach dem Öffnen
  // (bevor der Browser neu malt) darf nicht verloren gehen.
  useLayoutEffect(() => {
    const prev = /** @type {HTMLElement | null} */ (document.activeElement);
    const el = ref.current;
    const first = /** @type {HTMLElement | null} */ (el && el.querySelector('[autofocus], input:not([type=checkbox]):not([type=radio]), textarea, select, .dialog-body button, .dialog-foot button'));
    if (first) first.focus();
    else if (el) el.focus();
    return () => { if (prev && document.contains(prev)) prev.focus(); };
  }, []);
  // Escape schließt auch, wenn der Fokus (noch) nicht im Dialog liegt
  useLayoutEffect(() => {
    /** @param {KeyboardEvent} e */
    const esc = e => { if (e.key === 'Escape' && !(ref.current && ref.current.contains(/** @type {Node} */ (e.target)))) onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  /** @param {KeyboardEvent} e */
  const onKey = e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab' && ref.current) {
      const items = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(x => !(/** @type {HTMLButtonElement} */ (x).disabled));
      const first = /** @type {HTMLElement} */ (items[0]);
      const last = /** @type {HTMLElement} */ (items[items.length - 1]);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  return (
    <div class="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} id={id} ref={ref} tabIndex={-1} onKeyDown={onKey}>
        <div class="dialog-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label={Texts.ui.close} title={Texts.ui.close} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Rückfrage mit „Abbrechen“ und einer Aktion.
 * @param {{ title: string, text: string, ok: string, danger?: boolean, onOk: () => void }} opts
 */
export function confirmDialog({ title, text, ok, danger, onOk }) {
  openDialog(() => (
    <Dialog title={title} id="confirmDialog">
      <div class="dialog-body"><p>{text}</p></div>
      <div class="dialog-foot">
        <button type="button" class="btn" onClick={closeDialog}>{Texts.ui.cancel}</button>
        <button type="button" class={`btn ${danger ? 'danger' : 'primary'}`} id="confirmOk" onClick={() => { closeDialog(); onOk(); }}>{ok}</button>
      </div>
    </Dialog>
  ));
}

/**
 * Buchstaben einer Zelle als Kennzeichen („A“, „A/R“); unbekannte Kürzel gestrichelt.
 * @param {{ m: Matrix, keys: string[], size?: 'sm' | 'lg', old?: boolean, question?: boolean }} props
 */
export function Badge({ m, keys, size, old, question }) {
  if (!keys.length) return null;
  const letters = keys.map(k => Model.letter(m, k));
  const cls = ['b', size || '', old ? 'old' : '', question ? 'qm' : ''].filter(Boolean);
  if (letters.some(l => !l)) return <i class={[...cls, 'unknown'].join(' ')} title={Model.label(keys)}>{Model.label(keys)}</i>;
  const ls = /** @type {Letter[]} */ (letters);
  if (ls.length === 1) return <i class={[...cls, `lc-${ls[0].color}`].join(' ')} title={`${ls[0].key} – ${ls[0].name}`}>{ls[0].key}</i>;
  const stops = ls.map((l, i) => `var(--lc-${l.color}) ${(i * 100) / ls.length}% ${((i + 1) * 100) / ls.length}%`).join(', ');
  return <i class={[...cls, 'multi'].join(' ')} style={{ background: `linear-gradient(135deg, ${stops})` }} title={ls.map(l => `${l.key} – ${l.name}`).join(', ')}>{Model.label(keys)}</i>;
}

/** Legende der Buchstaben. @param {{ m: Matrix, long?: boolean }} props */
export function Legend({ m, long }) {
  return (
    <div class="legend letters-legend">
      {m.letters.map(l => <span key={l.key}><Badge m={m} keys={[l.key]} size="sm" /> {long ? `${l.name} – ` : ''}{l.meaning || l.name}</span>)}
    </div>
  );
}

const ICON = { ok: '✓', warn: '!', bad: '✗', open: '–' };

/**
 * Prüfpunkte. Klick auf einen Punkt mit Aufgaben bzw. Rollen markiert diese in der Matrix.
 * @param {{ hints: Hint[] }} props
 */
export function HintList({ hints }) {
  return (
    <div class="hint-list">
      {hints.map(h => {
        const n = (h.tasks || []).length + (h.roles || []).length;
        const on = n > 0 && highlighted.value.key === h.key;
        return (
          <div class={`chk${n ? ' clickable' : ''}${on ? ' on' : ''}`} key={h.key} data-hint={h.key} data-state={h.state}
            role={n ? 'button' : undefined} tabIndex={n ? 0 : undefined} aria-pressed={n ? on : undefined}
            onClick={() => { if (n) highlighted.value = on ? { tasks: [], roles: [], key: '' } : { tasks: h.tasks || [], roles: h.roles || [], key: h.key }; }}
            onKeyDown={e => { if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); /** @type {HTMLElement} */ (e.currentTarget).click(); } }}>
            <span class={`ic ic-${h.state}`} aria-hidden="true">{ICON[h.state]}</span>
            <div><b>{h.title}</b><p>{h.detail}</p></div>
          </div>
        );
      })}
    </div>
  );
}

/** Ring mit Anteil (z. B. eindeutige Aufgaben). @param {{ value: number, total: number, label: string, tone?: string }} props */
export function Ring({ value, total, label, tone }) {
  const p = total ? Math.round((value * 100) / total) : 0;
  const color = tone || (total && value === total ? 'var(--good)' : 'var(--warn)');
  return <div class="ring" style={{ background: `conic-gradient(${color} 0 ${p}%, var(--surface-3) 0)` }}><b>{label}</b></div>;
}

/** Text als Datei herunterladen. @param {string | Blob} data @param {string} name @param {string} type */
export function download(data, name, type) {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Datei auswählen und als Text lesen. @param {string} accept @returns {Promise<{ name: string, text: string } | null>} */
export function pickFile(accept) {
  // Ein verstecktes Feld für alle Aufrufe; der Wert wird zurückgesetzt, damit dieselbe Datei erneut geht
  let input = /** @type {HTMLInputElement | null} */ (document.getElementById('filePicker'));
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'filePicker';
    input.hidden = true;
    document.body.appendChild(input);
  }
  const el = input;
  el.accept = accept;
  el.value = '';
  return new Promise(resolve => {
    el.onchange = async () => {
      const file = el.files && el.files[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    };
    el.oncancel = () => resolve(null);
    el.click();
  });
}

/** Zeilen des Logos: je Aufgabe drei Rollen, genau eine kräftig (A), eine halb (R). */
const LOGO_ROWS = [['R', 'A', 'I'], ['A', 'C', 'R'], ['I', 'R', 'A']];
const LOGO_OPACITY = /** @type {Record<string, number>} */ ({ A: 1, R: 0.5 });

/**
 * Logo „Aufgabenzeilen“: drei Aufgaben als Balken, rechts je drei Rollen-Zellen, in jeder
 * Zeile genau eine kräftige – die Kernregel der Methode. Farbe aus `currentColor` auf dem
 * Quadrat `.logo` (Entwurf: docs/mockups/logo.html, Variante G).
 */
export function Logo() {
  return (
    <svg class="logo" viewBox="0 0 32 32" aria-hidden="true" style={{ width: '28px', height: '28px' }}>
      {LOGO_ROWS.map((keys, r) => {
        const y = 7.6 + r * 6.4;
        return (
          <g key={r} fill="currentColor">
            <rect x="5.5" y={y} width="8" height="4.4" rx="2.2" opacity=".85" />
            {keys.map((k, c) => <rect key={c} x={15.6 + c * 4.1} y={y} width="3.3" height="4.4" rx="1" opacity={LOGO_OPACITY[k] ?? 0.2} />)}
          </g>
        );
      })}
    </svg>
  );
}

/** Kreis mit Initialen (Farbe aus dem Namen). @param {{ name: string, sm?: boolean }} props */
export function Avatar({ name, sm }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return <span class={`avatar${sm ? ' sm' : ''}`} style={{ background: AVATAR_COLORS[h] }} aria-hidden="true" title={name}>{Util.initials(name)}</span>;
}

const AVATAR_COLORS = ['#4f46e5', '#0e7490', '#f08c00', '#2b8a3e', '#d6336c', '#7c3aed', '#1864ab', '#c2410c'];
