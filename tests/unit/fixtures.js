import { Model } from '../../js/model.js';
import { Ops } from '../../js/ops.js';

/**
 * Kleine Matrix: Rollen L (Leitung), T (Team), G (Gast); Aufgaben mit Buchstaben
 * je Rolle, z. B. `{ 'Ware bestellen': { L: 'A', T: 'R' } }`. A/R als 'AR'.
 * @param {Record<string, Record<string, string>>} rows @param {object} [init]
 */
export function build(rows, init = {}) {
  const m = Model.create({ name: 'Test', ...init });
  const roles = { L: Ops.addRole(m, { name: 'Leitung', person: 'Lea' }), T: Ops.addRole(m, { name: 'Team', person: 'Tom' }), G: Ops.addRole(m, { name: 'Gast' }) };
  for (const [name, cells] of Object.entries(rows)) {
    const t = Ops.addTask(m, { name });
    for (const [r, v] of Object.entries(cells)) Ops.setKeys(m, t.id, roles[r].id, v === 'AR' ? ['A', 'R'] : [...v], 'ist');
  }
  return { m, roles, task: name => m.tasks.find(t => t.name === name) };
}

/** Einfacher localStorage für Node (mit aufzählbaren Schlüsseln wie im Browser). */
export function memoryStorage() {
  const data = new Map();
  const api = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); },
    clear: () => data.clear(),
  };
  return new Proxy(api, {
    ownKeys: () => [...data.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}
