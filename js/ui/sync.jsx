/*
 * Ablage (method-commons/sync): Bindeglied zwischen App und gemeinsamem Sync-Kern.
 * Der Kern samt Oberfläche wird erst geladen, wenn eine Ablage eingerichtet ist oder jemand
 * „Ablage …“ wählt – ohne Ablage bleibt die App wie bisher (nur der Menüeintrag ist neu).
 */
import { CONFIG_KEY, hasConfig } from '@method-commons/sync/config';
import { signal } from '@preact/signals';
import { Model } from '../model.js';
import { Ops } from '../ops.js';
import { Store } from '../storage.js';
import { Languages, Texts } from '../texts.js';
import { adoptStored, endPreview, hasPendingSave, isPreview, matrix, openMatrix, render, setPreviewHooks, showPreview, showShared, toast } from './core.js';

/** Kennung der App in der Ablage = Name des Repos (zugleich Ordner). */
export const SYNC_APP = 'raci-app';

/** Oberfläche aus `@method-commons/sync/ui`, sobald geladen. @type {import('@preact/signals').Signal<any>} */
const syncUi = signal(null);
/** @type {any} SyncController */
let controller = null;
/** @type {Promise<any> | null} */
let loading = null;
/** Die Ablage schreibt gerade selbst (Übernahme) – nicht als eigene Änderung melden. */
let pulling = false;

/** @param {number} n @param {{ one: string, many: string }} w */
const count = (n, w) => `${n} ${n === 1 ? w.one : w.many}`;

/** Matrix für die Ablage: Speicherschicht der App, Prüfung mit `Model.normalize`. */
const adapter = {
  app: SYNC_APP,
  schemaVersion: Model.SCHEMA_VERSION,
  list: () => Store.listDocs(),
  /** @param {string} id */
  read: id => Store.readDoc(id),
  /**
   * Stand aus der Ablage übernehmen. Abgelehnt, solange die geöffnete Matrix ungespeicherte Eingaben
   * hat – nach dem Speichern meldet der Kern dann einen Konflikt, statt die Eingaben zu überschreiben.
   * Sonst sofort anzeigen (auch bei Fokus im Feld: es gibt nichts Ungespeichertes).
   * @param {string} id @param {any} data @param {number} savedAt
   */
  write: (id, data, savedAt) => {
    if (matrix?.id === id && (hasPendingSave() || isPreview())) return false;
    pulling = true;
    try {
      if (!Store.writeDoc(id, data, savedAt)) return false;
    } finally {
      pulling = false;
    }
    adoptStored(id, true);
    return true;
  },
  /** @param {unknown} raw */
  normalize: raw => Model.normalize(raw),
  /** @param {any} m */
  title: m => m.name || Texts.ui.untitledMatrix,
  /** @param {any} m */
  summary: m => `${count(m.tasks.length, Texts.home.tasks)} · ${count(m.roles.length, Texts.home.roles)}`,
  /** @param {any} m @param {string} label */
  duplicate: (m, label) => {
    const copy = Ops.duplicate(m, `(${label || Texts.sync.storage})`);
    return { id: copy.id, data: copy };
  },
};

/** Kern und Oberfläche laden und die Ablage starten (einmalig). */
export function loadSync() {
  loading ??= (async () => {
    const [core, ui] = await Promise.all([import('@method-commons/sync'), import('@method-commons/sync/ui'), import('@method-commons/sync/ui/styles.css')]);
    const lang = Languages.detect();
    controller = new core.SyncController({ adapter, engine: { messages: ui.textsFor(lang).commit } });
    syncUi.value = ui.createSyncUI({
      controller,
      lang,
      nouns: Texts.sync.nouns,
      currentId: () => matrix?.id ?? null,
      onOpenDoc: (/** @type {string} */ id) => openMatrix(id),
      toast: (/** @type {string} */ text) => toast(text),
      // Nie bearbeitete Matrizen (frisch geöffnete Beispiele, leere neue) nicht vorauswählen
      preselect: (/** @type {{ data: any }} */ d) => d.data.createdAt !== d.data.updatedAt,
      // früherer Stand: über dem geöffneten Dokument; geteilter Link: eigene Ansicht – beides nur lesend, ohne zu speichern
      onPreview: (/** @type {any} */ p) => { if (!p) endPreview(); else if (p.kind === 'shared') showShared(p.data); else showPreview(p.data); },
    });
    setPreviewHooks({ locked: Texts.sync.previewLocked, ended: () => syncUi.value?.endPreview() });
    controller.subscribe(() => render());
    controller.start();
    return syncUi.value;
  })();
  return loading;
}

/** Menü „Ablage …“: einrichten bzw. Übersicht. */
export function openStorage() {
  loadSync().then(ui => ui.openStorage());
}

/** Menü „Versionen …“ des geöffneten Dokuments (ohne Ablage: Hinweis zum Einrichten). */
export function openVersions() {
  loadSync().then(ui => ui.openVersions(matrix?.id ?? null));
}

/** Menü „Teilen …“ des geöffneten Dokuments: Link zum Ansehen (ohne Ablage: Hinweis zum Einrichten). */
export function openShare() {
  loadSync().then(ui => ui.openShare(matrix?.id ?? null));
}

/**
 * Link `#g=…` eines geteilten Dokuments: nur lesend zeigen – es wird nichts gespeichert, weder im Browser noch in
 * einer eingerichteten Ablage (erst „Als Kopie speichern“). Gibt `true` zurück, wenn die Adresse ein solcher Link war.
 */
export function openSharedFromHash() {
  const gist = /^#g=([0-9a-f]{8,64})$/i.exec(location.hash)?.[1];
  if (!gist) return false;
  history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  loadSync().then(ui => ui.openShared(gist));
  return true;
}

/** Leiste beim Ansehen eines früheren Stands (nur mit Ablage). */
export function SyncPreview() {
  const ui = syncUi.value;
  return ui ? <div class="preview-slot"><ui.PreviewBar /></div> : null;
}

/** Hinweis am Menüeintrag „Ablage …“. */
export const syncMenuHint = () => (syncUi.value ? syncUi.value.menuHint() : Texts.sync.notSet);

/** Statusanzeige in der Kopfzeile (nur mit Ablage). */
export function SyncStatus() {
  const ui = syncUi.value;
  return ui ? <ui.StatusChip /> : null;
}

/** Zustand einer Matrix in der Ablage (Karte auf der Startseite). @param {{ id: string }} props */
export function SyncDocState({ id }) {
  const ui = syncUi.value;
  return ui ? <ui.DocState id={id} /> : null;
}

/** Abschnitt „Nur in der Ablage“ auf der Startseite. */
export function SyncRemoteOnly() {
  const ui = syncUi.value;
  return ui ? <ui.RemoteOnly /> : null;
}

/** Beim Start: Speicherschicht beobachten, eingerichtete Ablage laden (auch nach Einrichten in einem anderen Tab). */
export function initSync() {
  Store.observe({
    written: id => { if (!pulling) controller?.changed(id); },
    removed: id => controller?.removed(id),
  });
  if (hasConfig()) loadSync();
  openSharedFromHash();
  window.addEventListener('hashchange', openSharedFromHash);
  window.addEventListener('storage', e => { if (e.key === CONFIG_KEY && !loading && hasConfig()) loadSync(); });
}
