// Charmlet — level generator + solver (v2: 100 levels, 5 mechanics).
// Rules MUST match src/core/game.ts. Run: node tools/gen.cjs [from] [to] (1 100 → levels/levels.json), then node tools/solve-all.cjs
// A "move" = rotating one ring. Releasing a free ring is free. Solver = 0-1 BFS on
// (gone mask, tray counts, per-ring gap coverage signature, ice rotations used).
const GAP = 28 * Math.PI / 180, SLOTS = 5, MERGE = 3;
const ad = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function inter(a, b) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d >= a.r + b.r || d <= Math.abs(a.r - b.r)) return null;
  const l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(a.r * a.r - l * l), mx = a.x + dx * l / d, my = a.y + dy * l / d;
  return [{ x: mx + h * dy / d, y: my - h * dx / d }, { x: mx - h * dy / d, y: my + h * dx / d }]; }

let seed = 20261124;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const hex = [...Array(6)].map((_, k) => [Math.round(180 + 85 * Math.cos(k * Math.PI / 3 - Math.PI / 2)), Math.round(210 + 85 * Math.sin(k * Math.PI / 3 - Math.PI / 2))]);
const LAYOUTS = {
  row3: { r: 60, pts: [[110, 210], [180, 210], [250, 210]] },
  g23: { r: 58, pts: [[95, 170], [180, 170], [265, 170], [95, 270], [180, 270], [265, 270]] },
  zig6: { r: 56, pts: [[80, 150], [150, 200], [220, 150], [290, 200], [150, 290], [220, 290]] },
  zig6m: { r: 56, pts: [[280, 150], [210, 200], [140, 150], [70, 200], [210, 290], [140, 290]] },
  tri6: { r: 54, pts: [[180, 130], [140, 200], [220, 200], [100, 270], [180, 270], [260, 270]] },
  hex6: { r: 52, pts: hex },
  g33: { r: 54, pts: [[100, 120], [180, 120], [260, 120], [100, 210], [180, 210], [260, 210], [100, 300], [180, 300], [260, 300]] },
  ring9: { r: 52, pts: [[180, 100], [255, 135], [285, 210], [255, 285], [180, 320], [105, 285], [75, 210], [105, 135], [180, 210]] },
  zz9: { r: 46, pts: [[52, 170], [116, 170], [180, 170], [244, 170], [308, 170], [84, 240], [148, 240], [212, 240], [276, 240]] },
};
const L6 = ['g23', 'zig6', 'tri6', 'hex6'], L9 = ['g33', 'ring9', 'zz9'];

function build(spec) {
  const L = LAYOUTS[spec.layout];
  const rings = L.pts.map(([x, y], i) => ({ x, y, r: L.r, c: spec.colors[i], g: spec.gaps[i] * Math.PI / 180,
    fixed: spec.fixed.includes(i), twin: spec.twin.includes(i), lock: spec.lock.includes(i), ice: spec.ice.includes(i),
    heavy: (spec.heavy ?? []).includes(i),
    bomb: (spec.bomb ?? []).find(([k]) => k === i)?.[1] ?? 0,
    clock: (spec.clock ?? []).find(([k]) => k === i)?.[1] ?? null }));
  const links = [];
  for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) { const p = inter(rings[i], rings[j]); if (p) links.push({ a: i, b: j, p }); }
  return { rings, links, pins: spec.pins.map(([i, deg]) => ({ i, a: deg * Math.PI / 180 })) };
}

