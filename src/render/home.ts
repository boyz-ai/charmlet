// Animated home-screen scene: three interlocked rings turning slowly on velvet, charms swinging
// from them, gold dust drifting up. Pure decoration; it pauses when the home screen is hidden.
const COLS = [
  { c: '#ec4a62', l: '#ffb0bb', d: '#8f1d33' },
  { c: '#3f82e6', l: '#a8cbff', d: '#1d3f7a' },
  { c: '#25b47c', l: '#9af2cd', d: '#0f5a3c' },
];
const GAP = (28 * Math.PI) / 180;

export class HomeScene {
  private ctx: CanvasRenderingContext2D;
  private dust = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.5, v: 0.02 + Math.random() * 0.05, p: Math.random() * 6 }));
  private raf = 0;
  private t0 = performance.now();
  private readonly still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private cv: HTMLCanvasElement) { this.ctx = cv.getContext('2d')!; }

  start(): void { if (!this.raf) this.raf = requestAnimationFrame(this.frame); }
  stop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const cv = this.cv, d = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const ctx = this.ctx, t = this.still ? 0 : (now - this.t0) / 1000;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // spotlight on the velvet
    const sp = ctx.createRadialGradient(w / 2, h * 0.22, 10, w / 2, h * 0.22, h * 0.55);
    sp.addColorStop(0, 'rgba(255,214,150,.22)'); sp.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = sp; ctx.fillRect(0, 0, w, h);

    // gold dust
    for (const p of this.dust) {
      const y = ((p.y - t * p.v) % 1 + 1) % 1, a = 0.25 + 0.35 * Math.sin(t * 2 + p.p);
      ctx.fillStyle = `rgba(255,226,150,${a})`;
      ctx.beginPath(); ctx.arc(p.x * w, y * h, p.s, 0, 7); ctx.fill();
    }

    // three interlocked rings
    const R = Math.min(w * 0.16, w > 700 ? 96 : 78), cy = Math.max(h * (w > 700 ? 0.16 : 0.2), 120), gapx = R * 1.22;
    const rings = [0, 1, 2].map(k => ({ x: w / 2 + (k - 1) * gapx, y: cy + (k === 1 ? -R * 0.1 : R * 0.08), g: t * (k === 1 ? -0.5 : 0.4) + k * 2.1, col: COLS[k] }));
    // back halves first, then front halves → woven look
    for (const pass of [0, 1]) rings.forEach((r, k) => this.ring(r.x, r.y, R, r.g, r.col, pass, k));
    // charms swinging under each ring
    rings.forEach((r, k) => {
      const sw = Math.sin(t * 1.6 + k) * 0.18, ax = r.x, ay = r.y + R;
      const bx = ax + Math.sin(sw) * 18, by = ay + Math.cos(sw) * 18;
      ctx.strokeStyle = '#e3c473'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      this.gem(bx, by + 9, 10, r.col, k);
    });
  };

  private ring(x: number, y: number, R: number, g: number, col: { c: string; l: string; d: string }, pass: number, k: number): void {
    const ctx = this.ctx;
    // front pass draws the lower half, back pass the upper half (alternating by ring for the weave)
    const from = pass === (k % 2) ? Math.PI : 0, to = from + Math.PI;
    const seg = (a0: number, a1: number, wdt: number, style: string | CanvasGradient, rad = R): void => {
      ctx.beginPath(); let pen = false;
      for (let a = a0; a <= a1 + 1e-6; a += 0.03) {
        const inGap = Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < GAP;
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (!inGap) { if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py); pen = true; } else pen = false;
      }
      ctx.lineWidth = wdt; ctx.strokeStyle = style; ctx.lineCap = 'round'; ctx.stroke();
    };
    const gold = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
    gold.addColorStop(0, '#fff2c2'); gold.addColorStop(0.5, '#d9b45a'); gold.addColorStop(1, '#8a6a24');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    seg(from, to, 17, gold); ctx.restore();
    seg(from, to, 12, col.c);
    seg(from, to, 3, col.l, R - 3);
  }

  private gem(x: number, y: number, r: number, col: { c: string; l: string; d: string }, k: number): void {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fillStyle = '#e3c473'; ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, col.l); g.addColorStop(0.5, col.c); g.addColorStop(1, col.d);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    const s = r * 0.45;
    if (k === 0) { ctx.moveTo(x, y + s * 0.9); ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); }
    else if (k === 1) { ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.8, y); ctx.closePath(); }
    else { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath(); }
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.16, -0.6, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
  }
}
