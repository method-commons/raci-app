/**
 * Typen des Datenmodells – nur für die Typprüfung (tsc/Editor), wird vom Browser nicht geladen.
 * Die Struktur entspricht dem JSON-Export einer Matrix (siehe docs/DATENFORMAT.md).
 */

/** Variante (Buchstabensatz): Vorlage oder eigene Buchstaben */
type VariantId = 'raci' | 'rasci' | 'raci-vs' | 'daci' | 'custom';

/**
 * Bedeutung eines Buchstabens für Prüfungen und Farben: entscheidet (A), führt aus (R), treibt
 * voran (D), unterstützt (S), wird gefragt (C), prüft (V), zeichnet ab (S bei RACI-VS),
 * wird informiert (I), sonstige.
 */
type LetterKind = 'owner' | 'driver' | 'exec' | 'support' | 'consult' | 'verify' | 'signoff' | 'inform' | 'other';

/** Regel je Aufgabe: genau einer, mindestens einer, höchstens einer, beliebig viele */
type CountRule = 'one' | 'min1' | 'max1' | 'any';

/** Farbe eines Buchstabens */
type LetterColor = 'indigo' | 'teal' | 'cyan' | 'orange' | 'violet' | 'blue' | 'pink' | 'gray';

/** Buchstabe der Matrix (bei Vorlagen aus der Variante kopiert, bei „eigene“ frei änderbar) */
interface Letter {
  key: string;
  kind: LetterKind;
  count: CountRule;
  color: LetterColor;
  name: string;
  meaning: string;
}

/** Optionale Bereiche (ausgeblendet heißt nicht gelöscht) */
interface MatrixOptions {
  /** Aufgaben in Phasen gliedern */
  phases: boolean;
  /** „A/R“: entscheidende und ausführende Rolle in einer Zelle */
  combined: boolean;
  /** Personen und Vertretung je Rolle */
  people: boolean;
  /** „Klären“-Markierung und Notiz je Zelle */
  notes: boolean;
  /** Ist / Soll: zweiter Stand je Zelle */
  plan: boolean;
  /** Rollen als extern kennzeichnen */
  external: boolean;
}

/** Prüfregeln; Zahl 0 = aus */
interface MatrixRules {
  /** Regel „mindestens ein …“ (z. B. R) prüfen */
  minExec: boolean;
  /** „Viele C“ ab dieser Zahl je Aufgabe */
  manyConsult: number;
  /** Engpass: Rolle an mehr als diesem Anteil der Aufgaben (Prozent) beteiligt */
  bottleneck: number;
  /** Rolle ohne Aufgabe anmerken */
  emptyRole: boolean;
  /** Aufgaben als Tätigkeit (mit Verb) formuliert */
  verb: boolean;
}

interface Phase {
  id: string;
  name: string;
}

interface Task {
  id: string;
  /** ID der Phase, '' = ohne Phase */
  phase: string;
  name: string;
  /** Verweis (z. B. auf eine Maßnahme oder ein Risiko in einer anderen App), nur Text */
  ref: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  person: string;
  deputy: string;
  external: boolean;
}

/** Zelle: Buchstaben (Ist), Soll (`null` = wie Ist), „klären“, Notiz */
interface Cell {
  v: string[];
  s: string[] | null;
  q: boolean;
  note: string;
}

/** Stand, den Ansicht und Prüfung zeigen: Ist oder Soll */
type PlanMode = 'ist' | 'soll';

/** Eine RACI-Matrix (Speicher- und Exportformat) */
interface Matrix {
  version: number;
  id: string;
  name: string;
  context: string;
  variant: VariantId;
  letters: Letter[];
  options: MatrixOptions;
  rules: MatrixRules;
  phases: Phase[];
  tasks: Task[];
  roles: Role[];
  /** Zellen je Aufgabe und Rolle (leere Zellen fehlen) */
  cells: Record<string, Record<string, Cell>>;
  createdAt: string;
  updatedAt: string;
}

/** Ergebnis einer Prüfung: erfüllt, prüfen, Fehler, offen */
type HintState = 'ok' | 'warn' | 'bad' | 'open';

/** Befund zu einer Aufgabe */
interface TaskIssue {
  rule: 'missing' | 'tooMany' | 'manyConsult' | 'unknown' | 'verb' | 'question' | 'empty';
  level: 'bad' | 'warn' | 'info';
  /** betroffener Buchstabe */
  key?: string;
  n?: number;
}

/** Befund zu einer Rolle */
interface RoleIssue {
  rule: 'bottleneck' | 'manyOwner' | 'emptyRole';
  n?: number;
}

/** Hinweis in der Seitenleiste */
interface Hint {
  key: string;
  state: HintState;
  title: string;
  detail: string;
  tasks?: string[];
  roles?: string[];
}

/** Vorschlag zum Entlasten einer Rolle */
interface Suggestion {
  task: string;
  role: string;
  from: string[];
  to: string[];
  /** Zweite Zelle, die sich mit ändert (z. B. die entscheidende Rolle wird A/R) */
  other?: { role: string, from: string[], to: string[] };
  kind: 'execToOwner' | 'consultToInform' | 'dropInform';
}
