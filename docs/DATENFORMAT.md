# Datenformat

Eine RACI-Matrix wird als JSON gespeichert (localStorage, Schlüssel `raci:matrix:<id>`) und so auch exportiert. Beim Laden und Importieren bringt `Model.normalize` jede Eingabe in diese Form: unbekannte Felder fallen weg, fehlende bekommen Standardwerte, doppelte IDs werden ersetzt, leere Zellen entfernt. Typen: [`types.d.ts`](../types.d.ts).

```json
{
  "version": 1,
  "id": "m…",
  "name": "Stadtfest 2026 – Ablauf",
  "context": "Food-Truck auf dem Stadtfest, 3 Tage",
  "variant": "raci",
  "letters": [
    { "key": "R", "kind": "exec", "count": "min1", "color": "teal", "name": "Responsible", "meaning": "führt aus" },
    { "key": "A", "kind": "owner", "count": "one", "color": "indigo", "name": "Accountable", "meaning": "entscheidet" }
  ],
  "options": { "phases": true, "combined": true, "people": true, "notes": true, "plan": false, "external": true },
  "rules": { "minExec": true, "manyConsult": 5, "bottleneck": 80, "emptyRole": true, "verb": true },
  "phases": [{ "id": "p1", "name": "Vorbereitung" }],
  "tasks": [{ "id": "t13", "phase": "p1", "name": "Ware & Getränke bestellen", "ref": "" }],
  "roles": [{ "id": "r-fin", "name": "Einkauf & Finanzen", "description": "Bestellungen, Kasse", "person": "Ben", "deputy": "Lea", "external": false }],
  "cells": { "t13": { "r-fin": { "v": ["A", "R"], "s": null, "q": false, "note": "Bestellt bis 500 €" } } },
  "createdAt": "2026-10-12T08:00:00.000Z",
  "updatedAt": "2026-10-16T10:24:00.000Z"
}
```

| Feld | Bedeutung |
|---|---|
| `variant` | `raci`, `rasci`, `raci-vs`, `daci` oder `custom`; bestimmt nur die Vorlage der Buchstaben |
| `letters[]` | Buchstaben der Matrix. `key` (1–3 Zeichen, eindeutig, groß), `kind` (`owner`, `driver`, `exec`, `support`, `consult`, `verify`, `signoff`, `inform`, `other` – steuert Prüfungen, Reihenfolge in der Zelle und Vorschläge; in den Einstellungen als „Zählt in der Prüfung wie“ wählbar, neue Buchstaben beginnen mit `other`), `count` je Aufgabe (`one` genau einer, `min1` mindestens einer, `max1` höchstens einer, `any`), `color` (`indigo`, `teal`, `cyan`, `orange`, `violet`, `blue`, `pink`, `gray`), `name`, `meaning` |
| `options` | optionale Bereiche: Phasen, „A/R“ in einer Zelle, Personen, Klären & Notizen, Ist/Soll, externe Rollen |
| `rules` | `minExec` (Regel `min1` prüfen), `manyConsult` (viele C ab dieser Zahl, 0 = aus), `bottleneck` (Engpass ab diesem Anteil in Prozent, 0 = aus; schaltet auch „viele A“), `emptyRole`, `verb` |
| `phases[]` | Reihenfolge der Phasen |
| `tasks[]` | Reihenfolge der Aufgaben; `phase` = ID einer Phase oder `""`; `ref` = Verweis als Text |
| `roles[]` | Spalten; `person`/`deputy` nur Namen; `external` kennzeichnet externe Rollen |
| `cells` | je Aufgabe und Rolle: `v` Buchstaben im Ist (geordnet nach `kind`, „A/R“ = `["A", "R"]`), `s` Soll (`null` = wie Ist, `[]` = entfällt), `q` „klären“, `note` Notiz. Leere Zellen fehlen; Kürzel ohne passenden Buchstaben bleiben erhalten und werden angemerkt |

**Sicherung** aller Matrizen: `{ "type": "raci-backup", "version": 1, "exportedAt": "…", "matrices": [ … ] }`. Import akzeptiert eine Matrix, eine Sicherung oder eine Liste; identische Matrizen werden übersprungen, abweichende als Kopie angelegt.

**CSV** (Export „Matrix als CSV“, Import über „Importieren“): Kopfzeile `Nr.;Phase;Aufgabe;<Rolle 1>;<Rolle 2>;…;Prüfung` (Trennzeichen Semikolon bei deutscher, Komma bei englischer Sprache; beim Import werden `;`, Tab und `,` erkannt, Spaltennamen in beiden Sprachen). Zellen enthalten die Kürzel („A/R“, „C“). Die Variante wird aus den Kürzeln erkannt (D → DACI, V → RACI-VS, S → RASCI, sonst RACI bzw. eigene).

**Standard für neue Matrizen:** `raci:defaults` = `{ "options": { … }, "rules": { … } }`. Sprache: `raci:lang`.
