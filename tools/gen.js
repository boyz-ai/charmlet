// Charm Çözücü seviye üreteci + çözücü (0-1 BFS, hamle = bir halkayı çevirmek)
const GAP = 28 * Math.PI / 180, SLOTS = 5;
const ad = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function inter(a, b) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return null;
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(a.r * a.r - l * l), mx = a.x + dx * l / d, my = a.y + dy * l / d;
  return [{ x: mx + h * dy / d, y: my - h * dx / d }, { x: mx - h * dy / d, y: my + h * dx / d }]; }
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const LAYOUTS = {
  row3: { r: 60, pts: [[110, 210], [180, 210], [250, 210]] },
  g23: { r: 58, pts: [[95, 170], [180, 170], [265, 170], [95, 270], [180, 270], [265, 270]] },
  zig6: { r: 56, pts: [[80, 150], [150, 200], [220, 150], [290, 200], [150, 290], [220, 290]] },
  g33: { r: 54, pts: [[100, 120], [180, 120], [260, 120], [100, 210], [180, 210], [260, 210], [100, 300], [180, 300], [260, 300]] },
  ring9: { r: 52, pts: [[180, 100], [255, 135], [285, 210], [255, 285], [180, 320], [105, 285], [75, 210], [105, 135], [180, 210]] },
};

function build(layout, colors, gaps, pins) {
  const L = LAYOUTS[layout];
  const rings = L.pts.map(([x, y], i) => ({ x, y, r: L.r, c: colors[i], g: gaps[i] * Math.PI / 180 }));
  const links = [];
  for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) { const p = inter(rings[i], rings[j]); if (p) links.push({ a: i, b: j, p }); }
  const pinPts = pins.map(([i, deg]) => ({ i, a: deg * Math.PI / 180 }));
  return { rings, links, pinPts };
}

function solve(lv, limit = 400000) {
  const { rings, links, pinPts } = lv, n = rings.length;
  const keys = rings.map(() => []); // {a, owner:'L'|'P', ref}
  const linkKeys = links.map(() => [[], []]); // [ringA key idx list, ringB key idx list]
  links.forEach((L, li) => L.p.forEach(p => {
    linkKeys[li][0].push(keys[L.a].push(Math.atan2(p.y - rings[L.a].y, p.x - rings[L.a].x)) - 1);
    linkKeys[li][1].push(keys[L.b].push(Math.atan2(p.y - rings[L.b].y, p.x - rings[L.b].x)) - 1); }));
  const pinKeys = pinPts.map(p => ({ i: p.i, k: keys[p.i].push(p.a) - 1 }));
  const sigAt = (i, a) => keys[i].reduce((m, ka, k) => ad(ka, a) < GAP ? m | (1 << k) : m, 0);
  const init = rings.map((r, i) => sigAt(i, r.g));
  const opts = keys.map((ks, i) => [...new Set(ks.map(a => sigAt(i, a)))]);
  // ilgili anahtar maskesi (gone kümesine göre)
  function relMask(i, mask) { let m = 0;
    links.forEach((L, li) => { if (L.a === i && !(mask >> L.b & 1)) linkKeys[li][0].forEach(k => m |= 1 << k);
      if (L.b === i && !(mask >> L.a & 1)) linkKeys[li][1].forEach(k => m |= 1 << k); });
    pinKeys.forEach(p => { if (p.i === i) m |= 1 << p.k; }); return m; }
  const colIdx = { r: 0, b: 1, g: 2 };
  function free(gs, mask, i) {
    for (const p of pinKeys) if (p.i === i && !(gs[i] >> p.k & 1)) return false;
    for (let li = 0; li < links.length; li++) { const L = links[li]; if (L.a !== i && L.b !== i) continue;
      const o = L.a === i ? L.b : L.a; if (mask >> o & 1) continue;
      if (!(linkKeys[li][0].some(k => gs[L.a] >> k & 1) || linkKeys[li][1].some(k => gs[L.b] >> k & 1))) return false; }
    return true; }
  const key = (gs, mask, tray) => { let s = mask + '|' + tray.join('');
    for (let i = 0; i < n; i++) s += ',' + ((mask >> i & 1) ? 'x' : (gs[i] & relMask(i, mask))); return s; };
  const dist = new Map(); let dq = [{ gs: init, mask: 0, tray: [0, 0, 0] }], dq2 = [];
  dist.set(key(init, 0, [0, 0, 0]), 0); let d = 0, seen = 0;
  while (dq.length) {
    while (dq.length) { const s = dq.pop(); const k = key(s.gs, s.mask, s.tray); if (dist.get(k) < d) continue; seen++;
      if (dist.size > limit) return null;
      if (s.mask === (1 << n) - 1 && s.tray.every(x => x === 0)) return { moves: d, states: seen };
      for (let i = 0; i < n; i++) { if (s.mask >> i & 1) continue; if (!free(s.gs, s.mask, i)) continue;
        const tray = s.tray.slice(); const c = colIdx[rings[i].c]; tray[c]++; if (tray[c] >= 3) tray[c] -= 3;
        if (tray[0] + tray[1] + tray[2] >= SLOTS) continue;
        const nm = s.mask | 1 << i, nk = key(s.gs, nm, tray);
        if (!dist.has(nk) || dist.get(nk) > d) { dist.set(nk, d); dq.push({ gs: s.gs, mask: nm, tray }); } }
      for (let i = 0; i < n; i++) { if (s.mask >> i & 1) continue; const rm = relMask(i, s.mask);
        for (const sg of opts[i]) { if ((sg & rm) === (s.gs[i] & rm)) continue;
          const gs = s.gs.slice(); gs[i] = sg; const nk = key(gs, s.mask, s.tray);
          if (!dist.has(nk) || dist.get(nk) > d + 1) { dist.set(nk, d + 1); dq2.push({ gs, mask: s.mask, tray: s.tray }); } } } }
    dq = dq2; dq2 = []; d++; }
  return { moves: Infinity, states: seen };
}

