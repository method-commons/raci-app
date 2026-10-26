/*
 * Reihenfolge der Aufgaben: Ziehen am Griff ⠿ (Tabelle und mobile Liste) und Alt+↑/↓.
 * Das Ziel ergibt sich aus der Zeigerposition über den Elementen des Containers `[data-dnd-root]`:
 * Aufgaben (`data-dnd-task`, `data-dnd-phase`) – obere Hälfte davor, untere danach – und
 * Phasenköpfe (`data-dnd-head`) – an den Anfang der Phase. Markiert wird per Klasse direkt am
 * Element, abgelegt über `Ops.moveTaskTo`.
 */
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Texts } from '../texts.js';
import { fill } from './components.jsx';
import { matrix, mutate } from './core.js';

/** @typedef {{ phase: string, before: string | null, el: HTMLElement, cls: string }} DropTarget */

/** Abstand zum Fensterrand, ab dem beim Ziehen gescrollt wird (px). */
const EDGE = 56;

/**
 * Ziel an der Höhe `y`.
 * @param {HTMLElement} root @param {number} y @returns {DropTarget | null}
 */
function targetAt(root, y) {
  const list = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-dnd-task], [data-dnd-head]')]).filter(el => el.getBoundingClientRect().height > 0);
  if (!list.length) return null;
  let i = 0;
  list.forEach((el, k) => { if (el.getBoundingClientRect().top <= y) i = k; });
  const el = list[i];
  const ds = el.dataset;
  const next = list[i + 1];
  if (ds.dndHead != null) {
    const before = next && next.dataset.dndTask != null && (next.dataset.dndPhase || '') === ds.dndHead ? next.dataset.dndTask : null;
    return { phase: ds.dndHead, before, el, cls: 'drop-after' };
  }
  const phase = ds.dndPhase || '';
  const r = el.getBoundingClientRect();
  if (y < r.top + r.height / 2) return { phase, before: ds.dndTask || null, el, cls: 'drop-before' };
  const before = next && next.dataset.dndTask != null && (next.dataset.dndPhase || '') === phase ? next.dataset.dndTask : null;
  return { phase, before, el, cls: 'drop-after' };
}

/** Matrix mit kopierten Aufgaben, zum Ausprobieren einer Verschiebung. @param {Matrix} m @returns {Matrix} */
const trial = m => ({ ...m, tasks: m.tasks.map(x => ({ ...x })) });

/** Lässt sich die Aufgabe nach oben (-1) bzw. unten (1) verschieben? @param {Matrix} m @param {string} id @param {-1 | 1} dir */
export function canMoveTask(m, id, dir) {
  return Ops.moveTask(trial(m), id, dir);
}

/**
 * Text des Hinweises beim Ziehen: neue Nummer, bei anderer Phase auch deren Name.
 * @param {string} id @param {DropTarget} t
 */
function tipText(id, t) {
  if (!matrix) return '';
  const copy = trial(matrix);
  Ops.moveTaskTo(copy, id, t.phase, t.before);
  const no = Model.numbers(copy)[id];
  const from = matrix.tasks.find(x => x.id === id);
  const p = matrix.options.phases && from && from.phase !== t.phase ? matrix.phases.find(x => x.id === t.phase) : null;
  if (p) return fill(Texts.matrix.dragToPhase, { phase: p.name || Texts.ui.untitledPhase, no });
  return fill(Texts.matrix.dragTo, { no });
}

/**
 * Ziehen am Griff beginnen (pointerdown). Erst ab ein paar Pixeln Bewegung wird gezogen;
 * Escape bricht ab.
 * @param {PointerEvent} e @param {string} id
 */
export function startTaskDrag(e, id) {
  if (e.button !== 0) return;
  const handle = /** @type {HTMLElement} */ (e.currentTarget);
  const root = /** @type {HTMLElement | null} */ (handle.closest('[data-dnd-root]'));
  const src = /** @type {HTMLElement | null} */ (handle.closest('[data-dnd-task]'));
  if (!root || !src) return;
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  const startY = e.clientY;
  let y = e.clientY;
  let x = e.clientX;
  let dragging = false;
  /** @type {DropTarget | null} */
  let target = null;
  /** @type {HTMLElement | null} */
  let tip = null;
  let frame = 0;

  const unmark = () => { if (target) target.el.classList.remove('drop-before', 'drop-after'); };
  const update = () => {
    const t = targetAt(root, y);
    if (!t || !target || t.el !== target.el || t.cls !== target.cls) {
      unmark();
      target = t;
      if (target) target.el.classList.add(target.cls);
    }
    if (tip && target) {
      tip.textContent = tipText(id, target);
      tip.style.left = `${x + 14}px`;
      tip.style.top = `${y + 14}px`;
    }
  };
  // am Fensterrand weiterscrollen
  const tick = () => {
    const dy = y < EDGE ? -12 : y > innerHeight - EDGE ? 12 : 0;
    if (dy) { scrollBy(0, dy); update(); }
    frame = requestAnimationFrame(tick);
  };
  /** @param {PointerEvent} ev */
  const onMove = ev => {
    y = ev.clientY;
    x = ev.clientX;
    if (!dragging && Math.abs(y - startY) < 4) return;
    if (!dragging) {
      dragging = true;
      src.classList.add('dragging');
      tip = document.createElement('div');
      tip.className = 'drag-tip';
      document.body.append(tip);
      frame = requestAnimationFrame(tick);
    }
    update();
  };
  /** @param {boolean} drop */
  const end = drop => {
    cancelAnimationFrame(frame);
    unmark();
    src.classList.remove('dragging');
    if (tip) tip.remove();
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onCancel);
    removeEventListener('keydown', onKey, true);
    const t = target;
    if (drop && dragging && t) mutate(m => Ops.moveTaskTo(m, id, t.phase, t.before));
  };
  const onUp = () => end(true);
  const onCancel = () => end(false);
  /** @param {KeyboardEvent} ev */
  const onKey = ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); end(false); } };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onCancel);
  addEventListener('keydown', onKey, true);
}

/**
 * Alt+↑/↓ (auf dem Griff auch ohne Alt): Aufgabe verschieben und danach `refocus` aufrufen.
 * Gibt zurück, ob die Taste verarbeitet wurde.
 * @param {KeyboardEvent} e @param {string} id @param {() => void} refocus @param {boolean} [plain] auch ohne Alt
 */
export function moveTaskByKey(e, id, refocus, plain = false) {
  if (e.ctrlKey || e.metaKey || e.shiftKey || (!e.altKey && !plain)) return false;
  const dir = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
  if (!dir) return false;
  e.preventDefault();
  mutate(m => Ops.moveTask(m, id, dir));
  refocus();
  return true;
}
