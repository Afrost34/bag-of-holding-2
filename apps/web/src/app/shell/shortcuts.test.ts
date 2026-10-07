import { describe, expect, it } from 'vitest';
import { shortcutFor, type KeyInput } from './shortcuts';

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  typing: false,
  ...extra,
});

describe('shortcuts', () => {
  it('opens modules, tabs and the dice tray with Alt', () => {
    expect(shortcutFor(key('1', { altKey: true }))).toEqual({ kind: 'module', index: 0 });
    expect(shortcutFor(key('0', { altKey: true }))).toEqual({ kind: 'module', index: 9 });
    expect(shortcutFor(key('t', { altKey: true }))).toEqual({ kind: 'newTab' });
    expect(shortcutFor(key('W', { altKey: true, shiftKey: true }))).toEqual({ kind: 'closeTab' });
    expect(shortcutFor(key('PageDown', { altKey: true }))).toEqual({ kind: 'nextTab' });
    expect(shortcutFor(key('d', { altKey: true }))).toEqual({ kind: 'dice' });
    // A Mac's Option key types other characters: the physical key counts.
    expect(shortcutFor(key('†', { altKey: true, code: 'KeyT' }))).toEqual({ kind: 'newTab' });
    expect(shortcutFor(key('¡', { altKey: true, code: 'Digit1' }))).toEqual({
      kind: 'module',
      index: 0,
    });
    // Alt shortcuts work while typing too; Ctrl+Alt is something else.
    expect(shortcutFor(key('t', { altKey: true, typing: true }))).toEqual({ kind: 'newTab' });
    expect(shortcutFor(key('t', { altKey: true, ctrlKey: true }))).toBeNull();
  });

  it('opens search and help with plain keys, but not while typing', () => {
    expect(shortcutFor(key('/'))).toEqual({ kind: 'search' });
    expect(shortcutFor(key('?', { shiftKey: true }))).toEqual({ kind: 'help' });
    expect(shortcutFor(key('/', { typing: true }))).toBeNull();
    expect(shortcutFor(key('x'))).toBeNull();
  });
});
