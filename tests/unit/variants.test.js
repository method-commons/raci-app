import { describe, expect, it } from 'vitest';
import { Variants } from '../../js/variants.js';

describe('Variants', () => {
  it('kennt die Varianten mit ihren Buchstaben', () => {
    expect(Variants.ORDER).toEqual(['raci', 'rasci', 'raci-vs', 'daci', 'custom']);
    expect(Variants.known('daci')).toBe(true);
    expect(Variants.known('x')).toBe(false);
    expect(Variants.known(3)).toBe(false);
    expect(Variants.letters('raci-vs').map(l => `${l.key}:${l.kind}:${l.count}`)).toEqual(['R:exec:min1', 'A:owner:one', 'C:consult:any', 'I:inform:any', 'V:verify:any', 'S:signoff:max1']);
    expect(Variants.letters('daci')[0]).toMatchObject({ key: 'D', kind: 'driver', count: 'one', name: 'Driver' });
    expect(Variants.letters('custom').map(l => l.key)).toEqual(['R', 'A', 'C', 'I']);
    expect(Variants.texts('rasci').name).toBe('RASCI');
  });

  it('errät die Variante aus Kürzeln', () => {
    expect(Variants.guess(['A', 'R'])).toBe('raci');
    expect(Variants.guess(['A', 'S'])).toBe('rasci');
    expect(Variants.guess(['V', 'S'])).toBe('raci-vs');
    expect(Variants.guess(['D'])).toBe('daci');
    expect(Variants.guess(['O'])).toBe('custom');
  });
});
