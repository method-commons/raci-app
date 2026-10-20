/*
 * Zustand der Oberfläche: Route (Hash), geöffnete Matrix, Speichern, Rückgängig/Wiederholen,
 * Auswahl (Zelle, Rolle), Ansichtszustand, Dialoge, Meldungen.
 *
 * Regeln für Änderungen:
 *  - Strukturelle Änderungen laufen über `mutate(fn)` (Verlaufseintrag, Speichern, Neuzeichnen).
 *  - Texteingaben über `fieldProps(get, set)`: Änderung sofort sichtbar, Verlaufseintrag beim
 *    Verlassen des Felds.
 *
 * Die Matrix ist ein normales Objekt, das `Ops` direkt ändert; das Signal `revision` zählt
 * Änderungen, Komponenten lesen es über `useMatrix()` und zeichnen dadurch neu.
 */
import { signal } from '@preact/signals';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';

/** Zähler für Änderungen; Komponenten lesen ihn, um neu zu zeichnen. */
export const revision = signal(0);

/** @typedef {'matrix' | 'roles' | 'people' | 'report'} Tab */
/** @typedef {{ view: 'home' } | { view: 'matrix', mid: string, tab: Tab }} Route */

/** @type {readonly Tab[]} */
export const TABS = ['matrix', 'roles', 'people', 'report'];

/** Hash → Route. @param {string} hash @returns {Route} */
export function parseHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'm' && parts[1]) {
    const tab = /** @type {Tab} */ (TABS.includes(/** @type {Tab} */ (parts[2])) ? parts[2] : 'matrix');
    return { view: 'matrix', mid: parts[1], tab };
  }
  return { view: 'home' };
}

/** Route → Hash. @param {Route} r */
export function hashOf(r) {
  return r.view === 'matrix' ? `#/m/${encodeURIComponent(r.mid)}/${r.tab}` : '#/';
}

/** Aktuelle Route. */
export const route = signal(parseHash(typeof location !== 'undefined' ? location.hash : ''));

/** Zur Route wechseln (neuer Verlaufseintrag im Browser). @param {Route} r */
export function go(r) {
  const h = hashOf(r);
  if (location.hash !== h) location.hash = h;
  else applyRoute();
}

/** Matrix öffnen. @param {string} mid @param {Tab} [tab] */
export function openMatrix(mid, tab = 'matrix') {
  go({ view: 'matrix', mid, tab });
}

/** Geöffnete Matrix (oder `null` auf der Startseite). @type {Matrix | null} */
export let matrix = null;
/** @type {string[]} */
let undoStack = [];
/** @type {string[]} */
let redoStack = [];
const HISTORY_LIMIT = 200;

/** Route aus dem Hash übernehmen und die passende Matrix laden. */
export function applyRoute() {
  const r = parseHash(location.hash);
  if (preview && !(r.view === 'matrix' && r.mid === matrix?.id)) endPreview(); // anderes Dokument: Ansehen beenden
  if (r.view === 'matrix') {
    if (!matrix || matrix.id !== r.mid) {
      flushSave();
      matrix = Store.load(r.mid);
      undoStack = [];
      redoStack = [];
      clearSelection();
    }
    if (!matrix) { location.replace('#/'); route.value = { view: 'home' }; render(); return; }
  } else {
    flushSave();
    matrix = null;
    clearSelection();
  }
  route.value = r;
  render();
}

/** Neu zeichnen. */
export function render() {
  revision.value++;
}

/**
 * Für Komponenten: geöffnete Matrix – und bei jeder Änderung neu zeichnen.
 * @returns {Matrix}
 */
export function useMatrix() {
  revision.value;
  return /** @type {Matrix} */ (matrix);
}

/** Für Komponenten, die nur neu zeichnen müssen (z. B. Startseite). */
export function useRevision() {
  return revision.value;
}

// ===== Speichern =====
/** @type {ReturnType<typeof setTimeout> | null} */
let saveTimer = null;

/** Gleich speichern (nach kurzer Pause gebündelt). */
export function scheduleSave() {
  if (preview) return; // früherer Stand: nur ansehen
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

/** Gibt es Eingaben, die noch nicht gespeichert sind (verzögertes Speichern läuft)? */
export const hasPendingSave = () => saveTimer != null;

/** Ausstehendes Speichern sofort ausführen. */
export function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  if (matrix && !Store.save(matrix)) toast(storageFailedText);
}

