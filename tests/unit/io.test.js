import { describe, expect, it } from 'vitest';
import { Examples } from '../../js/examples.js';
import { IO } from '../../js/io.js';
import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';
import { build } from './fixtures.js';

describe('IO JSON', () => {
  it('exportiert und liest Matrix, Sicherung und Liste', () => {
    const { m } = build({ 'Ware bestellen': { L: 'A', T: 'R' } });
    expect(IO.parse(IO.matrixJson(m))).toEqual([m]);
    const backup = IO.backupJson([m, m], new Date('2026-10-01T00:00:00Z'));
    expect(JSON.parse(backup)).toMatchObject({ type: IO.BACKUP_TYPE, exportedAt: '2026-10-01T00:00:00.000Z' });
    expect(IO.parse(backup)).toHaveLength(2);
    expect(IO.parse('﻿' + JSON.stringify([m]))).toHaveLength(1);
    expect(() => IO.parse('')).toThrow('Die Datei ist leer.');
    expect(() => IO.parse('{')).toThrow('keine gültige');
    expect(() => IO.parse('[]')).toThrow('leer');
    expect(() => IO.parse('[1]')).toThrow('keine gültige');
  });

  it('übernimmt Importe neu, gar nicht oder als Kopie', () => {
    const { m } = build({ 'Ware bestellen': { L: 'A' } });
    expect(IO.resolveImport(m, null).action).toBe('new');
    expect(IO.resolveImport(m, { ...m, updatedAt: 'x' }).action).toBe('same');
    const r = IO.resolveImport({ ...m, name: 'Neu' }, m);
    expect(r.action).toBe('copy');
    expect(r.matrix.id).not.toBe(m.id);
    expect(r.matrix.name).toBe('Neu (importiert)');
  });
});

describe('IO CSV', () => {
  it('exportiert die Matrix mit Phasen, Buchstaben und Prüfung', () => {
    const { m, task } = build({ 'Ware; bestellen': { L: 'AR', T: 'C' }, 'Kasse "abrechnen"': { T: 'R' } });
    const p = Ops.addPhase(m, 'Vorbereitung');
    Ops.updateTask(m, task('Ware; bestellen').id, { phase: p.id });
    const lines = IO.csv(m).trim().split('\r\n');
    expect(lines[0]).toBe('Nr.;Phase;Aufgabe;Leitung;Team;Gast;Prüfung');
    expect(lines[1]).toBe('1;;"Kasse ""abrechnen""";;R;;kein A');
    expect(lines[2]).toBe('1.1;Vorbereitung;"Ware; bestellen";A/R;C;;✓');
  });

  it('liest CSV ein (Rundreise, Trennzeichen, Variante)', () => {
    const src = Model.normalize(Examples.raw.stadtfest.de);
    const back = IO.parse(IO.csv(src), 'stadtfest.csv')[0];
    expect(back.name).toBe('stadtfest');
    expect(back.variant).toBe('raci');
    expect(back.phases.map(p => p.name)).toEqual(src.phases.map(p => p.name));
    expect(back.roles.map(r => r.name)).toEqual(src.roles.map(r => r.name));
    expect(back.tasks.map(t => t.name)).toEqual(Model.ordered(src).map(t => t.name));
    const keys = x => Model.ordered(x).map(t => x.roles.map(r => Model.label(Model.keys(x, t.id, r.id))).join(','));
    expect(keys(back)).toEqual(keys(src));

    const tab = IO.parseCsv('Task\tDriver\tBoss\nChoose provider\tD\tA\n\nAnnounce\t\tA, I\n');
    expect(tab.variant).toBe('daci');
    expect(tab.name).toBe('Import');
    expect(tab.options.phases).toBe(false);
    expect(Model.keys(tab, tab.tasks[1].id, tab.roles[1].id)).toEqual(['A', 'I']);
    const plain = IO.parseCsv('Was,Rolle 1,Rolle 2\n"Mehrzeilig\nText",A,"R/S"\n,A,R');
    expect(plain.variant).toBe('rasci');
    expect(plain.tasks.map(t => t.name)).toEqual(['Mehrzeilig\nText']);
    expect(plain.roles.map(r => r.name)).toEqual(['Rolle 1', 'Rolle 2']);
    expect(() => IO.parseCsv('nur eine Zeile')).toThrow();
    expect(IO.splitCsv('a;"b;c"\r\nd;e', ';')).toEqual([['a', 'b;c'], ['d', 'e']]);
  });
});

describe('IO Markdown', () => {
  it('beschreibt Matrix, Prüfung, Rollen, offene Punkte und Änderungen', () => {
    const m = Model.normalize(Examples.raw.stadtfest.de);
    const md = IO.markdown(m, { today: '2026-10-16' });
    expect(md).toContain('# Stadtfest 2026 – Ablauf');
    expect(md).toContain('RACI · Food-Truck auf dem Stadtfest, 3 Tage · Stand 16.10.2026');
    expect(md).toContain('**A** Accountable – entscheidet');
    expect(md).toContain('| Nr. | Aufgabe | Inhaberin (Lea) |');
    expect(md).toContain('| | **Vorbereitung** |');
    expect(md).toContain('| 1.3 | Ware & Getränke bestellen | A | C |   | A/R |');
    expect(md).toContain('↗ Risiko R7');
    expect(md).toContain('## Prüfung · 11 / 14 eindeutig');
    expect(md).toContain('- **Genau ein A je Aufgabe:** 1.3 Ware & Getränke bestellen: 2× A');
    expect(md).toContain('- **Veranstalter** (extern) – Fr. Sommer: an 5 von 14 Aufgaben beteiligt');
    expect(md).toContain('- **Inhaberin** – Lea, Vertretung: Ben:');
    expect(md).toContain('## Offen zu klären');
    expect(md).toContain('- **4.3 · Marketing** (klären): Soll Mia');

    const plan = Model.normalize(Examples.raw.tagesbetrieb.de);
    const p = IO.markdown(plan, { today: '2026-10-16' });
    expect(p).toContain('Stand: Soll');
    expect(p).toContain('## Änderungen Ist → Soll');
    expect(p).toContain('- 1 · Inhaberin: A → –');
    expect(IO.markdown(plan, { mode: 'ist' })).toContain('Stand: Ist');

    const ok = build({ 'Ware bestellen': { L: 'A', T: 'R' }, 'Kasse abrechnen': { L: 'A', T: 'R' }, 'Stand aufbauen': { G: 'AR', T: 'I' } }).m;
    ok.name = '';
    ok.rules.bottleneck = 0;
    const o = IO.markdown(ok);
    expect(o).toContain('# Unbenannte Matrix');
    expect(o).toContain('Alle Regeln erfüllt.');
  });
});
