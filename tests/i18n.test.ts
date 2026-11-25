import { describe, expect, it } from 'vitest';
import { DICTS } from '../src/i18n';
import { LANGS, LANG_NAMES } from '../src/services/save';

const ph = (s: string): string => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('translations', () => {
  const en = DICTS.en;
  it.each(LANGS.map(l => [l]))('%s has every text with the same {placeholders}', l => {
    const d = DICTS[l];
    expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en)) {
      expect(d[k], `${l}:${k}`).toBeTruthy();
      expect(ph(d[k]), `${l}:${k}`).toBe(ph(en[k]));
    }
  });
  it('every language has a picker name', () => LANGS.forEach(l => expect(LANG_NAMES[l]).toBeTruthy()));
});
