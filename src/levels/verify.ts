import { Game } from '../core/game';
import { angDelta } from '../core/geometry';
import { LAYOUTS, type LevelSpec } from './levels';

const ROLES = /^(tut1|tut2|normal|hard|relief|super|bonus|new_[a-z]+)$/;

/** Is this a well-formed level whose stored solution really wins it within the move limit? */
export function verifyLevel(spec: LevelSpec): boolean {
  try {
    if (!spec || !(spec.layout in LAYOUTS) || !ROLES.test(spec.role) || !Array.isArray(spec.sol)) return false;
    const n = LAYOUTS[spec.layout].pts.length;
    if (spec.colors?.length !== n || spec.gaps?.length !== n || !(spec.moves >= spec.minMoves)) return false;
    const g = new Game(spec, LAYOUTS[spec.layout]);
    for (const [i, deg] of spec.sol) {
      if (!(i >= 0 && i < n)) return false;
      if (deg === null) {
        const c = g.rings[i].c;
        if (g.tap(i) !== 'released') return false;
        g.charmLanded(c);
      } else {
        if (!g.canRotate(i)) return false;
        g.rotate(i, angDelta(g.rings[i].g, (deg * Math.PI) / 180));
        g.endDrag(1, i);
      }
    }
    return g.state === 'won' && spec.moves - g.moves === spec.minMoves;
  } catch { return false; }
}