function solve(lv, limit, wantPath = false) {
  const { rings, links, pins } = lv, n = rings.length;
  const keys = rings.map(() => []);
  const linkKeys = links.map(() => [[], []]);
  links.forEach((L, li) => L.p.forEach(p => {
    linkKeys[li][0].push(keys[L.a].push(Math.atan2(p.y - rings[L.a].y, p.x - rings[L.a].x)) - 1);
    linkKeys[li][1].push(keys[L.b].push(Math.atan2(p.y - rings[L.b].y, p.x - rings[L.b].x)) - 1); }));
  const pinKeys = pins.map(p => ({ i: p.i, k: keys[p.i].push(p.a) - 1 }));
  const covers = (i, g, a) => ad(a, g) < GAP || (rings[i].twin && ad(a, g + Math.PI) < GAP);
  const sigAt = (i, g) => keys[i].reduce((m, ka, k) => covers(i, g, ka) ? m | (1 << k) : m, 0);
  const init = rings.map((r, i) => sigAt(i, r.g));
  // rotation options: point the gap at each key (twin rings: either gap). opts[i] = [{sig, angle}]
  const opts = keys.map((ks, i) => { if (rings[i].fixed) return []; const m = new Map();
    for (const a of ks) for (const g of rings[i].twin ? [a, a + Math.PI] : [a]) { const sg = sigAt(i, g); if (!m.has(sg)) m.set(sg, g); }
    return [...m].map(([sig, angle]) => ({ sig, angle })); });
  const iceIdx = rings.map((r, i) => (r.ice ? i : -1)).filter(i => i >= 0);
  const colIdx = { r: 0, b: 1, g: 2 };
  const relCache = new Map();
  function relMask(i, mask) { const ck = mask * 16 + i; const hit = relCache.get(ck); if (hit !== undefined) return hit; let m = 0;
    links.forEach((L, li) => { if (L.a === i && !(mask >> L.b & 1)) linkKeys[li][0].forEach(k => m |= 1 << k);
      if (L.b === i && !(mask >> L.a & 1)) linkKeys[li][1].forEach(k => m |= 1 << k); });
    pinKeys.forEach(p => { if (p.i === i) m |= 1 << p.k; }); relCache.set(ck, m); return m; }
  const merges = (mask, tray) => { let rel = 0; for (let i = 0; i < n; i++) if (mask >> i & 1) rel++; return (rel - tray[0] - tray[1] - tray[2]) / MERGE; };
  // merges of one color = (charms of that color released − charms of it still in the tray) / 3
  const mergesOf = (mask, tray, c) => { let rel = 0; for (let i = 0; i < n; i++) if (mask >> i & 1 && rings[i].c === c) rel++; return (rel - tray[colIdx[c]]) / MERGE; };
  const bombs = rings.map((r, i) => (r.bomb ? i : -1)).filter(i => i >= 0);
  // a rotation that spends moves up to a bomb's countdown while that bomb is still on the board loses the level
  const bombOk = (mask, spent) => bombs.every(i => (mask >> i & 1) || spent < rings[i].bomb);
  function free(gs, mask, tray, i) {
    if (rings[i].lock && merges(mask, tray) < 1) return false;
    if (rings[i].clock && mergesOf(mask, tray, rings[i].clock) < 1) return false;
    for (const p of pinKeys) if (p.i === i && !(gs[i] >> p.k & 1)) return false;
    for (let li = 0; li < links.length; li++) { const L = links[li]; if (L.a !== i && L.b !== i) continue;
      const o = L.a === i ? L.b : L.a; if (mask >> o & 1) continue;
      if (!(linkKeys[li][0].some(k => gs[L.a] >> k & 1) || linkKeys[li][1].some(k => gs[L.b] >> k & 1))) return false; }
    return true; }
  const key = s => { let k = s.mask + '|' + s.tray.join('') + '|' + s.ice.join('');
    for (let i = 0; i < n; i++) k += ',' + ((s.mask >> i & 1) ? 'x' : (s.gs[i] & relMask(i, s.mask))); return k; };
  const start = { gs: init, mask: 0, tray: [0, 0, 0], ice: iceIdx.map(() => 0) };
  const dist = new Map([[key(start), 0]]), parent = new Map();
  // bucket queue: releases cost 0, rotations cost 1 (heavy rings 2)
  const buckets = [[start]];
  let d = 0, seen = 0;
  for (; d < buckets.length; d++) {
    const dq = buckets[d] ?? [];
    while (dq.length) { const s = dq.pop(); if (dist.get(key(s)) < d) continue; seen++;
      if (dist.size > limit) return null;
      if (s.mask === (1 << n) - 1 && s.tray.every(x => x === 0)) {
        const res = { moves: d, states: seen };
        if (wantPath) { const path = []; let k = key(s); while (parent.has(k)) { const [pk, act] = parent.get(k); path.unshift(act); k = pk; } res.path = path; }
        return res;
      }
      const sk = wantPath ? key(s) : null;
      for (let i = 0; i < n; i++) { if (s.mask >> i & 1) continue; if (!free(s.gs, s.mask, s.tray, i)) continue;
        const tray = s.tray.slice(), c = colIdx[rings[i].c]; tray[c]++; if (tray[c] >= MERGE) tray[c] -= MERGE;
        if (tray[0] + tray[1] + tray[2] >= SLOTS) continue;
        const ns = { gs: s.gs, mask: s.mask | 1 << i, tray, ice: s.ice }, nk = key(ns);
        if (!dist.has(nk) || dist.get(nk) > d) { dist.set(nk, d); dq.push(ns); if (wantPath) parent.set(nk, [sk, [i, null]]); } }
      for (let i = 0; i < n; i++) { if (s.mask >> i & 1) continue;
        const ii = iceIdx.indexOf(i); if (ii >= 0 && s.ice[ii] >= 2) continue;
        const cost = rings[i].heavy ? 2 : 1, nd = d + cost;
        if (!bombOk(s.mask, nd)) continue;
        const rm = relMask(i, s.mask);
        for (const { sig: sg, angle } of opts[i]) { if ((sg & rm) === (s.gs[i] & rm)) continue;
          const gs = s.gs.slice(); gs[i] = sg; const ice = ii >= 0 ? s.ice.map((v, k) => k === ii ? v + 1 : v) : s.ice;
          const ns = { gs, mask: s.mask, tray: s.tray, ice }, nk = key(ns);
          if (!dist.has(nk) || dist.get(nk) > nd) { dist.set(nk, nd); (buckets[nd] ??= []).push(ns); if (wantPath) parent.set(nk, [sk, [i, Math.round(angle * 180 / Math.PI * 100) / 100]]); } } } }
  }
  return { moves: Infinity, states: seen };
}

