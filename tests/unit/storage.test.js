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
    expect(Store.docIdFromKey(Store.PREFIX + 'x')).toBe('x');
    expect(Store.docIdFromKey('fremd')).toBeNull();
    Store.removeDoc(a.id);
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
    Store.removeDoc('x');
  });

  it('speichert { savedAt, data } und liest ältere Einträge ohne Hülle', () => {
    const neu = Model.create({ name: 'Neu' });
    expect(Store.writeDoc(neu.id, neu, 1000)).toBe(true);
    expect(JSON.parse(localStorage.getItem(Store.PREFIX + neu.id))).toEqual({ savedAt: 1000, data: neu });
    expect(Store.readDoc(neu.id)).toEqual({ id: neu.id, savedAt: 1000, data: neu });
    const alt = Model.create({ name: 'Alt' });
    alt.updatedAt = '2026-03-01T00:00:00.000Z';
    localStorage.setItem(Store.PREFIX + alt.id, JSON.stringify(alt));
    expect(Store.readDoc(alt.id)).toEqual({ id: alt.id, savedAt: Date.parse(alt.updatedAt), data: alt });
    expect(Store.listDocs().map(d => d.data.name)).toEqual(['Alt', 'Neu']);
    expect(Store.docIdFromKey(Store.PREFIX + alt.id)).toBe(alt.id);
    Store.save(alt);
    expect(JSON.parse(localStorage.getItem(Store.PREFIX + alt.id)).data).toEqual(alt);
    Store.removeDoc(alt.id);
    expect(Store.readDoc(alt.id)).toBeNull();
  });

  it('meldet Schreiben und Löschen an einen Beobachter', () => {
    const seen = [];
    Store.observe({ written: id => seen.push(['w', id]), removed: id => seen.push(['r', id]) });
    Store.writeDoc('x1', Store.readDoc('fehlt')?.data ?? {}, 1);
    Store.removeDoc('x1');
    Store.observe({ written: () => {}, removed: () => {} });
    Store.removeDoc('x2');
    expect(seen).toEqual([['w', 'x1'], ['r', 'x1']]);
  });
});
