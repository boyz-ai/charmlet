// Levels 551–1000 = mirror images of levels 101–550 (left↔right) with the colors swapped.
// Same rules, same difficulty, same place on the sawtooth curve, but a different-looking board.
// Usage: node tools/mirror.cjs <levels-101-550.json>  → prints levels 551–1000 as JSON on stdout.
const fs = require('fs');
const { LAYOUTS, build, solve } = require('./gen.cjs');
const W = 360;
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const norm = d => Math.round((((180 - d) % 360 + 360) % 360) * 100) / 100;
const PERMS = [{ r: 'b', b: 'g', g: 'r' }, { r: 'g', b: 'r', g: 'b' }, { r: 'b', b: 'r', g: 'g' }];
const out = src.map((lv, k) => {
  const pts = LAYOUTS[lv.layout].pts;
  // mirrored layout: the same layout when it is symmetric, otherwise its "m" twin (zig6 → zig6m)
  let layout = lv.layout;
  const find = (L, x, y) => LAYOUTS[L].pts.findIndex(([px, py]) => Math.abs(px - x) <= 1 && py === y);
  if (pts.some(([x, y]) => find(layout, W - x, y) < 0)) layout = lv.layout + 'm';
  const map = pts.map(([x, y]) => find(layout, W - x, y));
  if (map.some(i => i < 0) || new Set(map).size !== map.length) throw new Error('no mirror for ' + lv.layout);
  const perm = PERMS[k % PERMS.length];
  const n = pts.length, inv = Array(n);
  map.forEach((j, i) => (inv[j] = i));
  const re = arr => arr?.map(i => map[i]);
  return {
    layout,
    colors: inv.map(i => perm[lv.colors[i]]),
    gaps: inv.map(i => norm(lv.gaps[i])),
    pins: lv.pins.map(([i, d]) => [map[i], norm(d)]),
    fixed: re(lv.fixed), twin: re(lv.twin), lock: re(lv.lock), ice: re(lv.ice),
    ...(lv.heavy ? { heavy: re(lv.heavy) } : {}),
    ...(lv.bomb ? { bomb: lv.bomb.map(([i, t]) => [map[i], t]) } : {}),
    ...(lv.clock ? { clock: lv.clock.map(([i, c]) => [map[i], perm[c]]) } : {}),
    role: lv.role, minMoves: lv.minMoves, moves: lv.moves,
    sol: (lv.sol ?? []).map(([i, d]) => [map[i], d === null ? null : norm(d)]),
  };
});
// re-solve every mirrored level (hex6 positions are rounded, so the mirror is not always pixel-exact)
out.forEach((lv, k) => {
  const r = solve(build({ fixed: [], twin: [], lock: [], ice: [], ...lv }), 2000000, true);
  if (!r || !r.path) throw new Error('mirrored level ' + (k + 551) + ' not solvable');
  if (r.moves !== lv.minMoves) { console.error('L' + (k + 551) + ' min', lv.minMoves, '→', r.moves); lv.moves += r.moves - lv.minMoves; lv.minMoves = r.moves; }
  lv.sol = r.path;
});
process.stdout.write(JSON.stringify(out));
