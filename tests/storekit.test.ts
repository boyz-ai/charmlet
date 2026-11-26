import { describe, expect, it } from 'vitest';
import { GrantedLog, gameId, storeId } from '../src/native/storekit';
import { PRODUCTS } from '../src/services/monetize';

describe('App Store product ids', () => {
  it('round-trips every product', () => {
    for (const p of PRODUCTS) expect(gameId(storeId(p.id))).toBe(p.id);
    expect(storeId('noads')).toBe('com.mucahitkurkaya.charmlet.noads');
  });
  it('ignores unknown products', () => {
    expect(gameId('com.mucahitkurkaya.charmlet.gems')).toBeNull();
    expect(gameId('com.other.app.noads')).toBeNull();
  });
});
describe('granted transaction log', () => {
  it('remembers transactions across restarts so nothing is granted twice', () => {
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = new GrantedLog(st);
    expect(a.has('t1')).toBe(false);
    a.add('t1'); a.add('t1');
    const b = new GrantedLog(st);
    expect(b.has('t1')).toBe(true);
  });
  it('survives a broken store value', () => {
    const st = { getItem: () => '{oops', setItem: () => undefined };
    expect(new GrantedLog(st).has('x')).toBe(false);
  });
});
