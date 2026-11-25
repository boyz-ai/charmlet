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

/** Darken (amt < 0) or lighten a #rrggbb color. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16), f = (v: number): number => Math.round(Math.min(255, Math.max(0, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

interface Flyer { c: Color; x: number; y: number; tx: number; ty: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; l: number; c: string; on: boolean; size: number; grav: number; rect: boolean; rot: number }

/** Canvas drawing + purely visual animations (flyers, particles, shakes). */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  /** Bracelet Workshop look (cosmetic only) */
  look = { ring: 'ring.classic', charm: 'charm.classic' };
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
      this.badge(game, r, dx(i), i, time);
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
    // rim: mechanics first (fixed = silver, heavy = iron), otherwise the workshop finish
    const skin = this.look.ring;
    const rim = r.fixed ? '#cfd3da' : r.heavy ? '#4a3b44'
      : skin === 'ring.gold' ? '#d9b45a' : skin === 'ring.rose' ? '#e6a48c' : skin === 'ring.onyx' ? '#0e060b' : 'rgba(20,4,16,.55)';
    if (skin === 'ring.crystal' && !r.fixed && !r.heavy) {
      this.ctx.save(); this.ctx.shadowColor = COL[r.c].l; this.ctx.shadowBlur = 10;
      this.arc(r, a0, a1, 15, 'rgba(255,255,255,.35)'); this.ctx.restore();
    } else this.arc(r, a0, a1, r.heavy ? 20 : 15, rim);
    this.arc(r, a0, a1, 11, COL[r.c].c);
    this.arc(r, a0, a1, 2.5, COL[r.c].l, r.r - 2.5);
    if (!r.fixed && !r.heavy) {
      if (skin === 'ring.gold') this.arc(r, a0, a1, 1.5, '#fff2c2', r.r + 6);
      else if (skin === 'ring.rose') this.arc(r, a0, a1, 1.5, '#ffd9cb', r.r + 6);
      else if (skin === 'ring.onyx') this.arc(r, a0, a1, 1.2, '#e3c473', r.r + 6.5);
      else if (skin === 'ring.crystal') this.arc(r, a0, a1, 2, 'rgba(255,255,255,.7)', r.r + 2.5);
    }
    if (r.ice !== null) {
      const frost = r.ice > 0 ? 'rgba(200,240,255,.9)' : '#eef6fb';
      this.arc(r, a0, a1, 3, frost, r.r + 6);
      this.arc(r, a0, a1, 3, frost, r.r - 6);
    }
  }
  /** Draw a workshop preview (ring finish or charm set) into a small canvas. */
  preview(cv: HTMLCanvasElement, kind: 'ring' | 'charm', id: string): void {
    const ctx = cv.getContext('2d')!, saved = this.ctx, savedLook = { ...this.look };
    const d = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 96, h = cv.clientHeight || 56;
    cv.width = w * d; cv.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    this.ctx = ctx;
    if (kind === 'ring') {
      this.look.ring = id;
      const ring = { x: w / 2, y: h * 0.58, r: h * 0.36, c: 'r', g: -Math.PI / 2, gone: false, pins: [], fixed: false, twin: false, lock: false, ice: null, heavy: false, bomb: null, clock: null } as Ring;
      ctx.save(); ctx.translate(w / 2, h * 0.55); ctx.scale(0.8, 0.8); ctx.translate(-w / 2, -h * 0.55);
      ring.y = h * 0.55; ring.r = h * 0.42; this.ringBody(ring, 0, Math.PI * 2); ctx.restore();
    } else {
      this.look.charm = id;
      (['r', 'b', 'g'] as Color[]).forEach((c, q) => this.bead(w / 2 + (q - 1) * (h * 0.52), h / 2, c, h * 0.2));
    }
    this.ctx = saved; this.look = savedLook;
  }
  /** Mechanic badges stacked in the middle of a ring: bolt, padlocks, ice counter, bomb, weight. */
  private badge(game: Game, r: Ring, dx: number, i: number, time: number): void {
    const ctx = this.ctx;
    const draws: ((x: number, y: number) => void)[] = [];
    const lock = (col: string) => (x: number, y: number): void => {
      ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -5, 6, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-9, -5, 18, 14, 3); ctx.fill();
      ctx.fillStyle = '#2a0d22'; ctx.beginPath(); ctx.arc(0, 1, 2.5, 0, 7); ctx.fill(); ctx.restore();
    };
    const counter = (n: number, bg: string, fg: string) => (x: number, y: number): void => {
      ctx.save(); ctx.font = '600 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
      ctx.fillStyle = fg; ctx.fillText(String(n), x, y + 1); ctx.restore();
    };
    if (r.fixed) draws.push((x, y) => {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#cfd3da'; ctx.strokeStyle = '#2a0d22'; ctx.lineWidth = 2;
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fillStyle = '#6b6f78'; ctx.fill(); ctx.restore();
    });
    if (r.lock && game.merges < 1) draws.push(lock('#e3c473'));
    if (r.clock && game.mergesBy[r.clock] < 1) draws.push(lock(COL[r.clock].c));
    if (r.ice !== null) draws.push(counter(r.ice, 'rgba(190,235,255,.9)', '#123a52'));
    const left = game.bombLeft(i);
    if (left !== null) draws.push((x, y) => {
      const hot = left <= 2, pulse = hot && !this.reduceMotion ? 1 + 0.12 * Math.sin(time * 10) : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#8a6a24'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(6, -8); ctx.quadraticCurveTo(10, -16, 15, -14); ctx.stroke();
      ctx.fillStyle = hot ? '#ffb347' : '#ffe08a'; ctx.beginPath(); ctx.arc(15, -14, 2.8 + (this.reduceMotion ? 0 : Math.sin(time * 18)), 0, 7); ctx.fill();
      ctx.fillStyle = hot ? '#c81e3a' : '#1d1219'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.font = '600 15px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(String(left), 0, 1); ctx.restore();
    });
    if (r.heavy) draws.push((x, y) => {
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#5b4a54'; ctx.strokeStyle = '#2a0d22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(7, -9); ctx.lineTo(11, 9); ctx.lineTo(-11, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = '600 12px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f3e6ee'; ctx.fillText('×2', 0, 1.5); ctx.restore();
    });
    const step = 24, top = r.y - ((draws.length - 1) * step) / 2;
    draws.forEach((d, k) => d(r.x + dx, top + k * step));
  }
  private bead(x: number, y: number, c: Color, rad: number): void {
    const ctx = this.ctx, k = COL[c], s = rad * 0.45;
    ctx.save(); ctx.translate(x, y);
    // soft drop shadow
    ctx.beginPath(); ctx.ellipse(0, rad * 0.9, rad * 0.8, rad * 0.25, 0, 0, 7); ctx.fillStyle = 'rgba(10,0,8,.35)'; ctx.fill();
    // gold rim
    const rim = ctx.createLinearGradient(-rad, -rad, rad, rad);
    rim.addColorStop(0, '#fff2c2'); rim.addColorStop(0.5, '#e3c473'); rim.addColorStop(1, '#8a6a24');
    ctx.beginPath(); ctx.arc(0, 0, rad + 2, 0, 7); ctx.fillStyle = rim; ctx.fill();
    // gem body: light top-left, deep bottom-right
    const body = ctx.createRadialGradient(-rad * 0.35, -rad * 0.4, rad * 0.1, 0, 0, rad);
    body.addColorStop(0, k.l); body.addColorStop(0.45, k.c); body.addColorStop(1, shade(k.c, -0.35));
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, 7); ctx.fillStyle = body; ctx.fill();
    // facet ring
    ctx.beginPath(); ctx.arc(0, 0, rad * 0.72, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2; ctx.stroke();
    // symbol with a little depth
    const set = this.look.charm;
    const symbol = (): void => {
      ctx.beginPath();
      if (set === 'charm.sky') {
        if (c === 'r') { // sun
          ctx.arc(0, 0, s * 0.5, 0, 7);
          for (let q = 0; q < 8; q++) { const a = (q * Math.PI) / 4; ctx.moveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7); ctx.arc(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85, s * 0.15, 0, 7); }
        } else if (c === 'b') { // crescent moon
          ctx.arc(0, 0, s * 0.9, Math.PI * 0.3, Math.PI * 1.7); ctx.arc(s * 0.35, 0, s * 0.7, Math.PI * 1.55, Math.PI * 0.45, true); ctx.closePath();
        } else { // star
          for (let q = 0; q < 10; q++) { const a = -Math.PI / 2 + (q * Math.PI) / 5, rr = q % 2 ? s * 0.42 : s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
        }
        return;
      }
      if (set === 'charm.garden') {
        if (c === 'r') { // flower
          for (let q = 0; q < 5; q++) { const a = -Math.PI / 2 + (q * 2 * Math.PI) / 5; ctx.moveTo(Math.cos(a) * s * 0.55 + s * 0.38, Math.sin(a) * s * 0.55); ctx.arc(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55, s * 0.38, 0, 7); }
        } else if (c === 'b') { // drop
          ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.1, s * 0.75, s * 0.9, 0, s * 0.9); ctx.bezierCurveTo(-s * 0.75, s * 0.9, -s * 0.9, -s * 0.1, 0, -s); ctx.closePath();
        } else { // clover
          for (const [dx, dy] of [[0, -0.45], [-0.45, 0.15], [0.45, 0.15]]) { ctx.moveTo(dx * s + s * 0.42, dy * s); ctx.arc(dx * s, dy * s, s * 0.42, 0, 7); }
          ctx.moveTo(-s * 0.08, s * 0.2); ctx.lineTo(s * 0.08, s * 0.2); ctx.lineTo(s * 0.12, s * 1.0); ctx.lineTo(-s * 0.04, s * 1.0); ctx.closePath();
        }
        return;
      }
      if (k.s === 'heart') {
        ctx.moveTo(0, s * 0.9); ctx.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.6, -s * 1.3, 0, -s * 0.4);
        ctx.bezierCurveTo(s * 0.6, -s * 1.3, s * 1.6, -s * 0.2, 0, s * 0.9);
      } else if (k.s === 'diamond') {
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, 0); ctx.closePath();
      } else { ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.8); ctx.lineTo(-s, s * 0.8); ctx.closePath(); }
    };
    ctx.save(); ctx.translate(0, 1.2); symbol(); ctx.fillStyle = shade(k.c, -0.45); ctx.fill(); ctx.restore();
    symbol(); ctx.fillStyle = '#fff'; ctx.fill();
    // glints
    ctx.beginPath(); ctx.ellipse(-rad * 0.38, -rad * 0.42, rad * 0.26, rad * 0.16, -0.6, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(rad * 0.42, rad * 0.38, rad * 0.08, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
    ctx.restore();
  }

}
