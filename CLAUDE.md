# CLAUDE.md – Hinweise für Claude Code

RACI-Matrix (RACI, RASCI, RACI-VS, DACI, eigene Buchstaben) als Web-App ohne Server: Vite 8, Preact 10 +
@preact/signals, Daten nur im Browser (localStorage), veröffentlicht über GitHub Pages. Technische Vorlage sind
die Schwester-Apps [2-Achsen-Matrix](https://github.com/method-commons/two-axis-matrix-app),
[5 Warum](https://github.com/method-commons/5-why-app), [User Stories](https://github.com/method-commons/user-story-app)
und [Morphologische Matrix](https://github.com/method-commons/morphological-matrix-app). Funktionen und Module stehen
in der [README](README.md), das Datenformat in [docs/DATENFORMAT.md](docs/DATENFORMAT.md).

## Zusammenarbeit

- **Sprache:** Antworten, Code-Kommentare, Commit-Nachrichten und PR-Texte auf **Deutsch**.
- **Erst zeigen, dann bauen:** neue Funktionen zuerst als Mockup (`docs/mockups/`), umsetzen nach „Ja“.
- **Abgrenzung:** Die App unterstützt die Methodik (Zuständigkeiten klären und prüfen) – kein Aufgaben- oder Projektmanagement: keine Termine, kein Status, keine Erinnerungen.
- **Buchstaben nach Bedeutung:** Prüfungen, Farben und Vorschläge richten sich nach `kind` (owner, exec, consult …) und `count` eines Buchstabens, nie nach dem Kürzel – keine `if (key === 'A')` in Logik oder Oberfläche.
- **Optionale Bereiche** (Personen, Klären & Notizen, Ist/Soll, extern) sind je Matrix schaltbar und standardmäßig aus; Ausblenden löscht nichts.
- **Pull Requests nur auf Nachfrage.** Keine Modellbezeichnungen in Commits, PRs oder Code.
- **Fertig heißt:** `npm test` grün, README/DATENFORMAT aktualisiert, Commit und Push.

## Befehle

```sh
npm test                       # Lint, Typprüfung, Unit, Build, E2E
npx eslint .                   # Lint
npx tsc --noEmit -p jsconfig.json && node scripts/typecheck-logic.js
npx vitest run [datei]         # Unit-Tests (tests/unit/)
npx vite build && npx playwright test [datei]   # E2E gegen den Build (Port 4173)
```

E2E-Tests laufen gegen `dist/` – nach Codeänderungen vorher bauen. Chromium ist vorinstalliert; kein `playwright install`.

## Architektur

- **Logik ohne DOM** in `js/*.js` (`Model`, `Variants`, `Checks`, `Ops`, `Store`, `IO`, `Examples`), Oberfläche in `js/ui/*.jsx`.
- **Eine Matrix trägt ihre Buchstaben selbst** (`letters`); die Variante liefert nur die Vorlage.
- **Zellen:** `cells[taskId][roleId] = { v, s, q, note }` – `v` Ist, `s` Soll (`null` = wie Ist). Gelesen wird immer über `Model.keys(m, task, role, mode)`; der Stand der Ansicht kommt aus `viewMode(m)` (`js/ui/core.js`).
- **Zustand:** `matrix` in `js/ui/core.js` ist ein normales Objekt; neu gezeichnet wird über das Signal `revision`, Komponenten lesen es mit `useMatrix()`. Neuzeichnen ist synchron (`options.debounceRendering = cb => cb()`).
- **Änderungen:** strukturell mit `mutate(fn)` (Verlaufseintrag, Speichern, Neuzeichnen); Eingabefelder mit `{...fieldProps(get, set)}` (Verlaufseintrag beim Verlassen).
- **Texte** nur in `js/i18n/de.js` (maßgeblich) und `en.js` (gleiche Struktur und Platzhalter, wird geprüft).
- **CSS** in `css/*.css`, eingebunden in `styles.css` mit Kaskaden-Ebenen. Farben der Buchstaben über Klassen `lc-<Farbe>` (Kennzeichen) bzw. `lt-<Farbe>` (Text), Werte in `css/tokens.css` (hell/dunkel).

## Datenformat

- Aktuell **Version 1** (`Model.SCHEMA_VERSION`). Bei inkompatiblen Erweiterungen Version erhöhen, in `MIGRATIONS[n]` umwandeln, `docs/DATENFORMAT.md` und alle `examples/*.json` anpassen.
- Beispiele müssen exakt der Ausgabe von `normalize` entsprechen und in beiden Sprachen dieselben IDs und Zellen haben (Test `examples.test.js`).

## Bekannte Fallstricke

- **Auswahlfelder und `mutate`:** Den Wert eines `<select>` bzw. einer Checkbox **vor** `mutate` lesen, sonst setzt das synchrone Neuzeichnen ihn zurück.
- **Eingabefelder in Tests:** Preact setzt `value` als Eigenschaft, nicht als Attribut – E2E-Tests finden Aufgaben über ihre Nummer (`row(page, '1.3')`), nicht über `[value=…]`.
- **Speichern ist verzögert** (300 ms) – E2E-Tests lesen den localStorage über `stored(page)`.
- **Auswahl an der Zelle** (`#cellPopover`) ist `position: fixed` und richtet sich nach der Zelle; Escape oder Klick daneben schließt sie.
- **`backdrop-filter`** an der Kopfzeile bindet `position: fixed` an sie – mobil daher abgeschaltet.
