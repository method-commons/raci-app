import { describe, expect, it } from 'vitest';
import { Util } from '../../js/util.js';

describe('Util', () => {
  it('erzeugt eindeutige IDs mit Präfix', () => {
    const a = Util.uid('m');
    expect(a).toMatch(/^m[a-z0-9]+$/);
    expect(Util.uid('m')).not.toBe(a);
  });

  it('liefert Tag und Zeitstempel', () => {
    expect(Util.today(new Date(2026, 9, 4))).toBe('2026-10-04');
    expect(Util.now(new Date(Date.UTC(2026, 0, 2)))).toBe('2026-01-02T00:00:00.000Z');
  });

  it('prüft und formatiert Tage', () => {
    expect(Util.isDay('2026-10-04')).toBe(true);
    expect(Util.isDay('2026-02-30')).toBe(false);
    expect(Util.isDay(5)).toBe(false);
    expect(Util.formatDay('2026-10-04', 'de-DE', 2026)).toBe('4.10.');
    expect(Util.formatDay('2025-10-04', 'de-DE', 2026)).toBe('4.10.2025');
    expect(Util.formatDay('kaputt', 'de-DE')).toBe('');
  });

  it('macht Dateinamen, Platzhalter, Initialen', () => {
    expect(Util.fileName('Ideen Saison 2027!', 'json')).toBe('ideen-saison-2027.json');
    expect(Util.fileName('', 'md')).toBe('matrix.md');
    expect(Util.fileName('Größe', 'md')).toBe('grosse.md');
    expect(Util.fill('{n} von {m} {x}', { n: 1, m: 2 })).toBe('1 von 2 {x}');
    expect(Util.fill('ohne')).toBe('ohne');
    expect(Util.initials('Aylin Kaya')).toBe('AK');
    expect(Util.initials('  ')).toBe('?');
  });

  it('begrenzt und rundet auf Schritte', () => {
    expect(Util.clamp(12, 0, 10)).toBe(10);
    expect(Util.clamp(-1, 0, 10)).toBe(0);
    expect(Util.snap(3.26, 0, 10, 0.5)).toBe(3.5);
    expect(Util.snap(3.24, 0, 10, 0.5)).toBe(3);
    expect(Util.snap(11, 0, 10, 0.5)).toBe(10);
    expect(Util.snap(1.6, 1, 2, 1)).toBe(2);
    expect(Util.snap(3.14159, 0, 10, 0)).toBe(3.1);
    expect(Util.snap(0.3, 0.1, 1, 0.2)).toBe(0.3);
  });

  it('formatiert Zahlen und Anzahlen', () => {
    expect(Util.formatNumber(6.5, 'de-DE')).toBe('6,5');
    expect(Util.formatNumber(6.25, 'en-GB')).toBe('6.3');
    expect(Util.count(1, 'Idee', 'Ideen')).toBe('1 Idee');
    expect(Util.count(3, 'Idee', 'Ideen')).toBe('3 Ideen');
  });
});
