import { describe, expect, it } from 'vitest';
import { Checks } from '../../js/checks.js';
import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';
import { build } from './fixtures.js';

const rule = (m, t) => Checks.taskIssues(m, t).map(i => `${i.rule}${i.key ? ':' + i.key : ''}${i.n != null ? ':' + i.n : ''}`);

describe('Checks je Aufgabe', () => {
  it('prüft genau ein A, mindestens ein R, viele C', () => {
    const { m, task } = build({
      'Ware bestellen': { L: 'A', T: 'R' },
      'Kasse abrechnen': { L: 'A', T: 'A' },
      'Gäste begrüßen': { T: 'R' },
      'Preise festlegen': { L: 'A' },
      'Abrechnung prüfen': { L: 'AR', T: 'C', G: 'C' },
      'Leer lassen': {},
    });
    m.rules.manyConsult = 2;
    expect(rule(m, task('Ware bestellen'))).toEqual([]);
    expect(rule(m, task('Kasse abrechnen'))).toEqual(['missing:R:0', 'tooMany:A:2']);
    expect(rule(m, task('Gäste begrüßen'))).toEqual(['missing:A:0']);
    expect(rule(m, task('Preise festlegen'))).toEqual(['missing:R:0']);
    expect(rule(m, task('Abrechnung prüfen'))).toEqual(['manyConsult:C:2']);
    expect(rule(m, task('Leer lassen'))).toEqual(['empty']);
    expect(Checks.status(m, task('Kasse abrechnen'))).toEqual({ level: 'bad', text: '2× A' });
    expect(Checks.status(m, task('Preise festlegen'))).toEqual({ level: 'warn', text: 'kein R' });
    expect(Checks.status(m, task('Leer lassen'))).toEqual({ level: 'empty', text: 'leer' });
    expect(Checks.status(m, task('Ware bestellen'))).toEqual({ level: 'ok', text: '✓' });
    m.rules.minExec = false;
    expect(rule(m, task('Preise festlegen'))).toEqual([]);
    expect(Checks.isClear(Checks.taskIssues(m, task('Abrechnung prüfen')))).toBe(true);
  });

  it('merkt unbekannte Buchstaben, „klären“ und fehlende Tätigkeit an', () => {
    const { m, roles, task } = build({ Kasse: { L: 'A', T: 'R' }, 'Ware bestellen': { L: 'AR', G: 'X' } });
    expect(rule(m, task('Kasse'))).toEqual(['verb']);
    expect(Checks.status(m, task('Kasse')).level).toBe('ok');
    expect(rule(m, task('Ware bestellen'))).toEqual(['unknown:X:1']);
    Ops.setQuestion(m, task('Kasse').id, roles.T.id, true);
    expect(rule(m, task('Kasse'))).toEqual(['verb']);
    m.options.notes = true;
    expect(rule(m, task('Kasse'))).toEqual(['question', 'verb']);
    expect(Checks.status(m, task('Kasse'))).toEqual({ level: 'info', text: 'klären' });
    expect(Checks.isActivity('Standplatz beantragen')).toBe(true);
    expect(Checks.isActivity('Social-Media-Ankündigung')).toBe(false);
    expect(Checks.isActivity('Fritteuse & Kühlung überwachen')).toBe(true);
  });

  it('prüft im Ist oder Soll', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A', T: 'R' } });
    m.options.plan = true;
    Ops.setKeys(m, task('Ware bestellen').id, roles.T.id, ['A'], 'soll');
    expect(Checks.status(m, task('Ware bestellen')).text).toBe('2× A');
    expect(Checks.status(m, task('Ware bestellen'), 'ist').text).toBe('✓');
    expect(Checks.diff(m)).toEqual([{ task: task('Ware bestellen').id, role: roles.T.id, from: ['R'], to: ['A'] }]);
  });
});

