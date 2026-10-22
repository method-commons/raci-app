/*
 * Rahmen der App: Kopfzeile mit Ansichten und Menü, Inhalt je Route, Dialoge, Meldungen.
 */
import { useEffect, useState } from 'preact/hooks';
import { IO } from '../io.js';
import { Store } from '../storage.js';
import { Languages, Texts } from '../texts.js';
import { Util } from '../util.js';
import { download, Logo } from './components.jsx';
import { canRedo, canUndo, commitEdit, dialog, redo, route, TABS, toasts, undo, useMatrix, useRevision, viewMode } from './core.js';
import { openHelp } from './help.jsx';
import { importFiles, Home, openExamples, openNewMatrix } from './home.jsx';
import { deleteMatrix, duplicateMatrix } from './manage.js';
import { MatrixView } from './matrix.jsx';
import { PeopleView } from './people.jsx';
import { ReportView } from './report.jsx';
import { RolesView } from './roles.jsx';
import { openCopyRoles, openSettings, openTaskList } from './settings.jsx';
import { openShare, openStorage, openVersions, SyncPreview, SyncStatus, syncMenuHint } from './sync.jsx';

/** @param {string} lang */
function switchLanguage(lang) {
  commitEdit();
  Languages.choose(lang);
  location.reload();
}

function Menu() {
  const [open, setOpen] = useState(false);
  const r = route.value;
  const m = useMatrix();
  useEffect(() => {
    if (!open) return undefined;
    /** @param {MouseEvent} e */
    const close = e => { if (!(/** @type {HTMLElement} */ (e.target)).closest('.menu')) setOpen(false); };
    /** @param {KeyboardEvent} e */
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  /** @param {() => void} fn */
  const run = fn => () => { setOpen(false); fn(); };
  const lang = Languages.detect();
  const M = Texts.menu;
  return (
    <div class="menu">
      <button type="button" class="btn ghost" id="menuBtn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        {Texts.ui.menu} ▾
      </button>
      {open && (
        <div class="menu-list" id="menuList" role="menu">
          {r.view === 'matrix' && m && <>
            <button type="button" role="menuitem" data-action="settings" onClick={run(() => openSettings())}>{M.settings}</button>
            <button type="button" role="menuitem" data-action="addTasks" onClick={run(() => openTaskList())}>{M.addTasks}</button>
            <button type="button" role="menuitem" data-action="copyRoles" onClick={run(() => openCopyRoles())}>{M.copyRoles}</button>
            <hr />
            <button type="button" role="menuitem" data-action="export" onClick={run(() => download(IO.matrixJson(m), Util.fileName(m.name, 'json'), 'application/json'))}>{M.exportJson}</button>
            <button type="button" role="menuitem" data-action="csv" onClick={run(() => download('\uFEFF' + IO.csv(m, viewMode(m)), Util.fileName(m.name, 'csv'), 'text/csv'))}>{M.exportCsv}</button>
            <button type="button" role="menuitem" data-action="duplicate" onClick={run(() => duplicateMatrix(m))}>{M.duplicate}</button>
            <button type="button" role="menuitem" data-action="delete" onClick={run(() => deleteMatrix(m))}>{M.delete}</button>
            <hr />
          </>}
          {r.view === 'home' && <>
            <button type="button" role="menuitem" data-action="new" onClick={run(() => openNewMatrix())}>{M.new}</button>
            <button type="button" role="menuitem" data-action="import" onClick={run(() => importFiles())}>{M.import}</button>
            <button type="button" role="menuitem" data-action="backup" onClick={run(() => download(IO.backupJson(Store.all()), `raci-${Util.today()}.json`, 'application/json'))}>{M.backup}</button>
            <button type="button" role="menuitem" data-action="example" onClick={run(() => openExamples())}>{M.example}</button>
            <hr />
          </>}
          <button type="button" role="menuitem" data-action="storage" class="menu-split" onClick={run(openStorage)}>{M.storage}<span class="menu-hint" id="storageHint">{syncMenuHint()}</span></button>
          {m && <button type="button" role="menuitem" data-action="versions" onClick={run(openVersions)}>{M.versions}</button>}
          {m && <button type="button" role="menuitem" data-action="share" class="menu-split" onClick={run(openShare)}>{M.share}<span class="menu-hint">{M.shareHint}</span></button>}
          <hr />
          <button type="button" role="menuitem" data-action="help" onClick={run(() => openHelp())}>{M.help}</button>
          <hr />
          <div class="menu-label">{M.language}</div>
          {Object.keys(Languages.packs).map(l => (
            <button type="button" role="menuitemradio" aria-checked={l === lang} key={l} data-lang={l} onClick={run(() => switchLanguage(l))}>
              {l === lang ? '✓ ' : ''}{Languages.packs[l].languageName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  const r = route.value;
  const m = useMatrix();
  const inMatrix = r.view === 'matrix' && m;
  return (
    <header class="app-header">
      <a class="brand" href="#/" title={Texts.ui.allMatrices} id="homeLink">
        <Logo />
        <span class="brand-name">{Texts.appName}</span>
      </a>
      {inMatrix && (
        <a class="project-name" href={`#/m/${m.id}/matrix`} id="matrixTitle" title={m.name}>{m.name || Texts.ui.untitledMatrix}</a>
      )}
      {inMatrix && (
        <nav class="nav seg" aria-label={Texts.ui.views}>
          {TABS.map(tab => {
            const on = r.tab === tab;
            return (
              <a key={tab} href={`#/m/${m.id}/${tab}`} class={on ? 'on' : ''} aria-current={on ? 'page' : undefined} data-nav={tab}>
                <span class="nav-icon" aria-hidden="true">{Texts.nav.icons[tab]}</span>{Texts.nav[tab]}
              </a>
            );
          })}
        </nav>
      )}
      <span class="spacer" />
      {inMatrix && <>
        <button type="button" class="icon-btn" id="undoBtn" title={Texts.ui.undo} aria-label={Texts.ui.undo} disabled={!canUndo()} onClick={undo}>↶</button>
        <button type="button" class="icon-btn" id="redoBtn" title={Texts.ui.redo} aria-label={Texts.ui.redo} disabled={!canRedo()} onClick={redo}>↷</button>
      </>}
      <button type="button" class="btn ghost" id="helpBtn" onClick={() => openHelp()}>? <span class="hide-narrow">{Texts.ui.method}</span></button>
      <SyncStatus />
      <Menu />
    </header>
  );
}

function Toasts() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map(t => (
        <div class="toast" key={t.id}>
          {t.text}
          {t.action && <button type="button" class="link" onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

export function App() {
  useRevision();
  const r = route.value;
  const m = useMatrix();
  const docTitle = r.view === 'home' || !m ? Texts.appName : `${m.name || Texts.ui.untitledMatrix} – ${Texts.appName}`;
  useEffect(() => { document.title = docTitle; }, [docTitle]);
  const Dlg = dialog.value;
  return (
    <>
      <Header />
      <SyncPreview />
      <main id="main">
        {r.view === 'home' && <Home />}
        {r.view === 'matrix' && m && r.tab === 'matrix' && <MatrixView />}
        {r.view === 'matrix' && m && r.tab === 'roles' && <RolesView />}
        {r.view === 'matrix' && m && r.tab === 'people' && <PeopleView />}
        {r.view === 'matrix' && m && r.tab === 'report' && <ReportView />}
      </main>
      {Dlg && <Dlg />}
      <Toasts />
    </>
  );
}
