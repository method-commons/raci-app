# RACI-Matrix

Responsive Web-App, die beim **methodischen Arbeiten mit der RACI-Methode** hilft: Aufgaben und Rollen sammeln, je Aufgabe festlegen, wer ausführt (**R**esponsible), wer entscheidet (**A**ccountable), wer gefragt (**C**onsulted) und wer informiert wird (**I**nformed) – und die Matrix waagerecht und senkrecht prüfen: genau ein A je Aufgabe, mindestens ein R, nicht zu viele C, keine Engpässe, keine Rollen ohne Aufgabe.

Bewusst **kein Aufgaben- oder Projektmanagement**: keine Termine, kein Erledigt-Status, keine Erinnerungen.

Läuft im Browser ohne Server-Backend; die Oberfläche nutzt [Preact](https://preactjs.com) mit [Signals](https://preactjs.com/guide/v10/signals/), gebaut wird mit [Vite](https://vite.dev) – technisch wie die Schwester-Apps [5 Warum](https://github.com/method-commons/5-why-app), [2-Achsen-Matrix](https://github.com/method-commons/two-axis-matrix-app), [User Stories](https://github.com/method-commons/user-story-app) und [Morphologische Matrix](https://github.com/method-commons/morphological-matrix-app).

## Starten

Lokal (Node.js ≥ 22):

```sh
npm install      # einmalig
npm run dev      # Entwicklungsserver, http://localhost:5173/
npm run build    # Build nach dist/
npm run preview  # gebaute App ansehen, http://localhost:4173/
npm test         # Lint, Typprüfung, Unit-Tests, Build, Browser-Tests
```

Auf `main` veröffentlicht die CI die App auf GitHub Pages, sobald alle Prüfungen grün sind (einmalig: *Settings → Pages → Source: „GitHub Actions“*).

## Funktionen

- **Matrizen:** Startseite mit einer Karte je Matrix: Vorschaubild (Zellen als Farbraster, Zeilen mit Fehler markiert), Variante, Aufgaben, Rollen, „x / n eindeutig“, Fehler, offene Punkte, Änderungen Ist → Soll und der wichtigste Hinweis. Filter nach Variante, Duplizieren, Löschen (mit Rückgängig). Darunter die vier Buchstaben mit Leitfrage und die Faustregeln.
- **Neue Matrix:** Variante wählen – **RACI**, **RASCI** (+ S Support), **RACI-VS** (+ V Verify, S Sign-off), **DACI** (Driver, Approver, Contributor, Informed) oder **eigene Buchstaben** – und Startinhalt: leer, Vorlage („Veranstaltung“, „Projekt“), Rollen aus einer anderen Matrix oder eine eingefügte Aufgabenliste.
- **Matrix:** Aufgaben (optional in Phasen) als Zeilen, Rollen als Spalten. Zelle anklicken: Buchstaben wählen (auch „A/R“), bei zwei A Vorschläge zum Auflösen, „klären“ markieren, Notiz. Mit der Tastatur: Buchstabe tippen (nochmals tippen entfernt, A dann R ergibt A/R), Entf leert, `?` klären, Pfeiltasten wechseln die Zelle; Enter im Aufgabennamen legt die nächste Aufgabe an. Je Aufgabe Phase und **Verweis** (z. B. auf eine Maßnahme aus 5 Warum oder ein Risiko der 2-Achsen-Matrix).
- **Prüfung** (Spalte und Seitenleiste, Klick markiert die betroffenen Aufgaben bzw. Rollen): Regeln der Buchstaben (genau ein A, höchstens ein S bei RACI-VS …), mindestens ein R, viele C, unbekannte Buchstaben, **Engpass** (Rolle an sehr vielen Aufgaben beteiligt), auffällig viele A bei einer Rolle, Rolle ohne Aufgabe, Aufgaben als Tätigkeit (mit Verb). Summen A · R · C · I je Rolle unter der Matrix.
- **Rollen:** senkrecht gelesen – Beteiligung, Verteilung der Buchstaben als Balken, Hinweis je Rolle; Name, Aufgabe der Rolle, Person und Vertretung, intern/extern; **Vorschläge zum Entlasten** (R abgeben, die entscheidende Rolle wird A/R; C → I; I streichen), übernehmen mit einem Klick.
- **Wer macht was?:** die Matrix je Rolle oder je Person als Steckbrief (entscheidet / führt aus / wird gefragt / wird informiert), leere Gruppen ausblendbar, zum Drucken.
- **Bericht:** Matrix mit Legende, Prüfergebnis, Rollen-Hinweise, offene Punkte und Änderungen Ist → Soll auf einer Seite – Drucken/PDF, Markdown (kopieren, herunterladen), CSV, JSON.
- **Optional (je Matrix unter „Datei → Einstellungen der Matrix“):** Phasen und „A/R in einer Zelle“ (standardmäßig an), Personen zu Rollen, Klären & Notizen je Zelle, **Ist / Soll** (zweiter Stand je Zelle, Ansichten Ist, Soll, Ist → Soll mit Vergleich „A je Rolle“ und „Soll als neuen Ist-Stand übernehmen“; im Aufgaben-Dialog und an der Zelle lässt sich zwischen Ist und Soll umschalten, der jeweils andere Stand wird bei Abweichung angezeigt), externe Rollen. **Buchstaben** als Liste (Kennzeichen, Name, Bedeutung, Regel); bei „Eigene“ klappt ein Klick den Buchstaben zum Bearbeiten auf: Kürzel, Name, Bedeutung, Regel je Aufgabe, Farbe, **„Zählt in der Prüfung wie“** (entscheidet, führt aus, wird gefragt, wird informiert, nichts davon – steuert Engpass, Entlasten und „A/R“) und Vorschau mit Anzahl der Zellen; bei Standard-Varianten wechselt „Buchstaben anpassen“ zu „Eigene“. Prüfregeln mit Schwellen (viele C ab …, Engpass ab … %). Als Standard für neue Matrizen speicherbar; ausgeblendete Angaben bleiben erhalten.
- **Speichern** automatisch im Browser (localStorage), Rückgängig/Wiederholen (Knöpfe bzw. `Strg+Z` / `Strg+Umschalt+Z` außerhalb von Textfeldern), Export/Import je Matrix als JSON, **CSV-Import** (Spalten „Aufgabe“, optional „Nr.“, „Phase“, „Prüfung“, dazu je Rolle eine Spalte; Variante wird aus den Buchstaben erkannt), Sicherung aller Matrizen, Änderungen aus einem anderen Browser-Tab werden übernommen.
- **Beispiele** (Food-Truck der Schwester-Apps, Deutsch und Englisch): *Stadtfest 2026 – Ablauf* (RACI mit typischen Fehlern), *Tagesbetrieb* (RASCI, Ist → Soll), *Fester Stellplatz Domplatz* (RACI-VS), *Kartenzahlung einführen* (DACI).
- **Methodik-Hilfe** (Knopf „? Methodik“): Methode, Vorgehen, Varianten, Prüfen, Ist/Soll, Bedienung.
- **Sprachen:** Deutsch und Englisch (Menü „Datei“). Hell/dunkel nach Systemeinstellung, mobil mit Aufgabenliste und Navigation unten; dort öffnet ein Tipp auf eine Aufgabe den Aufgaben-Dialog (Buchstaben je Rolle, Phase, Verweis), ein Tipp auf eine Phase den Phasen-Dialog (umbenennen, verschieben, entfernen), „+ Phase“ legt eine neue an.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/model.js` | Datenmodell, Normalisieren, Zellen (Ist/Soll), Reihenfolge und Nummern der Aufgaben |
| `js/variants.js` | Buchstabensätze RACI, RASCI, RACI-VS, DACI, eigene; Bedeutung (`kind`) und Regel (`count`) je Buchstabe |
| `js/checks.js` | Prüfungen je Aufgabe und Rolle, Kennzahlen, Hinweise, Vorschläge zum Entlasten, Änderungen Ist → Soll |
| `js/ops.js` | Änderungen (Phasen, Aufgaben, Rollen, Zellen, Variante, Buchstaben, Einstellungen, Vorlagen, Duplizieren) |
| `js/storage.js` | Speicherung im localStorage, Standard für neue Matrizen |
| `js/io.js` | JSON-Export/-Import, Sicherung, CSV (Export und Import), Markdown-Bericht |
| `js/examples.js`, `examples/` | Beispiel-Matrizen je Sprache |
| `js/texts.js`, `js/i18n/` | Texte (Deutsch maßgeblich, Englisch gleiche Struktur) |
| `js/ui/core.js` | Route, geöffnete Matrix, Speichern, Verlauf, Auswahl, Dialoge, Meldungen |
| `js/ui/matrix.jsx` | Ansicht „Matrix“ mit Seitenleiste (Prüfung, Ist → Soll, offene Punkte) |
| `js/ui/matrix-table.jsx` | Matrix als Tabelle (Phasen, Zellen, Prüfspalte, Summen) und als Liste für schmale Bildschirme |
| `js/ui/cell.jsx` | Zellen: Auswahl, Inhalt, Tastatur, Auswahl-Feld an der Zelle, Umschalter Ist / Soll |
| `js/ui/task-dialogs.jsx` | Dialoge „Aufgabe bearbeiten“ und „Phase bearbeiten“ |
| `js/ui/*.jsx` (übrige) | Start, Rollen, Wer macht was?, Bericht, Einstellungen, Hilfe |
| `css/` | Design-Tokens (aus den Schwester-Apps) und Farben der Buchstaben, Bausteine, Ansichten, mobil, Druck |
| `tests/unit/`, `tests/e2e/` | Vitest (Logik, Mindestabdeckung) und Playwright (gegen den Build) |

Datenformat: [docs/DATENFORMAT.md](docs/DATENFORMAT.md). Entwürfe: [docs/mockups/](docs/mockups/).
