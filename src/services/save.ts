export type Lang = 'tr' | 'en';

export interface SaveData {
  /** index of the next level to play (0-based) */
  level: number;
  streak: number;
  sound: boolean;
  vibration: boolean;
  lang: Lang;
  /** false until the player finished the first launch (first launch skips the home screen) */
  seenHome: boolean;
  /** soft currency */
  coins: number;
  /** owned booster uses */
  boosters: { undo: number; slot: number; magnet: number };
  /** next step (0–6) of the daily reward track */
  dailyStep: number;
  /** local day (YYYY-MM-DD) the daily reward was last claimed */
  dailyLast: string | null;
}

export interface SaveService { load(): SaveData; save(d: SaveData): void }

export const defaultSave = (lang: Lang): SaveData =>
  ({ level: 0, streak: 0, sound: true, vibration: true, lang, seenHome: false,
    coins: 0, boosters: { undo: 2, slot: 2, magnet: 2 }, dailyStep: 0, dailyLast: null });

const nat = (v: unknown, d: number): number => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : d);

export const detectLang = (): Lang =>
  (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr')) ? 'tr' : 'en';

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
        vibration: typeof d.vibration === 'boolean' ? d.vibration : base.vibration,
        lang: d.lang === 'tr' || d.lang === 'en' ? d.lang : base.lang,
        seenHome: d.seenHome === true,
        coins: nat(d.coins, base.coins),
        boosters: {
          undo: nat(d.boosters?.undo, base.boosters.undo),
          slot: nat(d.boosters?.slot, base.boosters.slot),
          magnet: nat(d.boosters?.magnet, base.boosters.magnet),
        },
        dailyStep: nat(d.dailyStep, 0) % 7,
        dailyLast: typeof d.dailyLast === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.dailyLast) ? d.dailyLast : null,
      };
    } catch { return base; }
  }
  save(d: SaveData): void { try { this.storage?.setItem(KEY, JSON.stringify(d)); } catch { /* storage full or blocked */ } }
}

function safeStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }
