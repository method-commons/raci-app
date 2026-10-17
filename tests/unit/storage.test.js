import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Model } from '../../js/model.js';
import { Store } from '../../js/storage.js';
import { memoryStorage } from './fixtures.js';

describe('Store', () => {
  let mem;
  beforeEach(() => {
    mem = memoryStorage();
    vi.stubGlobal('localStorage', mem);
  });

  it('speichert, lädt, listet und entfernt Matrizen', () => {
    const a = Model.create({ name: 'Eins' });
    a.updatedAt = '2026-01-01T00:00:00.000Z';
    const b = Model.create({ name: 'Zwei' });
    b.updatedAt = '2026-02-01T00:00:00.000Z';
    expect(Store.save(a)).toBe(true);
    Store.save(b);
    mem.setItem(Store.PREFIX + 'kaputt', '{');
    mem.setItem('fremd', '1');
    expect(Store.all().map(m => m.name)).toEqual(['Zwei', 'Eins']);
    expect(Store.load(a.id)?.name).toBe('Eins');
    expect(Store.load('gibt-es-nicht')).toBeNull();
    expect(Store.matrixIdOfKey(Store.PREFIX + 'x')).toBe('x');
    expect(Store.matrixIdOfKey('fremd')).toBeNull();
    Store.removeMatrix(a.id);
    expect(Store.load(a.id)).toBeNull();
  });

  it('merkt den Standard für neue Matrizen', () => {
    expect(Store.defaults()).toBeNull();
    const m = Model.create();
    m.options.plan = true;
    m.rules.manyConsult = 3;
    Store.saveDefaults({ options: m.options, rules: m.rules });
    expect(Store.defaults()).toEqual({ options: m.options, rules: m.rules });
    mem.setItem(Store.DEFAULTS_KEY, '{');
    expect(Store.defaults()).toBeNull();
    mem.setItem(Store.DEFAULTS_KEY, '3');
    expect(Store.defaults()).toBeNull();
  });

  it('kommt ohne Speicher aus', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(Store.save(Model.create())).toBe(false);
    expect(Store.all()).toEqual([]);
    expect(Store.load('x')).toBeNull();
    expect(Store.defaults()).toBeNull();
    Store.removeMatrix('x');
  });
});
