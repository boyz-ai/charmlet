import { GAP, MOVE_THRESHOLD, Pt, angDiff, angleOf, circleIntersections } from './geometry';
import type { Color, Layout, LevelSpec } from '../levels/levels';

export const TRAY_SLOTS = 5;
export const MERGE_COUNT = 3;

export interface Ring { x: number; y: number; r: number; c: Color; g: number; gone: boolean; pins: number[] }
export interface Link { a: number; b: number; p: [Pt, Pt] }

export type GameEvent =
  | { type: 'release'; ring: number; color: Color; from: Pt; slot: number }
  | { type: 'merge'; color: Color; slots: number[] }
  | { type: 'locked'; ring: number }
  | { type: 'becameFree'; ring: number }
  | { type: 'move'; movesLeft: number }
  | { type: 'win' }
  | { type: 'lose'; reason: 'tray' | 'moves' };

export type GameState = 'play' | 'won' | 'lost';

/** Pure game rules. No DOM, no canvas. */
export class Game {
  rings: Ring[];
  links: Link[] = [];
  tray: Color[] = [];
  /** charms released but not yet landed in the tray (animation in flight) */
  inFlight = 0;
  moves: number;
  state: GameState = 'play';
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(spec: LevelSpec, layout: Layout) {
    this.moves = spec.moves;
    this.rings = layout.pts.map(([x, y], i) => ({
      x, y, r: layout.r, c: spec.colors[i], g: (spec.gaps[i] * Math.PI) / 180, gone: false, pins: [],
    }));
    spec.pins.forEach(([i, deg]) => this.rings[i].pins.push((deg * Math.PI) / 180));
    for (let i = 0; i < this.rings.length; i++)
      for (let j = i + 1; j < this.rings.length; j++) {
        const p = circleIntersections(this.rings[i], this.rings[j]);
        if (p) this.links.push({ a: i, b: j, p });
      }
  }

  on(fn: (e: GameEvent) => void): void { this.listeners.push(fn); }
  private emit(e: GameEvent): void { this.listeners.forEach(f => f(e)); }

  covers(i: number, p: Pt): boolean { const r = this.rings[i]; return angDiff(angleOf(r, p), r.g) < GAP; }
  inGap(i: number, angle: number): boolean { return angDiff(angle, this.rings[i].g) < GAP; }
  linkOpen(L: Link): boolean { return L.p.some(p => this.covers(L.a, p) || this.covers(L.b, p)); }

  /** Free = every pin on the ring is inside its gap and every link to a present ring is open. */
  isFree(i: number): boolean {
    const r = this.rings[i];
    if (r.gone) return false;
    if (r.pins.some(a => !this.inGap(i, a))) return false;
    return this.links.every(L => {
      if (L.a !== i && L.b !== i) return true;
      const other = L.a === i ? L.b : L.a;
      return this.rings[other].gone || this.linkOpen(L);
    });
  }

  anyFree(): boolean { return this.rings.some((_, i) => this.isFree(i)); }

  /** Can the player start rotating ring i? (no moves left → only free rings react) */
  canRotate(i: number): boolean { return this.state === 'play' && !this.rings[i].gone && this.moves > 0; }

  /** Rotate during a drag. Emits becameFree when the ring turns free. */
  rotate(i: number, delta: number): void {
    if (!this.canRotate(i)) return;
    const was = this.isFree(i);
    this.rings[i].g += delta;
    if (!was && this.isFree(i)) this.emit({ type: 'becameFree', ring: i });
  }

  /** Call when a drag ends. Counts one move if the ring turned far enough. */
  endDrag(totalTurn: number): void {
    if (this.state !== 'play' || totalTurn <= MOVE_THRESHOLD) return;
    this.moves = Math.max(0, this.moves - 1);
    this.emit({ type: 'move', movesLeft: this.moves });
    this.checkEnd();
  }

  /** Tap a ring: release it if free, otherwise report locked. */
  tap(i: number): 'released' | 'locked' | 'ignored' {
    if (this.state !== 'play' || this.rings[i].gone) return 'ignored';
    if (!this.isFree(i)) { this.emit({ type: 'locked', ring: i }); return 'locked'; }
    const r = this.rings[i];
    r.gone = true;
    const a = r.g + Math.PI;
    const slot = Math.min(this.tray.length + this.inFlight, TRAY_SLOTS - 1);
    this.inFlight++;
    this.emit({ type: 'release', ring: i, color: r.c, from: { x: r.x + Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r }, slot });
    return 'released';
  }

  /** The renderer calls this when a released charm lands in the tray. */
  charmLanded(color: Color): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.tray.push(color);
    const idx = this.tray.map((c, k) => (c === color ? k : -1)).filter(k => k >= 0);
    if (idx.length >= MERGE_COUNT) {
      const slots = idx.slice(0, MERGE_COUNT);
      this.tray = this.tray.filter((_, k) => !slots.includes(k));
      this.emit({ type: 'merge', color, slots });
    }
    this.checkEnd();
  }

  addMoves(n: number): void {
    this.moves += n;
    if (this.state === 'lost') this.state = 'play';
    this.emit({ type: 'move', movesLeft: this.moves });
  }

  checkEnd(): void {
    if (this.state !== 'play' || this.inFlight > 0) return;
    if (this.rings.every(r => r.gone) && this.tray.length === 0) { this.state = 'won'; this.emit({ type: 'win' }); return; }
    if (this.tray.length >= TRAY_SLOTS) { this.state = 'lost'; this.emit({ type: 'lose', reason: 'tray' }); return; }
    if (this.moves <= 0 && !this.anyFree()) { this.state = 'lost'; this.emit({ type: 'lose', reason: 'moves' }); }
  }
}
