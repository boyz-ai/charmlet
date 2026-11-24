// Adds a verified solution path ("sol": [[ring, angleDeg | null(=tap)], ...]) to every level in levels/levels.json.
const fs = require('fs');
const { build, solve } = require('./gen.cjs');
const file = __dirname + '/../levels/levels.json';
const levels = JSON.parse(fs.readFileSync(file, 'utf8'));
levels.forEach((lv, n) => {
  const r = solve(build({ fixed: [], twin: [], lock: [], ice: [], ...lv }), 2000000, true);
  if (!r || !r.path) throw new Error('level ' + (n + 1) + ' not solvable');
  if (r.moves !== lv.minMoves) console.error('note: level', n + 1, 'min moves', r.moves, 'vs', lv.minMoves);
  lv.sol = r.path;
});
fs.writeFileSync(file, JSON.stringify(levels).replace(/\},\{/g, '},\n{'));
console.error('solutions written for', levels.length, 'levels');
