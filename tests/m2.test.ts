import { describe, expect, it } from 'vitest';
import { LocalSaveService, defaultSave } from '../src/services/save';
import tr from '../src/i18n/tr.json';
import en from '../src/i18n/en.json';
import { LEVELS } from '../src/levels/levels';

const mem = (): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('save service', () => {
  it('returns defaults when nothing is saved', () => {
    const s = new LocalSaveService(mem()).load();
    expect(s.level).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.sound).toBe(true);
    expect(s.seenHome).toBe(false);
  });
  it('round-trips progress and settings', () => {
    const m = mem(), svc = new LocalSaveService(m);
    svc.save({ ...defaultSave('en'), level: 5, streak: 3, sound: false, vibration: false, seenHome: true });
    expect(svc.load()).toEqual({ level: 5, streak: 3, sound: false, vibration: false, lang: 'en', seenHome: true });
  });
  it('survives corrupted data', () => {
    const m = mem(); m.data['charm.save.v1'] = '{oops';
    expect(new LocalSaveService(m).load().level).toBe(0);
  });
  it('rejects invalid values field by field', () => {
    const m = mem(); m.data['charm.save.v1'] = JSON.stringify({ level: -2, streak: 'x', lang: 'de', sound: false });
    const s = new LocalSaveService(m).load();
    expect(s.level).toBe(0); expect(s.streak).toBe(0); expect(s.sound).toBe(false);
    expect(['tr', 'en']).toContain(s.lang);
  });
  it('works without storage at all', () => {
    const svc = new LocalSaveService(null);
    expect(() => svc.save(defaultSave('tr'))).not.toThrow();
    expect(svc.load().level).toBe(0);
  });
});

describe('translations', () => {
  it('TR and EN have exactly the same keys', () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
  });
  it('every level role has a name and a hint in both languages', () => {
    for (const l of LEVELS) for (const d of [tr, en] as Record<string, string>[]) {
      expect(d['role.' + l.role]).toBeTruthy();
      expect(d['hint.' + l.role]).toBeTruthy();
    }
  });
});
