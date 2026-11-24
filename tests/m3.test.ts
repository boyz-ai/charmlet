import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { LAYOUTS, LEVELS } from '../src/levels/levels';

/** Play a level by always following the hint (rotations count as moves, landing is instant). */
function playByHints(n: number): Game {
  const spec = LEVELS[n];
  const g = new Game(spec, LAYOUTS[spec.layout]);
  for (let step = 0; step < 100 && g.state === 'play'; step++) {
    const s = g.suggest();
    if (!s) break;
    if (s.type === 'tap') {
      const r = g.rings[s.ring];
      expect(g.tap(s.ring)).toBe('released');
      g.charmLanded(r.c);
    } else {
      g.rotate(s.ring, s.target - g.rings[s.ring].g);
      g.endDrag(1);
    }
  }
  return g;
}

describe('hints', () => {
  it('level 1 starts with a rotation hint that frees a ring', () => {
    const spec = LEVELS[0];
    const g = new Game(spec, LAYOUTS[spec.layout]);
    const s = g.suggest();
    expect(s?.type).toBe('rotate');
    if (s?.type === 'rotate') { g.rings[s.ring].g = s.target; expect(g.anyFree()).toBe(true); }
  });
  it('suggests tapping when a ring is free', () => {
    const spec = LEVELS[0];
    const g = new Game(spec, LAYOUTS[spec.layout]);
    const s = g.suggest();
    if (s?.type === 'rotate') g.rings[s.ring].g = s.target;
    expect(g.suggest()?.type).toBe('tap');
  });
  it.each(LEVELS.map((_, i) => i))('following hints never gets stuck on level %i', n => {
    const g = playByHints(n);
    expect(['won', 'lost', 'play']).toContain(g.state);
    expect(g.state).not.toBe('play');
  });
});
