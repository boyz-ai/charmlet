import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LEVELS, type LevelSpec } from '../src/levels/levels';
import { verifyLevel } from '../src/levels/verify';
import { appendPacks, cachedPacks, type PackFile } from '../src/services/packs';

const dir = path.join(process.cwd(), 'public', 'packs');
const index = fs.existsSync(path.join(dir, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) : { packs: [] };

describe('weekly level packs', () => {
  it('index is continuous after the built-in levels', () => {
    let next = 1001;
    for (const e of index.packs) { expect(e.from).toBe(next); next = e.to + 1; }
  });
  const files: string[] = index.packs.map((e: { file: string }) => e.file);
  it.each(files)('%s matches its hash and every level replays to a win', file => {
    const e = index.packs.find((x: { file: string }) => x.file === file);
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    expect(crypto.createHash('sha256').update(text).digest('hex')).toBe(e.sha256);
    const p = JSON.parse(text) as PackFile;
    expect(p.levels.length).toBe(e.to - e.from + 1);
    p.levels.forEach((lv, k) => expect(verifyLevel(lv), `level ${p.from + k}`).toBe(true));
  });
});

describe('level verification', () => {
  it('accepts every built-in level', () => { expect(LEVELS.slice(0, 1000).every(verifyLevel)).toBe(true); });
  it('rejects a broken level', () => {
    const lv = { ...LEVELS[20], sol: LEVELS[20].sol!.slice(0, -1) };
    expect(verifyLevel(lv)).toBe(false);
    expect(verifyLevel({ ...LEVELS[20], moves: LEVELS[20].minMoves - 1 })).toBe(false);
    expect(verifyLevel({ ...LEVELS[20], layout: 'nope' } as unknown as LevelSpec)).toBe(false);
  });
});

describe('appending packs', () => {
  const lv = LEVELS[5];
  const pack = (k: number, from: number): PackFile => ({ pack: k, from, to: from + 1, levels: [lv, lv] });
  it('adds only packs that continue exactly where the levels end', () => {
    const levels = Array(10).fill(lv) as LevelSpec[];
    expect(appendPacks(levels, [pack(2, 13), pack(1, 11)])).toBe(4);
    expect(levels.length).toBe(14);
    expect(appendPacks(levels, [pack(4, 20)])).toBe(0);
  });
  it('drops cached packs that fail verification', () => {
    const bad = { ...pack(1, 1001), levels: [{ ...lv, sol: [] }] } as PackFile;
    const store = { getItem: () => JSON.stringify([pack(1, 1001), bad]), setItem: () => {} };
    expect(cachedPacks(store).length).toBe(1);
  });
});
