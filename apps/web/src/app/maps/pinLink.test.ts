import { describe, expect, it } from 'vitest';
import { pagePath, parsePagePath } from './pages';
import { hiddenFromPlayers, pinLink, withPinLink } from './pinLink';

const pin = { kind: 'pin' as const, id: 'p', x: 0, y: 0, label: 'Inn' };

describe('pin links', () => {
  it('lead to one thing; older pins with several lead to the map first', () => {
    expect(pinLink(pin)).toBeNull();
    expect(pinLink({ ...pin, note: 'Inn.md', entity: 'monster:goblin@mm' })).toEqual({
      kind: 'note',
      path: 'Inn.md',
    });
    expect(pinLink({ ...pin, note: 'Inn.md', map: 'm1' })).toEqual({ kind: 'map', id: 'm1' });
  });

  it('setting a link drops the others', () => {
    const old = { ...pin, note: 'Inn.md', map: 'm1' };
    expect(withPinLink(old, { kind: 'entity', key: 'item:rope@phb' })).toEqual({
      ...pin,
      entity: 'item:rope@phb',
    });
    expect(withPinLink(old, null)).toEqual(pin);
  });

  it('can be hidden from players', () => {
    expect(hiddenFromPlayers({ ...pin, secret: true })).toBe(true);
    expect(hiddenFromPlayers(pin)).toBe(false);
  });
});

describe('pins that lead to a page of the app', () => {
  it('keep a route, and follow it after a map, a note and an entry', () => {
    const pin = { kind: 'pin' as const, id: 'p', x: 1, y: 2, label: 'Keep' };
    const linked = withPinLink(pin, { kind: 'page', path: '/characters/abc' });
    expect(pinLink(linked)).toEqual({ kind: 'page', path: '/characters/abc' });
    // One link only: another kind replaces it.
    expect(pinLink(withPinLink(linked, { kind: 'map', id: 'm1' }))).toEqual({
      kind: 'map',
      id: 'm1',
    });
    expect(pinLink(withPinLink(linked, null))).toBeNull();
    // A map still wins over a page on an older pin that holds both.
    expect(pinLink({ ...linked, map: 'm2' })).toEqual({ kind: 'map', id: 'm2' });
  });

  it('are routes made and read back', () => {
    expect(pagePath('boards', 'xyz')).toBe('/boards/xyz');
    expect(parsePagePath('/encounters/e1')).toEqual({ kind: 'encounters', id: 'e1' });
    expect(parsePagePath('/maps/m1')).toBeNull();
    expect(parsePagePath('/characters')).toBeNull();
    expect(parsePagePath('/boards/a/b')).toBeNull();
  });
});
