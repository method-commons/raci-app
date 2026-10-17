/*
 * Verwalten ganzer Matrizen aus Menü und Startseite: löschen (mit Rückgängig) und duplizieren.
 */
import { Ops } from '../ops.js';
import { Store } from '../storage.js';
import { Texts } from '../texts.js';
import { confirmDialog, fill } from './components.jsx';
import { discardMatrix, flushSave, go, matrix as current, openMatrix, render, toast } from './core.js';

/** Matrix löschen (mit Rückfrage). @param {Matrix} m */
export function deleteMatrix(m) {
  confirmDialog({
    title: Texts.manage.deleteTitle,
    text: fill(Texts.manage.deleteText, { name: m.name || Texts.ui.untitledMatrix }),
    ok: Texts.ui.delete,
    danger: true,
    onOk: () => {
      const copy = JSON.parse(JSON.stringify(m));
      if (current && current.id === m.id) discardMatrix();
      Store.removeMatrix(m.id);
      go({ view: 'home' });
      toast(Texts.manage.deleted, { label: Texts.ui.undone, run: () => { Store.save(copy); go({ view: 'home' }); render(); } });
      render();
    },
  });
}

/** Matrix duplizieren und öffnen. @param {Matrix} m */
export function duplicateMatrix(m) {
  flushSave();
  const copy = Ops.duplicate(m, Texts.manage.copySuffix);
  Store.save(copy);
  toast(Texts.manage.duplicated);
  openMatrix(copy.id);
}