const MECHS = ['pin', 'fixed', 'twin', 'lock', 'ice', 'bomb', 'clock', 'heavy'];
// v3 schedule: a new ring type about every 7 levels, so all 8 are met by level 48 (was 3/11/21/31/41/101/201/301)
const MECH_START = { pin: 3, fixed: 8, twin: 14, lock: 21, ice: 27, bomb: 34, clock: 41, heavy: 48 };
const LATE = ['bomb', 'clock', 'heavy']; // the newest types; after level 100 most levels use one of them
function randomSpec(layout, ncol, mech) {
  const L = LAYOUTS[layout], n = L.pts.length, per = n / ncol;
  const colors = shuffle([].concat(...['r', 'b', 'g'].slice(0, ncol).map(c => Array(per).fill(c))));
  const gaps = colors.map(() => Math.round(rnd() * 23) * 15);
  const spec = { layout, colors, gaps, pins: [], fixed: [], twin: [], lock: [], ice: [] };
  const free = shuffle([...Array(n).keys()]);
  for (const [m, count] of Object.entries(mech)) for (let k = 0; k < count && free.length; k++) {
    const i = free.pop();
    if (m === 'pin') spec.pins.push([i, Math.round(rnd() * 23) * 15]);
    else if (m === 'bomb') (spec.bomb ??= []).push([i, 3 + Math.floor(rnd() * 5)]); // countdown 3–7 moves
    else if (m === 'clock') { // opens after a merge of another color that is on the board
      const others = [...new Set(colors)].filter(c => c !== colors[i]);
      (spec.clock ??= []).push([i, others.length ? others[Math.floor(rnd() * others.length)] : colors[i]]);
    }
    else (spec[m] ??= []).push(i);
  }
  return spec;
}
const pick = a => a[Math.floor(rnd() * a.length)];

// Role inside a 10-level arc (position 1..10).
const ARC = { 1: 'intro', 2: 'normal', 3: 'normal', 4: 'normal', 5: 'hard', 6: 'relief', 7: 'normal', 8: 'normal', 9: 'super', 10: 'bonus' };
const SLACK = { tut: 4, intro: 3, normal: 2, hard: 1, relief: 3, super: 0, bonus: 4 };
function planFor(n) { // n = level number 1..1000
  if (n === 1) return { role: 'tut1', layout: 'row3', ncol: 1, mech: {}, range: [2, 2], slack: SLACK.tut };
  if (n === 2) return { role: 'tut2', layout: 'g23', ncol: 2, mech: {}, range: [3, 4], slack: SLACK.tut };
  const pos = ((n - 1) % 10) + 1, arc = Math.floor((n - 1) / 10);
  const avail = MECHS.filter(m => MECH_START[m] <= n);
  const newMech = Object.entries(MECH_START).find(([, s]) => s === n)?.[0];
  let role = ARC[pos], mech = {};
  if (newMech) { role = 'new_' + newMech; mech = { [newMech]: 1 }; }
  else if (role === 'intro') role = 'normal';
  const extra = role === 'relief' || role === 'bonus' ? 0 : Math.min(3, 1 + Math.floor(arc / 3));
  // after level 100 the newer ring types (bomb, color lock, heavy) show up in most levels
  const fresh = n > 100 ? avail.filter(m => LATE.includes(m)) : [];
  if (!newMech && extra > 0 && fresh.length && rnd() < 0.7) { const m = pick(fresh); mech[m] = 1; }
  const done = Object.keys(mech).length;
  if (!newMech && avail.length) for (let k = done; k < extra; k++) { const m = pick(avail); mech[m] = (mech[m] || 0) + 1; }
  const big = role === 'hard' || role === 'super' || (role === 'normal' && arc >= 2 && rnd() < 0.5);
  const layout = big ? pick(L9) : pick(L6);
  const ncol = big ? 3 : 2;
  const lift = Math.min(2, Math.floor(arc / 3));
  const range = { normal: [3, 5], hard: [4, 7], super: [5, 9], relief: [2, 3], bonus: [2, 3] }[role] ?? [3, 5];
  return { role, layout, ncol, mech, range: role.startsWith('new') ? [3, 5] : [range[0] + (role === 'relief' || role === 'bonus' ? 0 : lift), range[1] + lift], slack: SLACK[role.startsWith('new') ? 'intro' : role] };
}

