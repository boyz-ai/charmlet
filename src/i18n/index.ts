import tr from './tr.json';
import en from './en.json';
import type { Lang } from '../services/save';

export const DICTS: Record<Lang, Record<string, string>> = { tr, en };
let current: Lang = 'tr';

export function setLang(l: Lang): void { current = l; document.documentElement.lang = l; }
export function getLang(): Lang { return current; }

/** Translate a key, replacing {name} placeholders. Falls back to English, then the key. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
