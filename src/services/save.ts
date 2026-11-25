export const LANGS = ['en', 'tr', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'ja', 'ko', 'zh', 'id'] as const;
export type Lang = (typeof LANGS)[number];
/** Language names shown in the picker, each in its own language. */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português', it: 'Italiano',
  ru: 'Русский', ja: '日本語', ko: '한국어', zh: '简体中文', id: 'Bahasa Indonesia',
};
const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export interface SaveData {
  /** index of the next level to play (0-based) */
  level: number;
  /** how many levels have ever been finished (unlocks them on the map) */
  best: number;
  streak: number;
  sound: boolean;
  music: boolean;
  /** the booster bar was introduced */
  seenBoosters: boolean;
  vibration: boolean;
  lang: Lang;
  /** false until the player finished the first launch (first launch skips the home screen) */
  seenHome: boolean;
  /** soft currency */
  coins: number;
  /** owned booster uses */
  boosters: { hint: number; undo: number; slot: number; magnet: number };
  /** next step (0–6) of the daily reward track */
  dailyStep: number;
  /** local day (YYYY-MM-DD) the daily reward was last claimed */
  dailyLast: string | null;
  /** bought anything (no forced ads ever again) */
  paid: boolean;
  /** bought the No Ads pack */
  noAds: boolean;
  /** one-time products already bought */
  owned: string[];
  /** seconds played in total (no forced ads in the first minutes) */
  playTime: number;
  /** levels finished since the last forced ad */
  levelsSinceAd: number;
  /** Bracelet Workshop: worn ring / charm / board look and bought items */
  cos: { ring: string; charm: string; board: string; owned: string[] };
}

export interface SaveService { load(): SaveData; save(d: SaveData): void }

export const defaultSave = (lang: Lang): SaveData =>
  ({ level: 0, best: 0, streak: 0, sound: true, music: true, seenBoosters: false, vibration: true, lang, seenHome: false,
    coins: 0, boosters: { hint: 3, undo: 2, slot: 2, magnet: 2 }, dailyStep: 0, dailyLast: null,
    paid: false, noAds: false, owned: [], playTime: 0, levelsSinceAd: 0,
    cos: { ring: 'ring.classic', charm: 'charm.classic', board: 'board.velvet', owned: [] } });

const nat = (v: unknown, d: number): number => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : d);

/** First supported language from the device settings (pt-BR → pt, zh-Hans → zh …), English otherwise. */
export const detectLang = (): Lang => {
  const list = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of list) { const base = tag?.toLowerCase().split(/[-_]/)[0]; if (isLang(base)) return base; }
  return 'en';
};

const KEY = 'charm.save.v1';

/** Browser implementation (localStorage). Capacitor Preferences replaces this in M6. */
export class LocalSaveService implements SaveService {
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()) {}
  load(): SaveData {
    const base = defaultSave(detectLang());
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return base;
      const d = JSON.parse(raw) as Partial<SaveData>;
      return {
        level: Number.isInteger(d.level) && d.level! >= 0 ? d.level! : base.level,
        streak: Number.isInteger(d.streak) && d.streak! >= 0 ? d.streak! : base.streak,
        sound: typeof d.sound === 'boolean' ? d.sound : base.sound,
        music: typeof d.music === 'boolean' ? d.music : base.music,
        seenBoosters: d.seenBoosters === true,
        vibration: typeof d.vibration === 'boolean' ? d.vibration : base.vibration,
        lang: isLang(d.lang) ? d.lang : base.lang,
        seenHome: d.seenHome === true,
        best: nat(d.best, 0),
        coins: nat(d.coins, base.coins),
        boosters: {
          hint: nat(d.boosters?.hint, base.boosters.hint),
          undo: nat(d.boosters?.undo, base.boosters.undo),
          slot: nat(d.boosters?.slot, base.boosters.slot),
          magnet: nat(d.boosters?.magnet, base.boosters.magnet),
        },
        dailyStep: nat(d.dailyStep, 0) % 7,
        paid: d.paid === true,
        noAds: d.noAds === true,
        owned: Array.isArray(d.owned) ? d.owned.filter((x): x is string => typeof x === 'string') : [],
        playTime: typeof d.playTime === 'number' && Number.isFinite(d.playTime) && d.playTime >= 0 ? d.playTime : 0,
        levelsSinceAd: nat(d.levelsSinceAd, 0),
        cos: {
          ring: typeof d.cos?.ring === 'string' ? d.cos.ring : base.cos.ring,
          charm: typeof d.cos?.charm === 'string' ? d.cos.charm : base.cos.charm,
          board: typeof d.cos?.board === 'string' ? d.cos.board : base.cos.board,
          owned: Array.isArray(d.cos?.owned) ? d.cos.owned.filter((x): x is string => typeof x === 'string') : [],
        },
        dailyLast: typeof d.dailyLast === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.dailyLast) ? d.dailyLast : null,
      };
    } catch { return base; }
  }
  save(d: SaveData): void { try { this.storage?.setItem(KEY, JSON.stringify(d)); } catch { /* storage full or blocked */ } }
}

function safeStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }
