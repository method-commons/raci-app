# Mockups – RACI-Matrix

Statische Entwürfe (keine Funktion) – inzwischen umgesetzt, siehe [README](../../README.md) – für eine App, mit der man **Zuständigkeiten nach der RACI-Methode** klärt: Aufgaben als Zeilen, Rollen als Spalten, je Zelle *R – führt aus*, *A – entscheidet*, *C – wird gefragt*, *I – wird informiert*. Gestaltet im Stil der Schwester-Apps [Morphologische Matrix](https://github.com/method-commons/morphological-matrix-app), [User Stories](https://github.com/method-commons/user-story-app), [5 Warum](https://github.com/method-commons/5-why-app) und [2-Achsen-Matrix](https://github.com/method-commons/two-axis-matrix-app): gleiche Design-Tokens, Kopfzeile mit Tabs je geöffneter Matrix, Kennzahl-Kacheln, Prüf-Seitenleiste, Einstellungen je Matrix mit optionalen Bereichen, Bericht zum Drucken, mobile Ansicht mit Navigation unten. Quelle: [`mockups.html`](mockups.html) – im Browser öffnen.

| # | Ansicht | Datei |
|---|---------|-------|
| 1 | **Übersicht** aller Matrizen: Karte je Matrix mit Vorschaubild (Zellen als Farbraster), Variante, Kennzahlen (*eindeutig*, Fehler, Änderungen) und dem wichtigsten Hinweis; Filter nach Variante; darunter die vier Buchstaben mit Leitfrage und die Faustregeln | `s1-uebersicht.png` |
| 2 | **Neue Matrix**: Variante wählen (*RACI*, *RASCI*, *RACI-VS*, *DACI*, eigene Buchstaben) und Startinhalt (leer, Vorlage, Rollen aus anderer Matrix, Aufgabenliste einfügen) | `s2-neu.png` |
| 3 | **Matrix**: Aufgaben nach Phasen, Rollen als Spalten mit Person; Buchstabe per Klick oder Taste (R, A, C, I, Entf, ? für „klären“), Notiz je Zelle; Prüfung je Zeile (genau ein A, mindestens ein R, viele C) und je Spalte (Engpass), Summen A·R·C·I je Rolle | `s3-matrix.png` |
| 4 | **Rollen**: Rollen mit Aufgabe, Person und Vertretung, intern/extern; senkrecht gelesen: Beteiligung und Verteilung A·R·C·I je Rolle, Hinweise (Engpass, viele A, nie A, ohne Aufgabe) mit Vorschlägen zum Entlasten | `s4-rollen.png` |
| 5 | **Ist / Soll** (optional): heutige Zuständigkeiten und Zielverteilung in einer Zelle, Vergleich „A je Rolle“; Beispiel *Tagesbetrieb* als RASCI mit *S – Support* | `s5-ist-soll.png` |
| 6 | **Wer macht was?**: die Matrix je Rolle (oder je Person) gelesen – entscheidet / führt aus / wird gefragt / wird informiert – als Steckbrief zum Aushängen | `s6-wer-macht-was.png` |
| 7 | **Bericht**: Matrix mit Legende, Prüfergebnis, Rollen-Hinweise und offene Punkte; Drucken/PDF, Markdown, CSV, JSON | `s7-bericht.png` |
| 8 | **Einstellungen der Matrix** (Datei → Einstellungen): Variante, optionale Bereiche (Phasen, A/R in einer Zelle, Personen, Klären & Notizen, Ist/Soll, externe Rollen), Prüfregeln mit Schwellen; als Standard für neue Matrizen | `s8-einstellungen.png` |
| 9 | **Mobil**: Aufgaben einer Phase als Liste mit ihren Rollen, Buchstaben je Rolle im Blatt | `s9-mobil.png` |

Beispieldaten: durchgehend der fiktive **Food-Truck** der Schwester-Apps mit dem Team Lea, Aylin, Fritz, Ben, Mia und Jonas – Ablauf für das Stadtfest 2026 (Aufgabe 3.2 verweist auf Risiko R7 der 2-Achsen-Matrix), der Tagesbetrieb (Ist → Soll, mit den Maßnahmen aus der 5-Warum-Analyse „Lange Wartezeit am Samstag“), der feste Stellplatz am Domplatz (RACI-VS), die Entscheidung über Kartenzahlung (DACI) und ein Entwurf für den Saisonstart 2027.

Screenshots neu erzeugen: jede `<section class="screen">` mit Playwright aufnehmen (Faktor 1,5).

## Grundidee

Eine Matrix besteht aus **Aufgaben** (Zeilen, optional in Phasen), **Rollen** (Spalten, optional mit Personen) und je Zelle höchstens einem **Buchstaben** – bei „A/R“ zwei. Die Varianten unterscheiden sich nur im Buchstabensatz und in den Regeln:

| Variante | Buchstaben | Regel je Aufgabe | Einsatz |
|---|---|---|---|
| RACI | R, A, C, I | genau ein A, mindestens ein R | Abläufe, Projekte, wiederkehrende Aufgaben |
| RASCI | + S (Support) | wie RACI; S nur zusammen mit einem R | wenn viele zuarbeiten |
| RACI-VS | + V (Verify), S (Sign-off) | wie RACI; höchstens ein S | Genehmigungen, Prüf- und Freigabeschritte |
| DACI | D, A, C, I | genau ein D und ein A | eine Entscheidung statt eines Ablaufs |
| Eigene | frei | je Buchstabe: „genau einer“, „mindestens einer“ oder frei | Sonderfälle (z. B. CAIRO mit „O – Out of the loop“) |

**Prüfung** (wie INVEST-Check und Prüfung der Warum-Kette in den Schwester-Apps):

- **Waagerecht je Aufgabe:** genau ein A · mindestens ein R (A/R zählt) · nicht zu viele C · Aufgabe als Tätigkeit mit Verb formuliert.
- **Senkrecht je Rolle:** Engpass (an sehr vielen Aufgaben beteiligt, viele A/R) · viele A bei einer Rolle · Rolle ohne Aufgabe · Rolle nur mit C/I.
- Treffer erscheinen an der Zeile, an der Spaltenüberschrift und in der Seitenleiste; ein Klick springt zur Zelle.

## Entscheidungen (umgesetzt wie empfohlen)

1. **Eine App mit mehreren Varianten** (RACI, RASCI, RACI-VS, DACI, eigene) statt nur RACI – empfohlen; gleiches Datenmodell, nur andere Buchstaben und Regeln.
2. **Spalten sind Rollen, Personen optional** – empfohlen; so bleibt die Matrix gültig, wenn Personen wechseln. „Je Person“ fasst mehrere Rollen einer Person zusammen.
3. **„A/R“ in einer Zelle** erlauben – empfohlen, abschaltbar; kommt in kleinen Teams ständig vor.
4. **Ist / Soll** als optionaler zweiter Stand je Zelle – vorgeschlagen; nützlich bei Umorganisation, sonst ausgeblendet.
5. **Vorschläge zum Entlasten** (Rollen-Ansicht) nur als Denkanstoß, nie automatisch angewendet – empfohlen.
6. **Verknüpfung mit den Schwester-Apps** (Maßnahmen aus 5 Warum, Risiken aus der 2-Achsen-Matrix als Aufgaben übernehmen) – vorgeschlagen, zunächst nur als Textverweis an der Aufgabe; Import kann später kommen.
7. Optionale Bereiche wie in den Schwester-Apps **standardmäßig aus** (außer Phasen und A/R); Ausblenden löscht nichts.

## Abgrenzung

Die App unterstützt das **Klären von Zuständigkeiten** mit der RACI-Methode und ist kein Aufgaben- oder Projektmanagement-Werkzeug: keine Termine, kein Erledigt-Status, keine Erinnerungen oder Benachrichtigungen. Daten bleiben wie bei den Schwester-Apps nur im Browser.

## Abweichungen in der Umsetzung

- Die Matrizen erscheinen wie in der 5-Warum- und 2-Achsen-App nicht als Browser-Tabs, sondern mit Namen in der Kopfzeile.
- Bei **DACI** ist die Engpass-Prüfung standardmäßig aus: Der Approver entscheidet naturgemäß jede Frage. „Viele A bei einer Rolle“ hängt an derselben Regel.
- Das Beispiel *Fester Stellplatz Domplatz* hat eine Rolle ohne Aufgabe (Steuerberaterin) und sonst keine Hinweise; *Tagesbetrieb* hat 18 geänderte Zellen in 6 Aufgaben.
- Mobil öffnet ein Tipp auf eine Aufgabe den Aufgaben-Dialog (Blatt von unten) mit den Buchstaben je Rolle; derselbe Dialog dient am Desktop zum Bearbeiten von Phase, Verweis und Reihenfolge.
- Zusätzlich: CSV-Import, Vorlage „Projekt“, Rollen aus anderer Matrix und Aufgabenliste auch über das Menü „Datei“.

## Logo-Vorschläge (entschieden: G)

„RACI“ als Text ist im Quadrat der Schwester-Apps zu klein (im Browser-Tab bei 16 px unlesbar). Vorschläge A–H für ein Symbol in derselben Form (Indigo-Quadrat, Weiß darauf), jeweils groß, in der Kopfzeile hell/dunkel und als Browser-Symbol: [`logo.html`](logo.html), Bild `logo.png`.

Gewählt und umgesetzt (Kopfzeile und Browser-Symbol): **G – Aufgabenzeilen** – drei Aufgaben als Balken, rechts je drei Rollen-Zellen, in jeder Zeile genau eine kräftige (das A). Zeigt die Kernregel der Methode und hebt sich anders als das reine Zellraster (A) klar vom Logo der Morphologischen Matrix ab.
