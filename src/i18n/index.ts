import en from './en.json';
import tr from './tr.json';
import de from './de.json';
import fr from './fr.json';
import es from './es.json';
import pt from './pt.json';
import it from './it.json';
import ru from './ru.json';
import ja from './ja.json';
import ko from './ko.json';
import zh from './zh.json';
import id from './id.json';
import type { Lang } from '../services/save';

export const DICTS: Record<Lang, Record<string, string>> = { en, tr, de, fr, es, pt, it, ru, ja, ko, zh, id };
let current: Lang = 'tr';

export function setLang(l: Lang): void { current = l; document.documentElement.lang = l === 'zh' ? 'zh-Hans' : l; }
export function getLang(): Lang { return current; }

/** Translate a key, replacing {name} placeholders. Falls back to English, then the key. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const s = DICTS[current][key] ?? DICTS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