describe('Checks je Rolle', () => {
  const rows = {
    'Ware bestellen': { L: 'A', T: 'R' },
    'Kasse abrechnen': { L: 'A', T: 'R', G: 'I' },
    'Preise festlegen': { L: 'AR', T: 'C' },
    'Stand aufbauen': { L: 'A', T: 'R' },
  };

  it('zählt Beteiligung und findet Engpass, viele A und leere Rollen', () => {
    const { m, roles } = build(rows);
    expect(Checks.roleStats(m, roles.L)).toEqual({ counts: { A: 4, R: 1 }, involved: 4, lead: 4, owner: 4 });
    expect(Checks.roleIssues(m, roles.L).map(i => i.rule)).toEqual(['bottleneck', 'manyOwner']);
    expect(Checks.roleIssues(m, roles.G)).toEqual([]);
    Ops.setKeys(m, m.tasks[1].id, roles.G.id, []);
    expect(Checks.roleIssues(m, roles.G).map(i => i.rule)).toEqual(['emptyRole']);
    m.rules.bottleneck = 0;
    m.rules.emptyRole = false;
    expect(Checks.roleIssues(m, roles.L)).toEqual([]);
    expect(Checks.roleIssues(m, roles.G)).toEqual([]);
    expect(Checks.roleIssues(Model.create(), roles.L)).toEqual([]);
    expect(Checks.leadLabel(m)).toBe('A oder R');
  });

  it('fasst die Matrix zusammen und liefert Hinweise', () => {
    const { m, roles } = build({ ...rows, 'Gäste begrüßen': { T: 'R' }, Kasse: { L: 'A', T: 'R' }, 'Leer lassen': {} });
    m.options.notes = true;
    Ops.setQuestion(m, m.tasks[0].id, roles.T.id, true);
    expect(Checks.summary(m)).toEqual({ tasks: 7, clear: 5, bad: 1, warn: 0, questions: 1, empty: 1, roleWarn: 2 });
    const h = Object.fromEntries(Checks.hints(m).map(x => [x.key, x]));
    expect(Object.keys(h)).toEqual(['empty', 'count-A', 'count-R', 'manyConsult', 'bottleneck', 'manyOwner', 'emptyRole', 'verb']);
    expect(h['count-A']).toMatchObject({ state: 'bad', title: 'Genau ein A je Aufgabe', detail: '5 Gäste begrüßen: kein A' });
    expect(h['count-R'].state).toBe('ok');
    expect(h.bottleneck).toMatchObject({ state: 'warn', detail: 'Team an 6 von 7 Aufgaben beteiligt, 5× A oder R', roles: [roles.T.id] });
    expect(h.manyOwner).toMatchObject({ state: 'warn', detail: 'Leitung: 5× A', roles: [roles.L.id] });
    expect(h.verb).toMatchObject({ state: 'warn', tasks: [m.tasks[5].id] });
    expect(h.empty.state).toBe('open');
    expect(Checks.hints(Model.create())).toEqual([expect.objectContaining({ key: 'start', state: 'open' })]);
  });

  it('kürzt lange Listen und merkt unbekannte Buchstaben', () => {
    const { m } = build({ 'a lesen': { T: 'R' }, 'b lesen': { T: 'R' }, 'c lesen': { T: 'R' }, 'd lesen': { T: 'R' }, 'e lesen': { L: 'A', G: 'Z' } });
    const h = Object.fromEntries(Checks.hints(m).map(x => [x.key, x]));
    expect(h['count-A'].detail).toBe('1 a lesen: kein A · 2 b lesen: kein A · 3 c lesen: kein A · +1 weitere');
    expect(h.unknown).toMatchObject({ state: 'warn', detail: '5 e lesen: ? Z' });
  });

  it('schlägt Entlastungen vor', () => {
    const { m, roles, task } = build({ 'Ware bestellen': { L: 'A', T: 'R' }, 'Kasse abrechnen': { L: 'AR', T: 'C' }, 'Stand aufbauen': { L: 'AR', T: 'I' }, 'Gäste begrüßen': { T: 'AR' } });
    const s = Checks.suggestions(m, roles.T);
    expect(s.map(x => x.kind)).toEqual(['execToOwner', 'consultToInform', 'dropInform']);
    expect(s[0]).toMatchObject({ task: task('Ware bestellen').id, from: ['R'], to: ['C'], other: { role: roles.L.id, from: ['A'], to: ['A', 'R'] } });
    m.options.combined = false;
    expect(Checks.suggestions(m, roles.T).map(x => x.kind)).toEqual(['consultToInform', 'dropInform']);
  });
});
