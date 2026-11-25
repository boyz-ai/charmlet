import { GAP, MOVE_THRESHOLD, Pt, angDiff, angleOf, circleIntersections } from './geometry';
import type { Color, Layout, LevelSpec } from '../levels/levels';

export const TRAY_SLOTS = 5;
export const MERGE_COUNT = 3;

export interface Ring {
  x: number; y: number; r: number; c: Color;
  /** gap angle (radians) */
  g: number;
  gone: boolean;
  pins: number[];
  /** cannot be rotated */
  fixed: boolean;
  /** has a second gap opposite the first */
  twin: boolean;
  /** padlocked until the first merge in the tray */
  lock: boolean;
  /** rotations left for an ice ring (null = not ice) */
  ice: number | null;
  /** turning it costs 2 moves */
  heavy: boolean;
  /** bomb: the level is lost when this many moves have been spent while the ring is still on the board (null = no bomb) */
  bomb: number | null;
  /** color lock: stays until a triple of this color merged in the tray (null = none) */
  clock: Color | null;
}

/** Max rotations of an ice ring. */
export const ICE_ROTATIONS = 2;
export interface Link { a: number; b: number; p: [Pt, Pt] }

export type GameEvent =
  | { type: 'release'; ring: number; color: Color; from: Pt; slot: number }
  | { type: 'merge'; color: Color; slots: number[] }
  | { type: 'locked'; ring: number }
  | { type: 'becameFree'; ring: number }
  | { type: 'move'; movesLeft: number }
  | { type: 'win' }
  | { type: 'lose'; reason: 'tray' | 'moves' | 'bomb' }
  | { type: 'undo'; ring: number }
  | { type: 'slot'; slots: number }
  | { type: 'magnet'; color: Color; slots: number[] };

export type GameState = 'play' | 'won' | 'lost';

export type Suggestion =
  | { type: 'tap'; ring: number }
  | { type: 'rotate'; ring: number; target: number };

/** Pure game rules. No DOM, no canvas. */
export class Game {
  rings: Ring[];
  links: Link[] = [];
  tray: Color[] = [];
  /** charms released but not yet landed in the tray (animation in flight) */
  inFlight = 0;
  moves: number;
  /** number of merges so far (opens lock rings) */
  merges = 0;
  /** merges per color (opens color-lock rings) */
  mergesBy: Record<Color, number> = { r: 0, b: 0, g: 0 };
  /** moves spent on rotations (drives the bomb countdowns) */
  spent = 0;
  state: GameState = 'play';
  /** tray size for this level (the Extra slot booster raises it to TRAY_SLOTS + 1) */
  slots = TRAY_SLOTS;
  /** counted rotations that can be undone (most recent last) */
  private history: { ring: number; g: number; ice: number | null; cost?: number }[] = [];
  /** ring and gap angle at the start of the current drag */
  private dragFrom: { ring: number; g: number; ice: number | null } | null = null;
  private listeners: ((e: GameEvent) => void)[] = [];

