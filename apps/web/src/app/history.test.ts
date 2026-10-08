import { describe, expect, it } from 'vitest';
import { emptyHistory, HISTORY_LIMIT, record, redo, undo } from './history';

describe('undo history', () => {
  it('goes back and forward through changes', () => {
    let h = emptyHistory<string>();
    h = record(h, 'a', 1000);
    h = record(h, 'b', 5000);
    // Now showing "c".
    const back = undo(h, 'c');
    expect(back?.value).toBe('b');
    const back2 = back && undo(back.history, back.value);
    expect(back2?.value).toBe('a');
    expect(back2 && undo(back2.history, back2.value)).toBeNull();
    const forward = back2 && redo(back2.history, back2.value);
    expect(forward?.value).toBe('b');
  });

  it('folds quick runs of changes into one step', () => {
    let h = emptyHistory<string>();
    h = record(h, 'a', 1000);
    h = record(h, 'ab', 1200);
    h = record(h, 'abc', 1400);
    expect(h.past).toEqual(['a']);
    h = record(h, 'abcd', 3000);
    expect(h.past).toEqual(['a', 'abcd']);
  });

  it('drops redo steps on a new change, and keeps a limited number', () => {
    let h = emptyHistory<number>();
    h = record(h, 1, 0);
    const back = undo(h, 2);
    if (!back) throw new Error('no undo');
    h = record(back.history, 1, 10_000);
    expect(redo(h, 3)).toBeNull();
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = record(h, i, 20_000 + i * 1000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
