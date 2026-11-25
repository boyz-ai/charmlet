// Makes the next weekly level pack for live updates.
//   node tools/make-pack.cjs            → next pack after the last one in public/packs/index.json
//   node tools/make-pack.cjs 3          → pack 3
// Pack k holds levels 1000 + (k-1)*50 + 1 … 1000 + k*50, generated and solved by tools/gen.cjs.
// The tests (tests/packs.test.ts) replay every stored solution through the real game rules before CI publishes.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { makeLevel } = require('./gen.cjs');
const BUILT_IN = 1000, PACK = 50;
const dir = path.join(__dirname, '..', 'public', 'packs');
fs.mkdirSync(dir, { recursive: true });
const idxFile = path.join(dir, 'index.json');
const index = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : { packs: [] };
const k = Number(process.argv[2]) || (index.packs.reduce((m, p) => Math.max(m, p.pack), 0) + 1);
const from = BUILT_IN + (k - 1) * PACK + 1, to = from + PACK - 1;
const levels = [];
for (let n = from; n <= to; n++) {
  const lv = makeLevel(n);
  levels.push(lv);
  console.error(`pack ${k}: L${n} ${lv.role} min=${lv.minMoves}`);
}
const body = JSON.stringify({ pack: k, from, to, levels });
const file = `pack-${k}.json`;
fs.writeFileSync(path.join(dir, file), body);
const sha256 = crypto.createHash('sha256').update(body).digest('hex');
index.packs = index.packs.filter(p => p.pack !== k).concat({ pack: k, from, to, file, sha256 }).sort((a, b) => a.pack - b.pack);
fs.writeFileSync(idxFile, JSON.stringify(index, null, 2) + '\n');
console.error(`wrote ${file} (${levels.length} levels, ${from}–${to})`);
