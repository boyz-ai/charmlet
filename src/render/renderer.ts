import type { Game, Ring, Suggestion } from '../core/game';
import { TRAY_SLOTS } from '../core/game';
import { angleOf } from '../core/geometry';
import type { Color } from '../levels/levels';

export const BOARD_W = 360, BOARD_H = 500, SLOT_Y = 462;
/** x of tray slot i when the tray has n slots (5 → 60…300; 6 with the Extra slot booster). */
export const slotX = (i: number, n = TRAY_SLOTS): number => 180 + (i - (n - 1) / 2) * (n > TRAY_SLOTS ? 54 : 60);

const COL: Record<Color, { c: string; l: string; s: 'heart' | 'diamond' | 'tri' }> = {
  r: { c: '#ec4a62', l: '#ffb0bb', s: 'heart' },
  b: { c: '#3f82e6', l: '#a8cbff', s: 'diamond' },
  g: { c: '#25b47c', l: '#9af2cd', s: 'tri' },
};

interface Flyer { c: Color; x: number; y: number; tx: number; ty: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; l: number; c: string; on: boolean; size: number; grav: number; rect: boolean; rot: number }

/** Canvas drawing + purely visual animations (flyers, particles, shakes). */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dpr = 1;
  private flyers: Flyer[] = [];
  private parts: Particle[] = Array.from({ length: 300 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, l: 0, c: '', on: false, size: 3, grav: 300, rect: false, rot: 0 }));
  private kickT = 0;
  /** current tray size (follows game.slots) */
  private trayN = TRAY_SLOTS;
  private kickDir = { x: 0, y: 0 };
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Hint drawn as a ghost hand; null = hidden. */
  hint: Suggestion | null = null;
  private hintT = 0;
  private shakes = new Map<number, number>();
  private readonly ro: ResizeObserver;
  onLand: (c: Color) => void = () => {};

  constructor(private cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(cv);
    this.resize();
  }

  private resize(): void {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(((r.width * BOARD_H) / BOARD_W) * this.dpr);
    this.scale = r.width / BOARD_W;
  }

  /** Convert a pointer event to board coordinates. */
  toBoard(e: PointerEvent): { x: number; y: number } {
    const r = this.cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * BOARD_W, y: ((e.clientY - r.top) / r.width) * BOARD_W };
  }

  reset(): void { this.flyers = []; this.parts.forEach(p => (p.on = false)); this.shakes.clear(); this.hint = null; this.kickT = 0; }
  shake(ring: number): void { this.shakes.set(ring, 1); }
  fly(c: Color, from: { x: number; y: number }, slot: number): void {
    this.flyers.push({ c, x: from.x, y: from.y, tx: slotX(slot, this.trayN), ty: SLOT_Y, t: 0 });
  }
  private emit(n: number, init: (p: Particle, k: number) => void): void {
    let k = 0;
    for (const p of this.parts) { if (k >= n) break; if (p.on) continue; p.on = true; p.l = 1; p.size = 3; p.grav = 300; p.rect = false; p.rot = 0; init(p, k++); }
  }
  /** Merge pop in the tray + a small kick of the whole board. */
  burst(slots: number[], c: Color): void {
    this.emit(slots.length * 14, (p, k) => Object.assign(p, { x: slotX(slots[k % slots.length], this.trayN), y: SLOT_Y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, c: COL[c].l }));
    this.kick(0, 3);
  }
  /** Magnet booster: charms fly up out of the tray. */
  pull(slots: number[], c: Color): void {
    this.emit(slots.length * 12, (p, k) => Object.assign(p, { x: slotX(slots[k % slots.length], this.trayN), y: SLOT_Y, vx: (Math.random() - 0.5) * 60, vy: -260 - Math.random() * 160, c: COL[c].l, grav: 0 }));
  }
  /** Small gold sparkle where a charm leaves its ring. */
  sparkle(at: { x: number; y: number }): void {
    this.emit(8, p => Object.assign(p, { x: at.x, y: at.y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, c: '#ffe08a', grav: 0, size: 2 }));
  }
  /** Confetti only for a level win. */
  confetti(): void {
    const cols = ['#ec4a62', '#3f82e6', '#25b47c', '#e3c473', '#ffffff'];
    this.emit(this.reduceMotion ? 30 : 120, (p, k) => Object.assign(p, { x: Math.random() * BOARD_W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, c: cols[k % cols.length], grav: 40, size: 4, rect: true, rot: Math.random() * 6, l: 2.2 }));
  }
  kick(x: number, y: number): void { if (this.reduceMotion) return; this.kickT = 0.12; this.kickDir = { x, y }; }

  update(dt: number): void {
    this.shakes.forEach((v, k) => (v - dt * 2.5 <= 0 ? this.shakes.delete(k) : this.shakes.set(k, v - dt * 2.5)));
    for (const f of this.flyers) f.t += dt / 0.45;
    const landed = this.flyers.filter(f => f.t >= 1);
    this.flyers = this.flyers.filter(f => f.t < 1);
    for (const p of this.parts) if (p.on) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.rot += dt * 6; p.l -= dt * 1.4; if (p.l <= 0) p.on = false; }
    this.kickT = Math.max(0, this.kickT - dt);
    this.hintT = this.hint ? this.hintT + dt : 0;
    landed.forEach(f => this.onLand(f.c));
  }

  draw(game: Game, time: number, glowFree: boolean): void {
    const ctx = this.ctx;
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    if (this.kickT > 0) { const f = this.kickT / 0.12; ctx.translate(this.kickDir.x * f, this.kickDir.y * f); }

    // tray
    ctx.fillStyle = 'rgba(15,3,12,.45)';
    ctx.beginPath(); ctx.roundRect(18, 428, 324, 68, 22); ctx.fill();
    this.trayN = game.slots;
    for (let i = 0; i < game.slots; i++) {
      ctx.beginPath(); ctx.arc(slotX(i, game.slots), SLOT_Y, 19, 0, 7);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(227,196,115,.5)'; ctx.stroke();
    }
    game.tray.forEach((c, i) => this.bead(slotX(i, game.slots), SLOT_Y, c, 16));

    const dx = (i: number): number => { const s = this.shakes.get(i) ?? 0; return s > 0 ? Math.sin(s * 60) * 4 * s : 0; };

    // ring bodies
    game.rings.forEach((r, i) => {
      if (r.gone) return;
      ctx.save(); ctx.translate(dx(i), 0);
      if (glowFree && game.isFree(i)) { ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 12 + 8 * Math.sin(time * 5); }
      this.ringBody(r, 0, Math.PI * 2);
      ctx.restore();
    });
    // weave: at each crossing one ring passes over the other
    game.links.forEach(L => {
      const A = game.rings[L.a], B = game.rings[L.b];
      if (A.gone || B.gone) return;
      ([[A, L.a, L.p[0]], [B, L.b, L.p[1]]] as const).forEach(([r, idx, p]) => {
        const a = angleOf(r, p);
        ctx.save(); ctx.translate(dx(idx), 0); this.ringBody(r, a - 0.28, a + 0.28); ctx.restore();
      });
    });
    // pins
    game.rings.forEach((r, i) => {
      if (r.gone) return;
      r.pins.forEach(a => {
        const x = r.x + dx(i) + Math.cos(a) * r.r, y = r.y + Math.sin(a) * r.r;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fillStyle = '#2a0d22'; ctx.fill();
        const gr = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 6);
        gr.addColorStop(0, '#fff2c2'); gr.addColorStop(1, '#b8892c');
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fillStyle = gr; ctx.fill();
      });
    });
    // charms
    game.rings.forEach((r, i) => {
      if (r.gone) return;
      this.badge(game, r, dx(i));
      const a = game.charmAngle(i);
      this.bead(r.x + dx(i) + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, r.c, 11);
    });
    // flying charms + particles
    for (const f of this.flyers) {
      const e = 1 - Math.pow(1 - Math.min(f.t, 1), 3);
      this.bead(f.x + (f.tx - f.x) * e, f.y + (f.ty - f.y) * e - Math.sin(e * Math.PI) * 40, f.c, 11 + 5 * e);
    }
    for (const p of this.parts) if (p.on) {
      ctx.globalAlpha = Math.min(1, Math.max(p.l, 0)); ctx.fillStyle = p.c;
      if (p.rect) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (this.hint) this.drawHint(game, this.hint);
  }

  /** Ghost hand: drags a ring's charm to the target angle, or taps a free ring. Loops. */
  private drawHint(game: Game, h: Suggestion): void {
    const r = game.rings[h.ring];
    if (!r || r.gone) return;
    const ctx = this.ctx, T = 1.8, t = (this.hintT % T) / T;
    const fade = Math.min(1, this.hintT * 3) * (t < 0.85 ? 1 : (1 - t) / 0.15);
    let x: number, y: number, press: boolean;
    if (h.type === 'rotate') {
      const d = Math.atan2(Math.sin(h.target - r.g), Math.cos(h.target - r.g));
      const start = game.charmAngle(h.ring), e = t < 0.15 ? 0 : t > 0.75 ? 1 : (t - 0.15) / 0.6;
      const ease = e * e * (3 - 2 * e), a = start + d * ease;
      // path guide
      ctx.save(); ctx.globalAlpha = 0.35 * fade; ctx.setLineDash([4, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 18, Math.min(start, start + d), Math.max(start, start + d)); ctx.stroke(); ctx.restore();
      x = r.x + Math.cos(a) * r.r; y = r.y + Math.sin(a) * r.r; press = t > 0.1 && t < 0.8;
    } else {
      const a = game.charmAngle(h.ring);
      x = r.x + Math.cos(a) * r.r; y = r.y + Math.sin(a) * r.r; press = t > 0.3 && t < 0.5;
      if (press) { ctx.save(); ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 18 + (t - 0.3) * 60, 0, 7); ctx.stroke(); ctx.restore(); }
    }
    // hand: fingertip circle + palm
    ctx.save(); ctx.globalAlpha = 0.9 * fade; ctx.translate(x + 6, y + 10 + (press ? 0 : 6));
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(3, 4, 13, 17, 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a0d22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-6, -14, 12, 26, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(4, 14, 12, 14, 0.2, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  private arc(r: Ring, a0: number, a1: number, w: number, color: string, rad = r.r): void {
    const ctx = this.ctx, GAPH = (28 * Math.PI) / 180;
    ctx.beginPath();
    let pen = false;
    for (let a = a0; a <= a1 + 1e-6; a += 0.03) {
      const inGap = Math.abs(Math.atan2(Math.sin(a - r.g), Math.cos(a - r.g))) < GAPH || (r.twin && Math.abs(Math.atan2(Math.sin(a - r.g - Math.PI), Math.cos(a - r.g - Math.PI))) < GAPH);
      const x = r.x + Math.cos(a) * rad, y = r.y + Math.sin(a) * rad;
      if (!inGap) { if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; } else pen = false;
    }
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
  }
  private ringBody(r: Ring, a0: number, a1: number): void {
    this.arc(r, a0, a1, 15, r.fixed ? '#cfd3da' : 'rgba(20,4,16,.55)');
    this.arc(r, a0, a1, 11, COL[r.c].c);
    this.arc(r, a0, a1, 2.5, COL[r.c].l, r.r - 2.5);
    if (r.ice !== null) {
      const frost = r.ice > 0 ? 'rgba(200,240,255,.9)' : '#eef6fb';
      this.arc(r, a0, a1, 3, frost, r.r + 6);
      this.arc(r, a0, a1, 3, frost, r.r - 6);
    }
  }
  /** Mechanic badge in the middle of a ring: bolt (fixed), padlock (lock), ice counter. */
  private badge(game: Game, r: Ring, dx: number): void {
    const ctx = this.ctx, x = r.x + dx, y = r.y;
    if (r.fixed) {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#cfd3da'; ctx.strokeStyle = '#2a0d22'; ctx.lineWidth = 2;
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fillStyle = '#6b6f78'; ctx.fill(); ctx.restore();
    }
    if (r.lock && game.merges < 1) {
      ctx.save(); ctx.translate(x, y + (r.fixed ? 22 : 0)); ctx.strokeStyle = '#e3c473'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -5, 6, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#e3c473'; ctx.beginPath(); ctx.roundRect(-9, -5, 18, 14, 3); ctx.fill();
      ctx.fillStyle = '#2a0d22'; ctx.beginPath(); ctx.arc(0, 1, 2.5, 0, 7); ctx.fill(); ctx.restore();
    }
    if (r.ice !== null) {
      ctx.save(); ctx.font = '600 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(190,235,255,.9)'; ctx.beginPath(); ctx.arc(x, y - (r.lock ? 22 : 0), 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#123a52'; ctx.fillText(String(r.ice), x, y + 1 - (r.lock ? 22 : 0)); ctx.restore();
    }
  }
  private bead(x: number, y: number, c: Color, rad: number): void {
    const ctx = this.ctx, k = COL[c], s = rad * 0.45;
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.fillStyle = k.c; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#f6dd94'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    if (k.s === 'heart') {
      ctx.moveTo(0, s * 0.9); ctx.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.6, -s * 1.3, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.6, -s * 1.3, s * 1.6, -s * 0.2, 0, s * 0.9);
    } else if (k.s === 'diamond') {
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, 0); ctx.closePath();
    } else { ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.8); ctx.lineTo(-s, s * 0.8); ctx.closePath(); }
    ctx.fill();
    ctx.beginPath(); ctx.arc(-rad * 0.35, -rad * 0.4, rad * 0.22, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    ctx.restore();
  }
}
