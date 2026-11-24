import type { Game, Ring } from '../core/game';
import { TRAY_SLOTS } from '../core/game';
import { angleOf } from '../core/geometry';
import type { Color } from '../levels/levels';

export const BOARD_W = 360, BOARD_H = 500, SLOT_Y = 462;
export const slotX = (i: number): number => 60 + i * 60;

const COL: Record<Color, { c: string; l: string; s: 'heart' | 'diamond' | 'tri' }> = {
  r: { c: '#ec4a62', l: '#ffb0bb', s: 'heart' },
  b: { c: '#3f82e6', l: '#a8cbff', s: 'diamond' },
  g: { c: '#25b47c', l: '#9af2cd', s: 'tri' },
};

interface Flyer { c: Color; x: number; y: number; tx: number; ty: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; l: number; c: string; on: boolean }

/** Canvas drawing + purely visual animations (flyers, particles, shakes). */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dpr = 1;
  private flyers: Flyer[] = [];
  private parts: Particle[] = Array.from({ length: 160 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, l: 0, c: '', on: false }));
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

  reset(): void { this.flyers = []; this.parts.forEach(p => (p.on = false)); this.shakes.clear(); }
  shake(ring: number): void { this.shakes.set(ring, 1); }
  fly(c: Color, from: { x: number; y: number }, slot: number): void {
    this.flyers.push({ c, x: from.x, y: from.y, tx: slotX(slot), ty: SLOT_Y, t: 0 });
  }
  burst(slots: number[], c: Color): void {
    let need = slots.length * 14;
    for (const p of this.parts) {
      if (need <= 0) break;
      if (p.on) continue;
      const s = slots[need % slots.length];
      Object.assign(p, { x: slotX(s), y: SLOT_Y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, l: 1, c: COL[c].l, on: true });
      need--;
    }
  }

  update(dt: number): void {
    this.shakes.forEach((v, k) => (v - dt * 2.5 <= 0 ? this.shakes.delete(k) : this.shakes.set(k, v - dt * 2.5)));
    for (const f of this.flyers) f.t += dt / 0.45;
    const landed = this.flyers.filter(f => f.t >= 1);
    this.flyers = this.flyers.filter(f => f.t < 1);
    for (const p of this.parts) if (p.on) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.l -= dt * 1.4; if (p.l <= 0) p.on = false; }
    landed.forEach(f => this.onLand(f.c));
  }

  draw(game: Game, time: number, glowFree: boolean): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);

    // tray
    ctx.fillStyle = 'rgba(15,3,12,.45)';
    ctx.beginPath(); ctx.roundRect(18, 428, 324, 68, 22); ctx.fill();
    for (let i = 0; i < TRAY_SLOTS; i++) {
      ctx.beginPath(); ctx.arc(slotX(i), SLOT_Y, 19, 0, 7);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(227,196,115,.5)'; ctx.stroke();
    }
    game.tray.forEach((c, i) => this.bead(slotX(i), SLOT_Y, c, 16));

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
      const a = r.g + Math.PI;
      this.bead(r.x + dx(i) + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, r.c, 11);
    });
    // flying charms + particles
    for (const f of this.flyers) {
      const e = 1 - Math.pow(1 - Math.min(f.t, 1), 3);
      this.bead(f.x + (f.tx - f.x) * e, f.y + (f.ty - f.y) * e - Math.sin(e * Math.PI) * 40, f.c, 11 + 5 * e);
    }
    for (const p of this.parts) if (p.on) {
      ctx.globalAlpha = Math.max(p.l, 0); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private arc(r: Ring, a0: number, a1: number, w: number, color: string, rad = r.r): void {
    const ctx = this.ctx, GAPH = (28 * Math.PI) / 180;
    ctx.beginPath();
    let pen = false;
    for (let a = a0; a <= a1 + 1e-6; a += 0.03) {
      const inGap = Math.abs(Math.atan2(Math.sin(a - r.g), Math.cos(a - r.g))) < GAPH;
      const x = r.x + Math.cos(a) * rad, y = r.y + Math.sin(a) * rad;
      if (!inGap) { if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; } else pen = false;
    }
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
  }
  private ringBody(r: Ring, a0: number, a1: number): void {
    this.arc(r, a0, a1, 15, 'rgba(20,4,16,.55)');
    this.arc(r, a0, a1, 11, COL[r.c].c);
    this.arc(r, a0, a1, 2.5, COL[r.c].l, r.r - 2.5);
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