// Levels 101+: try a fixed number of candidates with a smaller solver budget and keep the one closest to the
// target difficulty (levels 1–100 keep the original search so they stay byte-identical).
const FAST_RANGE = { normal: [4, 6], hard: [5, 8], super: [6, 9], relief: [2, 3], bonus: [2, 3] };
function fastPick(n, plan) {
  const range = FAST_RANGE[plan.role] ?? plan.range;
  let best = null, bestD = Infinity;
  const tough = plan.role === 'hard' || plan.role === 'super';
  const limit = tough ? 100000 : plan.ncol === 3 ? 40000 : 25000;
  for (let t = 0; t < (tough ? 70 : 60); t++) {
    if (t % 30 === 29) plan.layout = plan.ncol === 3 ? pick(L9) : pick(L6);
    const spec = randomSpec(plan.layout, plan.ncol, plan.mech);
    const r = solve(build(spec), limit);
    if (!r || !isFinite(r.moves) || r.moves < 2) continue;
    const d = r.moves < range[0] ? range[0] - r.moves : r.moves > range[1] ? r.moves - range[1] : 0;
    if (d < bestD) { bestD = d; best = { ...spec, role: plan.role, minMoves: r.moves, moves: r.moves + plan.slack }; }
    if (d === 0) break;
  }
  if (best) best.sol = solve(build(best), limit, true).path; // store the verified solution right away
  return best;
}

/** Generate level number n (1-based). Deterministic: the same n always gives the same level. */
function makeLevel(n) {
  seed = 1000 + n * 7919; // each level has its own seed → workers / CI runs can split ranges
  const plan = planFor(n);
  let found = null;
  if (n > 100) found = fastPick(n, plan);
  for (let t = 0; t < 300 && !found; t++) {
    const spec = randomSpec(plan.layout, plan.ncol, plan.mech);
    const r = solve(build(spec), plan.ncol === 3 ? 120000 : 60000);
    if (!r || !isFinite(r.moves) || r.moves < plan.range[0] || r.moves > plan.range[1]) {
      if (t % 40 === 39) { plan.layout = plan.ncol === 3 ? pick(L9) : pick(L6); if (t > 150) plan.range = [Math.max(1, plan.range[0] - 1), plan.range[1] + 1]; }
      continue;
    }
    found = { ...spec, role: plan.role, minMoves: r.moves, moves: r.moves + plan.slack };
  }
  if (!found) throw new Error('could not generate level ' + n);
  if (!found.sol) { const r = solve(build(found), 2000000, true); found.sol = r.path; }
  return found;
}

if (require.main === module) {
  const A = Number(process.argv[2] || 1), B = Number(process.argv[3] || 100), out = [];
  for (let n = A; n <= B; n++) {
    const found = makeLevel(n);
    out.push(found);
    console.error(`L${n} ${found.role} ${found.layout} min=${found.minMoves} limit=${found.moves}`);
  }
  const fs = require('fs');
  if (A === 1 && B === 100) fs.writeFileSync(__dirname + '/../levels/levels.json', JSON.stringify(out).replace(/\},\{/g, '},\n{'));
  else fs.writeFileSync(require('os').tmpdir() + `/levels-${A}-${B}.json`, JSON.stringify(out));
  console.error('wrote', out.length, 'levels');
}
module.exports = { LAYOUTS, build, solve, planFor, makeLevel };
