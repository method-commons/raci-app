import { describe, expect, it } from 'vitest';
import { Checks } from '../../js/checks.js';
import { Examples } from '../../js/examples.js';
import { Model } from '../../js/model.js';
import { Variants } from '../../js/variants.js';

describe('Beispiele', () => {
  const keys = Object.keys(Examples.raw);

  it('gibt es für jede Vorlage, in Deutsch und Englisch', () => {
    const used = new Set(keys.map(k => Examples.raw[k].de.variant));
    for (const v of Variants.ORDER) if (v !== 'custom') expect(used.has(v), v).toBe(true);
    for (const k of keys) expect(Object.keys(Examples.raw[k]).sort(), k).toEqual(['de', 'en']);
  });

  it('entsprechen genau dem normalisierten Format', () => {
    for (const k of keys) {
      for (const lang of ['de', 'en']) {
        const raw = Examples.raw[k][lang];
        expect(Model.normalize(JSON.parse(JSON.stringify(raw))), `${k}.${lang}`).toEqual(raw);
      }
    }
  });

  it('haben in beiden Sprachen dieselben Aufgaben, Rollen und Zellen', () => {
    for (const k of keys) {
      const { de, en } = Examples.raw[k];
      expect(en.tasks.map(t => [t.id, t.phase, !!t.ref]), k).toEqual(de.tasks.map(t => [t.id, t.phase, !!t.ref]));
      expect(en.roles.map(r => [r.id, r.person, r.external])).toEqual(de.roles.map(r => [r.id, r.person, r.external]));
      const strip = m => JSON.stringify(m.cells, (key, v) => (key === 'note' ? !!v : v));
      expect(strip(en)).toBe(strip(de));
      expect([en.variant, en.options, en.rules]).toEqual([de.variant, de.options, de.rules]);
    }
  });

  it('zeigen typische Stärken und Schwächen', () => {
    const s = Checks.summary(Model.normalize(Examples.raw.stadtfest.de));
    expect(s).toMatchObject({ tasks: 14, clear: 11, bad: 2, questions: 1 });
    const plan = Model.normalize(Examples.raw.tagesbetrieb.de);
    expect(Checks.diff(plan)).toHaveLength(18);
  });

  it('listen und laden als neue Matrix', () => {
    const list = Examples.list('en');
    expect(list.map(x => x.key)).toEqual(keys.slice().sort());
    const m = Examples.load('stadtfest', 'fr');
    expect(m?.name).toBe('Stadtfest 2026 – Ablauf');
    expect(m?.id).not.toBe('example-stadtfest');
    expect(Examples.load('gibt-es-nicht')).toBeNull();
    expect(Examples.list()[0].matrix.name).toBeTruthy();
  });
});
