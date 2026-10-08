import { describe, expect, it } from 'vitest';
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
