import { describe, expect, it } from 'vitest';
import { Model } from '../../js/model.js';
import { Variants } from '../../js/variants.js';
import { build } from './fixtures.js';

describe('Model', () => {
  it('legt eine leere Matrix mit den Buchstaben der Variante an', () => {
    const m = Model.create({ name: 'X', variant: 'rasci' });
    expect(m.version).toBe(Model.SCHEMA_VERSION);
    expect(m.letters.map(l => l.key)).toEqual(['R', 'A', 'S', 'C', 'I']);
    expect(m.letters[0]).toMatchObject({ kind: 'exec', count: 'min1', name: 'Responsible', meaning: 'führt aus' });
    expect(m.options).toEqual(Model.DEFAULT_OPTIONS);
    expect(m.rules).toEqual(Model.DEFAULT_RULES);
    expect(Model.create().variant).toBe('raci');
    expect(Model.create({ variant: 'daci' }).rules.bottleneck).toBe(0);
  });

  it('normalisiert beliebige Eingaben', () => {
    expect(() => Model.normalize(null)).toThrow();
    expect(() => Model.normalize([])).toThrow();
    expect(() => Model.normalize({ version: 99 })).toThrow();
    expect(() => Model.normalize({ version: 0 })).toThrow();
    const m = Model.normalize({
      variant: 'quatsch',
      letters: [{ key: 'r', kind: 'exec', count: 'min1', color: 'teal' }, { key: 'R' }, { key: '' }, { key: 'xyzw', kind: 'x', count: 'y', color: 'z' }],
      options: { phases: 'ja', plan: true },
      rules: { manyConsult: 3.6, bottleneck: 500, verb: 'nein' },
      phases: [{ id: 'p', name: 'Eins' }, { id: 'p', name: 'Doppelt' }, 'kaputt'],
      tasks: [{ id: 't', phase: 'p', name: 'A' }, { id: 't2', phase: 'gibt-es-nicht' }],
      roles: [{ id: 'r', name: 'Rolle', external: 1 }],
      cells: { t: { r: { v: ['a', 'R', 'A', ''], s: ['R', 'A'], q: true }, x: { v: ['C'] } }, t2: { r: { v: [] } }, gone: { r: { v: ['A'] } } },
    });
    expect(m.variant).toBe('raci');
    expect(m.letters.map(l => [l.key, l.kind, l.count, l.color])).toEqual([['R', 'exec', 'min1', 'teal'], ['XYZ', 'other', 'any', 'gray']]);
    expect(m.options.phases).toBe(true);
    expect(m.options.plan).toBe(true);
    expect(m.rules).toEqual({ minExec: true, manyConsult: 4, bottleneck: 100, emptyRole: true, verb: true });
    expect(m.phases.map(p => p.name)).toEqual(['Eins', 'Doppelt', '']);
    expect(new Set(m.phases.map(p => p.id)).size).toBe(3);
    expect(m.tasks[1].phase).toBe('');
    expect(m.roles[0].external).toBe(false);
    // Kürzel vereinheitlicht (unbekanntes A hinter R), Soll = Ist entfällt, leere Zellen fehlen
    expect(m.cells).toEqual({ t: { r: { v: ['R', 'A'], s: null, q: true, note: '' } } });
    expect(Model.normalize({ letters: [] }).letters.map(l => l.key)).toEqual(['R', 'A', 'C', 'I']);
  });

  it('liest Zellen im Ist und im Soll', () => {
    const { m, roles, task } = build({ Kochen: { L: 'A', T: 'R' } });
    const t = task('Kochen');
    m.cells[t.id][roles.T.id].s = ['C'];
    expect(Model.keys(m, t.id, roles.T.id)).toEqual(['R']);
    m.options.plan = true;
    expect(Model.mode(m)).toBe('soll');
    expect(Model.keys(m, t.id, roles.T.id)).toEqual(['C']);
    expect(Model.keys(m, t.id, roles.T.id, 'ist')).toEqual(['R']);
    expect(Model.keys(m, t.id, roles.L.id)).toEqual(['A']);
    expect(Model.keys(m, t.id, roles.G.id)).toEqual([]);
    expect(Model.cell(m, 'x', 'y')).toBeNull();
    expect(Model.label(['A', 'R'])).toBe('A/R');
    expect(Model.letter(m, 'A')?.name).toBe('Accountable');
  });

  it('zählt, in wie vielen Zellen ein Kürzel vorkommt (Ist oder Soll)', () => {
    const { m, roles, task } = build({ Kochen: { L: 'A', T: 'R' }, Spülen: { L: 'AR', G: 'I' } });
    expect(Model.usage(m, 'A')).toBe(2);
    expect(Model.usage(m, 'R')).toBe(2);
    expect(Model.usage(m, 'C')).toBe(0);
    m.cells[task('Kochen').id][roles.T.id].s = ['C'];
    expect(Model.usage(m, 'C')).toBe(1);
  });

  it('ordnet A vor R und unbekannte Kürzel ans Ende', () => {
    const letters = Variants.letters('raci');
    expect(Model.sortKeys(letters, ['R', 'Z', 'A', 'B'])).toEqual(['A', 'R', 'B', 'Z']);
    expect(Model.same(['A'], ['A'])).toBe(true);
    expect(Model.same(['A'], ['A', 'R'])).toBe(false);
  });

  it('gruppiert und nummeriert Aufgaben nach Phasen', () => {
    const m = Model.create();
    m.phases = [{ id: 'p1', name: 'Eins' }, { id: 'p2', name: 'Zwei' }];
    m.tasks = [{ id: 'a', phase: 'p2', name: 'a', ref: '' }, { id: 'b', phase: '', name: 'b', ref: '' }, { id: 'c', phase: 'p1', name: 'c', ref: '' }, { id: 'd', phase: 'p2', name: 'd', ref: '' }];
    expect(Model.groups(m).map(g => [g.phase && g.phase.id, g.tasks.map(t => t.id)])).toEqual([[null, ['b']], ['p1', ['c']], ['p2', ['a', 'd']]]);
    expect(Model.ordered(m).map(t => t.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(Model.numbers(m)).toEqual({ b: '1', c: '1.1', a: '2.1', d: '2.2' });
    m.options.phases = false;
    expect(Model.groups(m)).toHaveLength(1);
    expect(Model.numbers(m)).toEqual({ a: '1', b: '2', c: '3', d: '4' });
    const e = Model.create();
    expect(Model.groups(e)).toEqual([{ phase: null, tasks: [] }]);
  });
});
