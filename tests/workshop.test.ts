import { describe, expect, it } from 'vitest';
import { defaultSave, LocalSaveService } from '../src/services/save';
import { COLLECTION, COSMETICS, DEFAULT_LOOK, buyOrWear, collected, ownsCos } from '../src/meta/workshop';
import tr from '../src/i18n/tr.json';

describe('Bracelet Workshop', () => {
  it('free items are owned and worn by default', () => {
    const s = defaultSave('tr');
    expect(s.cos.ring).toBe(DEFAULT_LOOK.ring);
    expect(ownsCos(s, 'ring.classic')).toBe(true);
    expect(ownsCos(s, 'ring.gold')).toBe(false);
  });
  it('buying costs coins once, then wearing is free', () => {
    const s = defaultSave('tr');
    expect(buyOrWear(s, 'ring.gold')).toBe('poor');
    s.coins = 1000;
    expect(buyOrWear(s, 'ring.gold')).toBe('bought');
    expect(s.coins).toBe(500);
    expect(s.cos.ring).toBe('ring.gold');
    buyOrWear(s, 'ring.classic');
    expect(buyOrWear(s, 'ring.gold')).toBe('worn');
    expect(s.coins).toBe(500);
  });
  it('one collection charm per 50 finished levels', () => {
    expect(collected(49)).toBe(0);
    expect(collected(50)).toBe(1);
    expect(collected(1000)).toBe(COLLECTION.length);
  });
  it('every cosmetic has a name', () => {
    for (const c of COSMETICS) expect((tr as Record<string, string>)['cos.' + c.id]).toBeTruthy();
  });
  it('old saves get the default look', () => {
    const data: Record<string, string> = { 'charm.save.v1': JSON.stringify({ level: 3 }) };
    const s = new LocalSaveService({ getItem: k => data[k] ?? null, setItem: () => {} }).load();
    expect(s.cos).toEqual({ ...DEFAULT_LOOK, owned: [] });
  });
});