  constructor(spec: LevelSpec, layout: Layout) {
    this.moves = spec.moves;
    this.rings = layout.pts.map(([x, y], i) => ({
      x, y, r: layout.r, c: spec.colors[i], g: (spec.gaps[i] * Math.PI) / 180, gone: false, pins: [],
      fixed: !!spec.fixed?.includes(i), twin: !!spec.twin?.includes(i), lock: !!spec.lock?.includes(i),
      ice: spec.ice?.includes(i) ? ICE_ROTATIONS : null,
      heavy: !!spec.heavy?.includes(i),
      bomb: spec.bomb?.find(([k]) => k === i)?.[1] ?? null,
      clock: spec.clock?.find(([k]) => k === i)?.[1] ?? null,
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

  /** Is this angle inside ring i's gap (or its second gap for twin rings)? */
  inGap(i: number, angle: number): boolean {
    const r = this.rings[i];
    return angDiff(angle, r.g) < GAP || (r.twin && angDiff(angle, r.g + Math.PI) < GAP);
  }
  covers(i: number, p: Pt): boolean { return this.inGap(i, angleOf(this.rings[i], p)); }
  /** Where the charm hangs on the ring (opposite the gap; between the gaps for twin rings). */
  charmAngle(i: number): number { const r = this.rings[i]; return r.g + (r.twin ? Math.PI / 2 : Math.PI); }
  linkOpen(L: Link): boolean { return L.p.some(p => this.covers(L.a, p) || this.covers(L.b, p)); }

  /** Free = every pin on the ring is inside its gap and every link to a present ring is open. */
  isFree(i: number): boolean {
    const r = this.rings[i];
    if (r.gone) return false;
    if (r.lock && this.merges < 1) return false;
    if (r.clock && this.mergesBy[r.clock] < 1) return false;
    if (r.pins.some(a => !this.inGap(i, a))) return false;
    return this.links.every(L => {
      if (L.a !== i && L.b !== i) return true;
      const other = L.a === i ? L.b : L.a;
      return this.rings[other].gone || this.linkOpen(L);
    });
  }

  anyFree(): boolean { return this.rings.some((_, i) => this.isFree(i)); }

  /** Can ring i ever turn again? (fixed rings never; ice rings only while they have rotations left) */
  rotatable(i: number): boolean { const r = this.rings[i]; return !r.gone && !r.fixed && (r.ice === null || r.ice > 0); }
  /** Can the player rotate ring i right now? */
  canRotate(i: number): boolean { return this.state === 'play' && this.moves >= this.cost(i) && this.rotatable(i); }
  /** Moves one rotation of ring i costs (heavy rings cost 2). */
  cost(i: number): number { return this.rings[i].heavy ? 2 : 1; }
  /** Moves left before bomb ring i explodes (null = not a bomb). */
  bombLeft(i: number): number | null { const b = this.rings[i].bomb; return b === null ? null : Math.max(0, b - this.spent); }

  /** Rotate during a drag. Emits becameFree when the ring turns free. */
  rotate(i: number, delta: number): void {
    if (!this.canRotate(i)) return;
    if (this.dragFrom?.ring !== i) this.dragFrom = { ring: i, g: this.rings[i].g, ice: this.rings[i].ice };
    const was = this.isFree(i);
    this.rings[i].g += delta;
    if (!was && this.isFree(i)) this.emit({ type: 'becameFree', ring: i });
  }

  /** Call when a drag of ring i ends. Counts one move (and one ice charge) if it turned far enough. */
  endDrag(totalTurn: number, i?: number): void {
    const from = this.dragFrom;
    this.dragFrom = null;
    if (this.state !== 'play' || totalTurn <= MOVE_THRESHOLD) return;
    const cost = i === undefined ? 1 : this.cost(i);
    if (from && from.ring === i) this.history.push({ ...from, cost });
    this.moves = Math.max(0, this.moves - cost);
    this.spent += cost;
    const r = i === undefined ? undefined : this.rings[i];
    if (r && r.ice !== null) r.ice = Math.max(0, r.ice - 1);
    this.emit({ type: 'move', movesLeft: this.moves });
    this.checkEnd();
  }

  /** Tap a ring: release it if free, otherwise report locked. */
  tap(i: number): 'released' | 'locked' | 'ignored' {
    if (this.state !== 'play' || this.rings[i].gone) return 'ignored';
    if (!this.isFree(i)) { this.emit({ type: 'locked', ring: i }); return 'locked'; }
    const r = this.rings[i];
    r.gone = true;
    const a = this.charmAngle(i);
    const slot = Math.min(this.tray.length + this.inFlight, this.slots - 1);
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
      this.merges++;
      this.mergesBy[color]++;
      this.emit({ type: 'merge', color, slots });
    }
    this.checkEnd();
  }

  /**
   * Hint for the player: tap a free ring (preferring colors already in the tray),
   * otherwise one rotation (ring + target gap angle) that frees a ring.
   */
  suggest(): Suggestion | null {
    if (this.state !== 'play') return null;
    const trayCount = (c: Color): number => this.tray.filter(x => x === c).length;
    const score = (j: number): number => trayCount(this.rings[j].c) * 10 - (this.tray.length >= this.slots - 1 && trayCount(this.rings[j].c) < MERGE_COUNT - 1 ? 100 : 0);
    const free = this.rings.map((_, i) => i).filter(i => this.isFree(i));
    if (free.length) return { type: 'tap', ring: free.sort((a, b) => score(b) - score(a))[0] };
    if (this.moves <= 0) return null;
    let best: Suggestion | null = null, bestScore = -Infinity;
    this.rings.forEach((r, i) => {
      if (!this.rotatable(i)) return;
      const targets: number[] = [...r.pins];
      this.links.forEach(L => {
        if (L.a !== i && L.b !== i) return;
        const o = L.a === i ? L.b : L.a;
        if (!this.rings[o].gone) L.p.forEach(p => targets.push(angleOf(r, p)));
      });
      const g0 = r.g;
      for (const a of targets) {
        r.g = a;
        // best: a rotation that frees a ring; fallback: one that opens the most links/pins (progress)
        let sc = this.openCount() - 1000;
        this.rings.forEach((_, j) => { if (this.isFree(j)) sc = Math.max(sc, score(j)); });
        sc -= angDiff(a, g0);
        if (sc > bestScore) { bestScore = sc; best = { type: 'rotate', ring: i, target: a }; }
      }
      r.g = g0;
    });
    return best;
  }

  /** How many links between present rings and pins are currently open (used to rank hint rotations). */
  private openCount(): number {
    let n = 0;
    for (const L of this.links) if (!this.rings[L.a].gone && !this.rings[L.b].gone && this.linkOpen(L)) n++;
    this.rings.forEach((r, i) => { if (!r.gone) n += r.pins.filter(a => this.inGap(i, a)).length; });
    return n;
  }

  // ---------- boosters ----------
  /** Why the level was lost (null while playing / won). */
  loseReason: 'tray' | 'moves' | 'bomb' | null = null;

  canUndo(): boolean { return this.state === 'play' && this.history.some(h => !this.rings[h.ring].gone); }
  /** Undo booster: puts the last counted rotation back and refunds its move (and ice charge). */
  undo(): boolean {
    if (!this.canUndo()) return false;
    while (this.history.length && this.rings[this.history[this.history.length - 1].ring].gone) this.history.pop();
    const h = this.history.pop()!;
    const r = this.rings[h.ring];
    r.g = h.g; r.ice = h.ice;
    this.moves += h.cost ?? 1;
    this.spent -= h.cost ?? 1;
    this.emit({ type: 'undo', ring: h.ring });
    this.emit({ type: 'move', movesLeft: this.moves });
    return true;
  }

  canAddSlot(): boolean { return this.slots === TRAY_SLOTS && (this.state === 'play' || this.loseReason === 'tray'); }
  /** Extra slot booster: a 6th tray slot for this level. Also rescues a full tray. */
  addSlot(): boolean {
    if (!this.canAddSlot()) return false;
    this.slots++;
    this.emit({ type: 'slot', slots: this.slots });
    this.revive();
    return true;
  }

  canMagnet(): boolean { return this.tray.length > 0 && (this.state === 'play' || this.loseReason === 'tray'); }
  /** Magnet booster: pulls every charm of the most common tray color out of the tray. */
  magnet(): boolean {
    if (!this.canMagnet()) return false;
    const count = (c: Color): number => this.tray.filter(x => x === c).length;
    const color = [...this.tray].sort((a, b) => count(b) - count(a))[0];
    const slots = this.tray.map((c, k) => (c === color ? k : -1)).filter(k => k >= 0);
    this.tray = this.tray.filter(c => c !== color);
    this.emit({ type: 'magnet', color, slots });
    this.revive();
    return true;
  }

  /** Back to play after a tray rescue. */
  private revive(): void {
    if (this.state === 'lost' && this.loseReason === 'tray') { this.state = 'play'; this.loseReason = null; this.checkEnd(); }
  }

  addMoves(n: number): void {
    this.moves += n;
    if (this.state === 'lost' && this.loseReason === 'moves') { this.state = 'play'; this.loseReason = null; }
    this.emit({ type: 'move', movesLeft: this.moves });
  }

  checkEnd(): void {
    if (this.state !== 'play' || this.inFlight > 0) return;
    // all rings out = win (charms a Magnet pulled can leave a partial color behind, so the tray need not be empty)
    if (this.rings.every(r => r.gone)) { this.tray = []; this.state = 'won'; this.emit({ type: 'win' }); return; }
    if (this.tray.length >= this.slots) { this.state = 'lost'; this.loseReason = 'tray'; this.emit({ type: 'lose', reason: 'tray' }); return; }
    if (this.rings.some(r => !r.gone && r.bomb !== null && this.spent >= r.bomb)) {
      this.state = 'lost'; this.loseReason = 'bomb'; this.emit({ type: 'lose', reason: 'bomb' }); return;
    }
    // lost when nothing is free and nothing can change any more (out of moves, or every ring is fixed / out of ice)
    if (!this.anyFree() && !this.rings.some((_, i) => this.rotatable(i) && this.moves >= this.cost(i))) {
      this.state = 'lost'; this.loseReason = 'moves'; this.emit({ type: 'lose', reason: 'moves' });
    }
  }
}
