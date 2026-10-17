import { describe, expect, it } from 'vitest';
import { Checks } from '../../js/checks.js';
import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';
import { build } from './fixtures.js';

describe('Ops', () => {
  it('legt Phasen und Aufgaben an, verschiebt und entfernt sie', () => {
    const m = Model.create();
    const p1 = Ops.addPhase(m, 'Eins');
    const p2 = Ops.addPhase(m, 'Zwei');
    const a = Ops.addTask(m, { name: 'a', phase: p1.id });
    Ops.addTask(m, { name: 'b', phase: p2.id });
    const c = Ops.addTask(m, { name: 'c', phase: p1.id, ref: 'R7' });
    const d = Ops.addTask(m, { name: 'd', phase: 'gibt-es-nicht' });
    expect(d.phase).toBe('');
    expect(c.ref).toBe('R7');
    expect(Ops.moveTask(m, c.id, -1)).toBe(true);
    expect(m.tasks.map(t => t.name)).toEqual(['c', 'b', 'a', 'd']);
    expect(Ops.moveTask(m, c.id, -1)).toBe(false);
    expect(Ops.moveTask(m, 'x', 1)).toBe(false);
    Ops.updateTask(m, a.id, { name: 'A', ref: 'x', phase: p2.id });
    expect(m.tasks.map(t => t.name)).toEqual(['c', 'b', 'd', 'A']);
    expect(a.phase).toBe(p2.id);
    Ops.updateTask(m, a.id, { phase: 'falsch' });
    expect(a.phase).toBe(p2.id);
    Ops.updateTask(m, 'x', { name: 'nichts' });
    expect(Ops.movePhase(m, p2.id, -1)).toBe(true);
    expect(m.phases.map(p => p.name)).toEqual(['Zwei', 'Eins']);
    expect(Ops.movePhase(m, p2.id, -1)).toBe(false);
    Ops.removePhase(m, p2.id);
    expect(m.phases).toHaveLength(1);
    expect(a.phase).toBe('');
    m.options.phases = false;
    expect(Ops.moveTask(m, a.id, -1)).toBe(true);
    Ops.removeTask(m, a.id);
    expect(m.tasks.map(t => t.name)).toEqual(['c', 'b', 'd']);
  });

  it('legt Rollen an, verschiebt, entfernt und übernimmt sie', () => {
    const { m, roles } = build({ 'Ware bestellen': { L: 'A', T: 'R', G: 'I' } });
    expect(Ops.moveRole(m, roles.G.id, -1)).toBe(true);
    expect(m.roles.map(r => r.name)).toEqual(['Leitung', 'Gast', 'Team']);
    Ops.removeRole(m, roles.G.id);
    Ops.removeRole(m, roles.T.id);
    Ops.removeRole(m, roles.L.id);
    expect(m.cells).toEqual({});
    const other = build({}).m;
    expect(Ops.copyRoles(m, other)).toBe(3);
    expect(Ops.copyRoles(m, other)).toBe(0);
    expect(m.roles.map(r => r.person)).toEqual(['Lea', 'Tom', '']);
  });

  it('setzt Buchstaben per Taste: entfernen, zu A/R ergänzen, ersetzen', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A' } });
    const t = task('Ware bestellen').id;
    Ops.press(m, t, roles.L.id, 'R');
    expect(Model.keys(m, t, roles.L.id)).toEqual(['A', 'R']);
    Ops.press(m, t, roles.L.id, 'A');
    expect(Model.keys(m, t, roles.L.id)).toEqual(['R']);
    Ops.press(m, t, roles.L.id, 'C');
    expect(Model.keys(m, t, roles.L.id)).toEqual(['C']);
    Ops.press(m, t, roles.L.id, 'C');
    expect(Model.cell(m, t, roles.L.id)).toBeNull();
    expect(m.cells).toEqual({});
    m.options.combined = false;
    Ops.press(m, t, roles.L.id, 'A');
    Ops.press(m, t, roles.L.id, 'R');
    expect(Model.keys(m, t, roles.L.id)).toEqual(['R']);
    expect(Ops.canCombine(m, ['A', 'R'])).toBe(false);
    Ops.setKeys(m, 'x', roles.L.id, ['A']);
    Ops.setKeys(m, t, 'x', ['A']);
    expect(Object.keys(m.cells[t])).toEqual([roles.L.id]);
  });

  it('führt Soll neben Ist und übernimmt es', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A', T: 'R' } });
    const t = task('Ware bestellen').id;
    m.options.plan = true;
    Ops.setKeys(m, t, roles.L.id, ['A', 'R'], 'soll');
    Ops.setKeys(m, t, roles.T.id, [], 'soll');
    expect(Model.cell(m, t, roles.L.id)).toEqual({ v: ['A'], s: ['A', 'R'], q: false, note: '' });
    Ops.setKeys(m, t, roles.L.id, ['A'], 'soll');
    expect(Model.cell(m, t, roles.L.id)?.s).toBeNull();
    // Ist ändern: ein Soll „wie Ist“ bleibt beim alten Stand
    Ops.setKeys(m, t, roles.G.id, ['I'], 'ist');
    expect(Model.keys(m, t, roles.G.id, 'soll')).toEqual([]);
    expect(Ops.applyPlan(m)).toBe(2);
    expect(Model.cell(m, t, roles.T.id)).toBeNull();
    expect(Model.cell(m, t, roles.G.id)).toBeNull();
  });

  it('merkt „klären“ und Notizen', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A' } });
    const t = task('Ware bestellen').id;
    Ops.setQuestion(m, t, roles.T.id, true);
    Ops.setNote(m, t, roles.T.id, 'bis 500 €');
    expect(Model.cell(m, t, roles.T.id)).toEqual({ v: [], s: null, q: true, note: 'bis 500 €' });
    Ops.setQuestion(m, t, roles.T.id, false);
    Ops.setNote(m, t, roles.T.id, '');
    expect(Model.cell(m, t, roles.T.id)).toBeNull();
    Ops.setQuestion(m, 'x', roles.T.id, true);
    Ops.setNote(m, t, 'x', 'a');
    expect(Object.keys(m.cells[t])).toEqual([roles.L.id]);
  });

  it('wendet Vorschläge an', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A', T: 'R' } });
    const t = task('Ware bestellen').id;
    Ops.applySuggestion(m, { kind: 'execToOwner', task: t, role: roles.T.id, from: ['R'], to: ['C'], other: { role: roles.L.id, from: ['A'], to: ['A', 'R'] } });
    expect([Model.keys(m, t, roles.L.id), Model.keys(m, t, roles.T.id)]).toEqual([['A', 'R'], ['C']]);
    Ops.applySuggestion(m, { kind: 'dropInform', task: t, role: roles.T.id, from: ['C'], to: [] });
    expect(Model.cell(m, t, roles.T.id)).toBeNull();
  });

  it('wechselt die Variante und bearbeitet eigene Buchstaben', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A', T: 'R', G: 'C' } });
    const t = task('Ware bestellen').id;
    Ops.setVariant(m, 'daci');
    expect(m.letters.map(l => l.key)).toEqual(['D', 'A', 'C', 'I']);
    expect(Model.keys(m, t, roles.T.id)).toEqual(['R']);
    Ops.setVariant(m, 'raci');
    Ops.setVariant(m, 'custom');
    expect(m.letters.map(l => l.key)).toEqual(['R', 'A', 'C', 'I']);
    const o = Ops.addLetter(m);
    expect(o).toMatchObject({ key: 'O', kind: 'other', count: 'any' });
    expect(Ops.updateLetter(m, 'O', { key: 'a' })).toBe(false);
    expect(Ops.updateLetter(m, 'O', { key: ' ' })).toBe(false);
    expect(Ops.updateLetter(m, 'X', { name: 'x' })).toBe(false);
    expect(Ops.updateLetter(m, 'C', { key: 'k', name: 'Kollege', meaning: 'redet mit', count: 'max1', color: 'pink' })).toBe(true);
    expect(Model.letter(m, 'K')).toMatchObject({ name: 'Kollege', meaning: 'redet mit', count: 'max1', color: 'pink', kind: 'consult' });
    expect(Model.keys(m, t, roles.G.id)).toEqual(['K']);
    Ops.updateLetter(m, 'K', { count: /** @type {any} */ ('quatsch'), color: /** @type {any} */ ('lila') });
    expect(Model.letter(m, 'K')?.count).toBe('max1');
    Ops.removeLetter(m, 'K');
    expect(Model.cell(m, t, roles.G.id)).toBeNull();
    const one = Model.create({ variant: 'custom' });
    one.letters = [one.letters[0]];
    Ops.removeLetter(one, 'R');
    expect(one.letters).toHaveLength(1);
  });

  it('ändert die Bedeutung eines Buchstabens und ordnet die Zellen neu', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A', T: 'R' }, Kochen: { L: 'A', T: 'C' } });
    const t = task('Kochen').id;
    Ops.setVariant(m, 'custom');
    const e = Ops.addLetter(m);
    expect(Ops.updateLetter(m, e.key, { key: 'E', kind: 'exec' })).toBe(true);
    expect(Model.letter(m, 'E')?.kind).toBe('exec');
    // E zählt jetzt wie R: tragend für die Rolle und mit A in einer Zelle
    Ops.setKeys(m, t, roles.L.id, ['E', 'A']);
    expect(Model.keys(m, t, roles.L.id)).toEqual(['A', 'E']);
    expect(Checks.roleStats(m, roles.T).lead).toBe(1);
    Ops.setKeys(m, t, roles.T.id, ['E']);
    expect(Checks.roleStats(m, roles.T).lead).toBe(2);
    // neue Bedeutung vor „entscheidet“: Reihenfolge in den Zellen folgt
    Ops.updateLetter(m, 'E', { kind: 'owner' });
    expect(Model.keys(m, t, roles.L.id)).toEqual(['A', 'E']);
    Ops.updateLetter(m, 'A', { kind: 'inform' });
    expect(Model.keys(m, t, roles.L.id)).toEqual(['E', 'A']);
    Ops.updateLetter(m, 'E', { kind: /** @type {any} */ ('quatsch') });
    expect(Model.letter(m, 'E')?.kind).toBe('owner');
  });

  it('setzt Optionen und Regeln', () => {
    const m = Model.create();
    Ops.setOption(m, 'plan', true);
    Ops.setRule(m, 'manyConsult', 200);
    expect(m.options.plan).toBe(true);
    expect(m.rules.manyConsult).toBe(50);
  });

  it('liest Aufgabenlisten und Vorlagen', () => {
    const m = Model.create();
    m.options.phases = false;
    expect(Ops.addTaskList(m, 'Vorher\n# Vorbereitung\n- Ware bestellen\n\n* Stand planen\n## Aufbau\nAufbauen')).toBe(4);
    expect(m.options.phases).toBe(true);
    expect(m.phases.map(p => p.name)).toEqual(['Vorbereitung', 'Aufbau']);
    expect(m.tasks.map(t => [t.name, t.phase ? m.phases.find(p => p.id === t.phase)?.name : ''])).toEqual([['Vorher', ''], ['Ware bestellen', 'Vorbereitung'], ['Stand planen', 'Vorbereitung'], ['Aufbauen', 'Aufbau']]);
    const n = Model.create();
    Ops.applyTemplate(n, { phases: [{ name: 'P', tasks: ['a', 'b'] }], roles: ['X', 'Y'] });
    expect([n.phases.length, n.tasks.length, n.roles.map(r => r.name)]).toEqual([1, 2, ['X', 'Y']]);
  });

  it('dupliziert mit neuen IDs', () => {
    const { m } = build({ 'Ware bestellen': { L: 'A', T: 'R' } });
    Ops.addPhase(m, 'P');
    m.tasks[0].phase = m.phases[0].id;
    Ops.touch(m);
    const c = Ops.duplicate(m, '(Kopie)');
    expect(c.name).toBe('Test (Kopie)');
    expect(c.id).not.toBe(m.id);
    expect(c.tasks[0].id).not.toBe(m.tasks[0].id);
    expect(c.tasks[0].phase).toBe(c.phases[0].id);
    expect(Model.keys(c, c.tasks[0].id, c.roles[0].id)).toEqual(['A']);
    expect(Model.normalize(c)).toEqual(c);
  });
});
