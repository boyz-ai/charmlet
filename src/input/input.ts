import type { Game } from '../core/game';
import { angDelta } from '../core/geometry';
import type { Renderer } from '../render/renderer';
import type { FeedbackManager } from '../feedback/feedback';

const TAP_MAX_TURN = 0.08, TAP_MAX_MS = 350, TICK_EVERY = 0.26;

/** Pointer handling: drag a ring to rotate it, tap a ring to release it. */
export function attachInput(cv: HTMLCanvasElement, getGame: () => Game, renderer: Renderer, fb: FeedbackManager): void {
  let drag: { i: number; a: number; moved: number; acc: number; t: number } | null = null;

  const pick = (p: { x: number; y: number }): number => {
    const g = getGame();
    let best = -1, bd = 1e9;
    g.rings.forEach((r, i) => {
      if (r.gone) return;
      const d = Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.r);
      if (d < 26 && d < bd) { bd = d; best = i; }
    });
    if (best < 0) g.rings.forEach((r, i) => {
      if (r.gone) return;
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      if (d < r.r && d < bd) { bd = d; best = i; }
    });
    return best;
  };

  cv.addEventListener('pointerdown', e => {
    fb.unlock();
    const g = getGame();
    if (g.state !== 'play') return;
    const p = renderer.toBoard(e), i = pick(p);
    if (i < 0) return;
    cv.setPointerCapture(e.pointerId);
    const r = g.rings[i];
    drag = { i, a: Math.atan2(p.y - r.y, p.x - r.x), moved: 0, acc: 0, t: performance.now() };
  });

  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const g = getGame(), p = renderer.toBoard(e), r = g.rings[drag.i];
    const a = Math.atan2(p.y - r.y, p.x - r.x), d = angDelta(drag.a, a);
    drag.a = a;
    if (!g.canRotate(drag.i)) return;
    g.rotate(drag.i, d);
    drag.moved += Math.abs(d); drag.acc += Math.abs(d);
    if (drag.acc > TICK_EVERY) { drag.acc = 0; fb.tick(); }
  });

  const up = (): void => {
    if (!drag) return;
    const { i, moved, t } = drag;
    drag = null;
    const g = getGame();
    if (moved < TAP_MAX_TURN && performance.now() - t < TAP_MAX_MS) { g.tap(i); return; }
    g.endDrag(moved);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', () => { drag = null; });
}
