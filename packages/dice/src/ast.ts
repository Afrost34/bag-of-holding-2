/** Parsed dice expression. Produced by `parse`, consumed by `evaluate`. */

export type KeepMode = 'kh' | 'kl' | 'dh' | 'dl';

export interface Prompt {
  /** Text shown to the user, e.g. "Enter Strength Score". */
  title: string;
  default?: number;
  min?: number;
  max?: number;
}

export type Node =
  | { kind: 'number'; value: number }
  | { kind: 'dice'; count: Node; faces: Node; keep?: { mode: KeepMode; count: number } }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
  | { kind: 'negate'; operand: Node }
  | { kind: 'call'; fn: 'ceil' | 'floor' | 'round'; arg: Node }
  | { kind: 'variable'; name: string }
  | { kind: 'prompt'; prompt: Prompt };

export interface Expression {
  /** The text as written (trimmed). */
  source: string;
  root: Node;
}