function initialFree(lv) { const r = solve(lv, 1); return r; }

function randomLevel(layout, ncol, npins) {
  const n = LAYOUTS[layout].pts.length, per = n / ncol;
  const colors = shuffle([].concat(...['r', 'b', 'g'].slice(0, ncol).map(c => Array(per).fill(c))));
  const gaps = colors.map(() => Math.round(rnd() * 23) * 15);
  const ringIdx = shuffle([...Array(n).keys()]).slice(0, npins);
  const pins = ringIdx.map(i => [i, Math.round(rnd() * 23) * 15]);
  return { layout, colors, gaps, pins };
}

// plan: [katman, renk sayısı, pim, hedef min hamle aralığı, rol]
const PLAN = [
  ['row3', 1, 0, [2, 2], 'Öğretici', 4],
  ['g23', 2, 0, [3, 4], 'Öğretici: tepsi', 4],
  ['g23', 2, 1, [3, 5], 'Yeni: pim', 3],
  ['zig6', 2, 1, [4, 6], 'Normal', 2],
  ['g33', 3, 1, [4, 6], 'Zor', 1],
  ['zig6', 2, 0, [2, 4], 'Dinlenme', 4],
  ['ring9', 3, 2, [4, 6], 'Normal+', 2],
  ['g33', 3, 3, [5, 7], 'Süper zor', 0],
];
const out = [];
for (const [layout, ncol, npins, [lo, hi], role, slack] of PLAN) {
  let found = null;
  for (let t = 0; t < 80 && !found; t++) {
    const spec = randomLevel(layout, ncol, npins); const lv = build(spec.layout, spec.colors, spec.gaps, spec.pins);
    // pimler kesişim noktalarına çok yakın olmasın
    const r = solve(lv); if (t % 20 === 0) console.error('  deneme', role, t, r && r.moves);
    if (!r || r.moves < lo || r.moves > hi) continue;
    // başlangıçta en fazla 1 serbest halka
    const start = Array(lv.rings.length).fill(-1);
    found = { ...spec, role, minMoves: r.moves, moves: r.moves + slack, states: r.states };
  }
  if (!found) { console.error('bulunamadı', layout, role); process.exit(1); }
  console.error(role, layout, 'min', found.minMoves, 'durum', found.states);
  out.push(found);
}
require('fs').writeFileSync(__dirname + '/../levels/levels.json', JSON.stringify(out));
