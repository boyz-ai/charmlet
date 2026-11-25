// Weekly level packs: new levels arrive without an app update.
// CI (.github/workflows/levels.yml) generates a pack of 50 levels every week, the tests replay every solution,
// and GitHub Pages publishes it. The game downloads new packs, checks the file hash and replays every level
// itself before adding it — a broken or tampered pack can never reach the player.
import { verifyLevel } from '../levels/verify';
import type { LevelSpec } from '../levels/levels';

/**
 * Where the packs live: set VITE_PACKS_URL at build time. The web build on GitHub Pages uses "./packs/";
 * the phone apps use the full Pages address, e.g. https://USER.github.io/charm/packs/ (see BASLA.md).
 */
export const PACKS_URL: string = import.meta.env.VITE_PACKS_URL ?? '';
const CACHE = 'charm.packs.v1';

export interface PackFile { pack: number; from: number; to: number; levels: LevelSpec[] }
interface IndexEntry { pack: number; from: number; to: number; file: string; sha256: string }

type Store = Pick<Storage, 'getItem' | 'setItem'> | null;
const safe = (): Store => { try { return window.localStorage; } catch { return null; } };

/** Packs already downloaded earlier (re-verified on load). */
export function cachedPacks(store: Store = safe()): PackFile[] {
  try {
    const list = JSON.parse(store?.getItem(CACHE) ?? '[]') as PackFile[];
    return list.filter(p => p.levels.every(verifyLevel)).sort((a, b) => a.pack - b.pack);
  } catch { return []; }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Append packs to `levels` in order. Only a pack that starts exactly where the levels end is added,
 * so there are never holes. Returns how many levels were added.
 */
export function appendPacks(levels: LevelSpec[], packs: PackFile[]): number {
  let added = 0;
  for (const p of [...packs].sort((a, b) => a.pack - b.pack)) {
    if (p.from !== levels.length + 1 || p.levels.length !== p.to - p.from + 1) continue;
    levels.push(...p.levels); added += p.levels.length;
  }
  return added;
}

/** Download packs that are not cached yet. Never throws; returns the new verified packs. */
export async function fetchNewPacks(have: number, base = PACKS_URL, store: Store = safe()): Promise<PackFile[]> {
  if (!base || typeof fetch !== 'function') return [];
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 6000);
    const index = (await (await fetch(base + 'index.json', { signal: ctl.signal, cache: 'no-cache' })).json()) as { packs: IndexEntry[] };
    clearTimeout(timer);
    const cached = cachedPacks(store), got: PackFile[] = [];
    let next = have + 1;
    for (const e of index.packs.sort((a, b) => a.pack - b.pack)) {
      if (e.to < next || cached.some(c => c.pack === e.pack)) continue;
      if (e.from !== next) break;
      const text = await (await fetch(base + e.file, { cache: 'no-cache' })).text();
      if ((await sha256(text)) !== e.sha256) break;
      const p = JSON.parse(text) as PackFile;
      if (p.pack !== e.pack || p.from !== e.from || !p.levels.every(verifyLevel)) break;
      got.push(p); next = p.to + 1;
    }
    if (got.length) store?.setItem(CACHE, JSON.stringify([...cached, ...got]));
    return got;
  } catch { return []; }
}