/** Geöffnete Matrix verwerfen, ohne sie zu speichern (nach dem Löschen). */
export function discardMatrix() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  editSnapshot = null;
  matrix = null;
}

let storageFailedText = 'Speichern fehlgeschlagen';
/** Text der Meldung bei vollem Speicher (aus den Sprachdateien). @param {string} t */
export function setStorageFailedText(t) { storageFailedText = t; }

/** Matrix neu setzen (z. B. nach Änderung in einem anderen Browser-Tab). @param {Matrix} m */
export function replaceMatrix(m) {
  matrix = m;
  checkSelection();
  render();
}

/**
 * Gespeicherten Stand übernehmen, nachdem ein anderer Browser-Tab (oder die Ablage) die Matrix
 * geändert hat: geöffnete Matrix neu laden – außer während einer Texteingabe –, sonst die Übersicht.
 * `force`: auch während einer Texteingabe (die Ablage übernimmt nur ohne ungespeicherte Eingaben).
 * @param {string} id @param {boolean} [force]
 */
export function adoptStored(id, force = false) {
  if (matrix && matrix.id === id) {
    const doc = Store.load(id);
    if (!doc) { applyRoute(); return; }
    if (preview) { preview.saved = doc; return; } // gilt nach dem Ansehen
    const active = document.activeElement;
    if (!force && active && /^(INPUT|TEXTAREA)$/.test(active.tagName)) return;
    replaceMatrix(doc);
  } else if (route.value.view === 'home') {
    render();
  }
}

// ===== Früherer Stand (Versionen der Ablage) =====
/** Wird ein früherer Stand angesehen? Dann ist der aktuelle in `saved` geparkt. @type {{ saved: any } | null} */
let preview = null;
/** Meldung bei gesperrtem Bearbeiten und Ende des Ansehens (aus sync.jsx). */
let previewHooks = { locked: '', ended: () => {} };
/** @param {{ locked: string, ended: () => void }} hooks */
export function setPreviewHooks(hooks) { previewHooks = hooks; }
export const isPreview = () => preview !== null;

/** Bearbeiten ist gesperrt, solange ein früherer Stand gezeigt wird (mit Hinweis). */
function blockedByPreview() {
  if (!preview) return false;
  toast(previewHooks.locked);
  render();
  return true;
}

/** Früheren Stand des geöffneten Dokuments nur lesend zeigen. @param {any} data */
export function showPreview(data) {
  if (!matrix) return;
  commitEdit();
  flushSave();
  preview ??= { saved: matrix };
  replaceMatrix(data);
}

/** Zurück zum aktuellen Stand (auch vor dem Wechsel zu einem anderen Dokument). */
export function endPreview() {
  if (!preview || !matrix) { preview = null; return; }
  const saved = Store.load(matrix.id) ?? preview.saved;
  preview = null;
  replaceMatrix(saved);
  previewHooks.ended();
}

// ===== Änderungen und Verlauf =====
/** Stand vor einer Texteingabe (Verlaufseintrag beim Verlassen des Felds). @type {string | null} */
let editSnapshot = null;

/** @param {string} snap */
function pushUndo(snap) {
  undoStack.push(snap);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
}

/**
 * Strukturelle Änderung an der geöffneten Matrix.
 * @template T
 * @param {(m: Matrix) => T} fn
 * @returns {T | undefined}
 */
export function mutate(fn) {
  if (!matrix) return undefined;
  if (blockedByPreview()) return undefined;
  commitEdit();
  const before = JSON.stringify(matrix);
  const result = fn(matrix);
  if (JSON.stringify(matrix) !== before) {
    Ops.touch(matrix);
    pushUndo(before);
    scheduleSave();
  }
  render();
  return result;
}

/** Laufende Texteingabe als Verlaufseintrag abschließen. */
export function commitEdit() {
  if (editSnapshot == null || !matrix) return;
  const snap = editSnapshot;
  editSnapshot = null;
  if (snap !== JSON.stringify({ ...matrix, updatedAt: JSON.parse(snap).updatedAt })) pushUndo(snap);
  flushSave();
}

/**
 * Eigenschaften für ein Eingabefeld: Änderung sofort, Verlauf beim Verlassen.
 * @param {() => string} get @param {(v: string) => void} set
 */
