// Puts the real AdMob ids into the game and the iPhone project, and turns test ads off.
//   node tools/set-admob.cjs <app id ca-app-pub-…~…> <rewarded ca-app-pub-…/…> <interstitial ca-app-pub-…/…>
const fs = require('fs'), path = require('path');
const [appId, rewarded, interstitial] = process.argv.slice(2);
const ok = (v, sep) => typeof v === 'string' && /^ca-app-pub-\d+[~/]\d+$/.test(v) && v.includes(sep);
if (!ok(appId, '~') || !ok(rewarded, '/') || !ok(interstitial, '/')) {
  console.error('usage: node tools/set-admob.cjs ca-app-pub-XXX~YYY ca-app-pub-XXX/REWARDED ca-app-pub-XXX/INTERSTITIAL');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const cfg = path.join(root, 'src', 'config.ts');
let s = fs.readFileSync(cfg, 'utf8');
s = s.replace(/testing: (true|false)/, 'testing: false')
  .replace(/rewarded: '[^']*'.*\n/, `rewarded: '${rewarded}',\n`)
  .replace(/interstitial: '[^']*'.*\n/, `interstitial: '${interstitial}',\n`);
fs.writeFileSync(cfg, s);
const plist = path.join(root, 'ios', 'App', 'App', 'Info.plist');
let p = fs.readFileSync(plist, 'utf8');
p = p.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${appId}$2`);
fs.writeFileSync(plist, p);
// app-ads.txt for the GitHub Pages site (Google pays less without it)
const pub = appId.split('~')[0].replace('ca-app-pub-', 'pub-');
fs.writeFileSync(path.join(root, 'public', 'app-ads.txt'), `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
console.log('AdMob ids set, test ads off, public/app-ads.txt written.');