export function fieldProps(get, set) {
  return {
    value: get(),
    onFocus: () => { if (matrix && editSnapshot == null) editSnapshot = JSON.stringify(matrix); },
    /** @param {Event} e */
    // früherer Stand: Tippen gar nicht erst zulassen
    /** @param {Event} e */
    onBeforeInput: e => { if (preview) { e.preventDefault(); blockedByPreview(); } },
    /** @param {Event} e */
    onInput: e => {
      if (!matrix || preview) return;
      if (editSnapshot == null) editSnapshot = JSON.stringify(matrix);
      set(/** @type {HTMLInputElement} */ (e.currentTarget).value);
      Ops.touch(matrix);
      scheduleSave();
      render();
    },
    onBlur: commitEdit,
  };
}

export const canUndo = () => undoStack.length > 0 || editSnapshot != null;
export const canRedo = () => redoStack.length > 0;

export function undo() {
  if (blockedByPreview()) return;
  commitEdit();
  if (!matrix || !undoStack.length) return;
  redoStack.push(JSON.stringify(matrix));
  matrix = JSON.parse(/** @type {string} */ (undoStack.pop()));
  afterHistory();
}

export function redo() {
  if (blockedByPreview()) return;
  commitEdit();
  if (!matrix || !redoStack.length) return;
  undoStack.push(JSON.stringify(matrix));
  matrix = JSON.parse(/** @type {string} */ (redoStack.pop()));
  afterHistory();
}

function afterHistory() {
  checkSelection();
  scheduleSave();
  render();
}

// ===== Ansichtszustand =====
/** Gewählte Zelle (Aufgabe und Rolle). @type {import('@preact/signals').Signal<{ task: string, role: string } | null>} */
export const selectedCell = signal(null);

/** Gewählte Rolle (Ansicht „Rollen“). @type {import('@preact/signals').Signal<string | null>} */
export const selectedRole = signal(null);

/** Markierte Aufgaben bzw. Rollen (aus einem Hinweis). @type {import('@preact/signals').Signal<{ tasks: string[], roles: string[], key: string }>} */
export const highlighted = signal({ tasks: [], roles: [], key: '' });

/**
 * Ansicht: Stand bei Ist/Soll, „Wer macht was?“ je Rolle oder Person, leere Gruppen.
 * @type {import('@preact/signals').Signal<{ mode: PlanMode | 'compare', peopleBy: 'role' | 'person', hideEmpty: boolean }>}
 */
export const viewPrefs = signal({ mode: 'compare', peopleBy: 'role', hideEmpty: false });

/** Stand, den Ansicht und Prüfung gerade zeigen (Ist oder Soll). @param {Matrix} m @returns {PlanMode} */
export function viewMode(m) {
  if (!m.options.plan) return 'ist';
  return viewPrefs.value.mode === 'ist' ? 'ist' : 'soll';
}

/** Auswahl und Markierungen zurücksetzen. */
function clearSelection() {
  selectedCell.value = null;
  selectedRole.value = null;
  highlighted.value = { tasks: [], roles: [], key: '' };
}

/** Auswahl verwerfen, die es nicht mehr gibt (nach Rückgängig, Änderung im anderen Tab). */
function checkSelection() {
  const m = matrix;
  if (!m) return;
  const c = selectedCell.value;
  if (c && (!m.tasks.some(t => t.id === c.task) || !m.roles.some(r => r.id === c.role))) selectedCell.value = null;
  if (selectedRole.value && !m.roles.some(r => r.id === selectedRole.value)) selectedRole.value = null;
}

// ===== Meldungen und Dialoge =====
/** @typedef {{ id: number, text: string, action?: { label: string, run: () => void } }} Toast */
/** @type {import('@preact/signals').Signal<Toast[]>} */
export const toasts = signal([]);
let toastId = 0;

/** Kurze Meldung unten. @param {string} text @param {Toast['action']} [action] */
export function toast(text, action) {
  const t = { id: ++toastId, text, action };
  toasts.value = [...toasts.value, t];
  setTimeout(() => { toasts.value = toasts.value.filter(x => x.id !== t.id); }, action ? 6000 : 3500);
}

/** Geöffneter Dialog: Funktion, die den Inhalt zeichnet. @type {import('@preact/signals').Signal<null | (() => import('preact').JSX.Element)>} */
export const dialog = signal(null);

/** @param {() => import('preact').JSX.Element} content */
export function openDialog(content) {
  commitEdit();
  dialog.value = content;
}

export function closeDialog() {
  dialog.value = null;
}
