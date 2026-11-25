import './style.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import { Game } from './core/game';
import { Renderer } from './render/renderer';
import { HomeScene } from './render/home';
import { attachInput } from './input/input';
import { FeedbackManager } from './feedback/feedback';
import { LAYOUTS, LEVELS } from './levels/levels';
import { LANGS, LANG_NAMES, LocalSaveService, type Lang, type SaveData } from './services/save';
import { setLang, t } from './i18n';
import { appendPacks, cachedPacks, fetchNewPacks } from './services/packs';
import {
  BOOSTERS, BOOSTER_PRICE, CONTINUE_MOVES, CONTINUE_PRICE, buyContinue, claimDaily, dayKey,
  refundBooster, spendBooster, streakBonus, winCoins, autoHint, HINT_NUDGE_FAILS, type Booster,
} from './meta/meta';
import { CHAPTER_REWARD, COLLECTION, COSMETICS, buyOrWear, collected, ownsCos, type CosKind } from './meta/workshop';
import { PRODUCTS, TestAds, TestDialog, TestIAP, canBuy, grant, interstitialDue, restoreOwned, type AdService, type IAPService } from './services/monetize';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('c');
const fb = new FeedbackManager();
const renderer = new Renderer(cv);
const homeScene = new HomeScene($<HTMLCanvasElement>('homeCv'));
const store = new LocalSaveService();
const save: SaveData = store.load();
const persist = (): void => store.save(save);

appendPacks(LEVELS, cachedPacks()); // weekly packs downloaded earlier
let level = Math.min(save.level, LEVELS.length - 1);
let failedOnce = false;
/** seconds since the player last touched the board (drives the ghost-hand hint) */
let idle = 0;
const TUTORIAL_LEVELS = 3, TUTORIAL_HINT_DELAY = 0.8, HINT_DELAY = 5;
/** losses on the current level (glows the Hint button after HINT_NUDGE_FAILS) */
let fails = 0;
/** true while the player replays a level they already finished (no rewards, no streak) */
let replay = false;
// ads + purchases (test implementations until the native build)
const dialog = new TestDialog($('td'), t);
const ads: AdService = new TestAds(dialog);
const iap: IAPService = new TestIAP(dialog, t);
let lastAdS = -1e9;
const resetIdle = (): void => { idle = 0; renderer.hint = null; };
let game!: Game;
/** streak-bonus message waiting for the home screen to close */
let bonusMsg = '';

// ---------- language & static texts ----------
function applyTexts(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => (el.textContent = t(el.dataset.i18n!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria!)));
  document.title = t('title');
  $<HTMLSelectElement>('langSel').value = save.lang;
  if (game) levelTexts();
  homeTexts();
  boosterTexts();
}
function levelTexts(): void {
  const spec = LEVELS[level];
  $('lv').textContent = `${t('level', { n: level + 1, total: LEVELS.length })} · ${t('role.' + spec.role)}`;
  $('hint').textContent = t('hint.' + spec.role);
}
function homeTexts(): void {
  $('playBtn').textContent = save.level < LEVELS.length ? `${t('play')} · ${t('playLevel', { n: save.level + 1 })}` : t('play');
  $('homeStreak').textContent = save.streak > 0 ? t('streakNow', { n: save.streak }) : '';
  $('homeCoins').textContent = String(save.coins);
}
function boosterTexts(): void {
  for (const b of BOOSTERS) {
    const btn = $(`b${b[0].toUpperCase()}${b.slice(1)}`), em = btn.querySelector('em')!;
    const n = save.boosters[b];
    em.className = n > 0 ? '' : 'price';
    em.textContent = n > 0 ? String(n) : String(BOOSTER_PRICE[b]);
    btn.setAttribute('aria-label', `${t('b.' + b)}: ${n > 0 ? t('owned', { n }) : t('price', { n: BOOSTER_PRICE[b] })}`);
    btn.setAttribute('aria-disabled', String(!canUse(b)));
  }
  $('bHint').classList.toggle('glow', fails >= HINT_NUDGE_FAILS && game?.state === 'play');
}
let toastTimer = 0;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 1800);
}
function setLanguage(l: Lang): void { save.lang = l; setLang(l); persist(); applyTexts(); }

// ---------- game ----------
function load(n: number, keepFail = false, isReplay = false): void {
  level = n;
  if (!keepFail) replay = isReplay;
  if (!keepFail) { failedOnce = false; fails = 0; }
  const spec = LEVELS[n];
  game = new Game(spec, LAYOUTS[spec.layout]);
  renderer.reset();
  game.on(e => {
    switch (e.type) {
      case 'release': fb.release(); renderer.fly(e.color, e.from, e.slot); renderer.sparkle(e.from); resetIdle(); break;
      case 'merge': fb.merge(); renderer.burst(e.slots, e.color); break;
      case 'locked': fb.locked(); renderer.shake(e.ring); break;
      case 'becameFree': fb.becameFree(); break;
      case 'move': hud(); resetIdle(); break;
      case 'win': onWin(); break;
      case 'lose': onLose(e.reason); break;
      case 'magnet': fb.whoosh(); renderer.pull(e.slots, e.color); break;
      case 'slot': fb.becameFree(); break;
      case 'undo': fb.tick(); resetIdle(); break;
    }
    if (e.type !== 'becameFree') boosterTexts();
  });
  // win streak: 3+ first-try wins in a row → this level starts with bonus moves
  const bonus = keepFail || replay ? 0 : streakBonus(save.streak);
  bonusMsg = bonus ? t('streakBonus', { n: bonus, s: save.streak }) : '';
  if (bonus) game.moves += bonus;
  if (bonusMsg && !overlayOpen()) { toast(bonusMsg); bonusMsg = ''; }
  $('stPill').classList.toggle('bonus', bonus > 0);
  levelTexts();
  hideOverlay();
  maybeCoach();
  resetIdle();
  hud();
}

function hud(): void {
  $('mv').textContent = String(game.moves); $('st').textContent = String(save.streak); $('cn').textContent = String(save.coins);
  boosterTexts();
}

function onWin(): void {
  fb.win();
  renderer.confetti();
  if (replay) {
    show(t('winTitle'), t('replayDone'), t('continueAt', { n: Math.min(save.level, LEVELS.length - 1) + 1 }), () => playNext(), t('backToMap'), () => openMap());
    return;
  }
  if (!failedOnce) save.streak++;
  const coins = winCoins(LEVELS[level].role);
  save.coins += coins;
  const last = level === LEVELS.length - 1;
  const before = collected(save.best);
  save.best = Math.max(save.best, level + 1);
  const gotNew = collected(save.best) > before;
  if (gotNew) save.coins += CHAPTER_REWARD;
  save.level = level + 1; // past the last level = waiting for the next weekly pack
  save.levelsSinceAd++;
  persist();
  hud();
  if (gotNew) toast(t('newCollect', { e: COLLECTION[collected(save.best) - 1], c: CHAPTER_REWARD }));
  const text = t('winCoins', { n: coins }) + (failedOnce ? '' : t('winStreak', { n: save.streak })) + (last ? t('winLast') : t('winNext'));
  // a forced ad may come after this win → then no 2× offer (GDD: never an ad right after declining 2×)
  const adNext = interstitialDue(save, performance.now() / 1000, lastAdS, false);
  const next = async (): Promise<void> => {
    if (adNext) { await ads.showInterstitial(); lastAdS = performance.now() / 1000; save.levelsSinceAd = 0; persist(); }
    playNext();
  };
  if (adNext) show(t('winTitle'), text, last ? t('again') : t('next'), () => void next());
  else show(t('winTitle'), text, last ? t('again') : t('next'), () => playNext(), t('doubleCoins', { n: coins }), async () => {
    if (await ads.showRewarded('double')) { save.coins += coins; persist(); hud(); toast(t('doubled')); }
    playNext();
  });
}

function onLose(reason: 'tray' | 'moves' | 'bomb'): void {
  fb.lose();
  failedOnce = true;
  fails++;
  const retry = (): void => { if (!replay) { save.streak = 0; persist(); } load(level, true); };
  const burn = save.streak > 0 && !replay ? t('streakBurn', { n: save.streak }) : '';
  if (reason === 'bomb') {
    fb.boom(); renderer.kick(0, 6);
    show(t('bombTitle'), burn + t('bombText'), t('retry'), retry);
  } else if (reason === 'tray') {
    // rescue with the booster bar below the board (Magnet / Extra slot)
    const rescue = canUse('magnet') || canUse('slot') ? t('trayRescue') : t('trayFullText');
    show(t('trayFullTitle'), burn + rescue, t('retry'), retry);
  } else {
    const left = game.rings.filter(r => !r.gone).length;
    const cont = (): void => { game.addMoves(CONTINUE_MOVES); hideOverlay(); hud(); };
    // coins first; without coins a rewarded ad will go here (M7) — for now a free test button
    const watch = async (): Promise<void> => { if (await ads.showRewarded('continue')) cont(); };
    if (save.coins >= CONTINUE_PRICE)
      show(t('outOfMovesTitle'), burn + t('ringsLeft', { n: left }), t('watchMoves'), () => void watch(),
        t('continueCoins', { n: CONTINUE_MOVES, p: CONTINUE_PRICE }), () => { if (buyContinue(save)) { persist(); cont(); } }, t('retry'), retry);
    else
      show(t('outOfMovesTitle'), burn + t('ringsLeft', { n: left }), t('watchMoves'), () => void watch(), t('retry'), retry);
  }
}

// ---------- overlays ----------
function show(title: string, text: string, b1: string, f1: () => void, b2?: string, f2?: () => void, b3?: string, f3?: () => void): void {
  $('ot').textContent = title; $('op').textContent = text;
  const o1 = $('ob'), o2 = $('ob2'), o3 = $('ob3');
  o1.textContent = b1; o1.onclick = () => { fb.unlock(); f1(); hud(); };
  o2.style.display = b2 ? '' : 'none';
  if (b2 && f2) { o2.textContent = b2; o2.onclick = () => { fb.unlock(); f2(); hud(); }; }
  o3.style.display = b3 ? 'block' : 'none';
  if (b3 && f3) { o3.textContent = b3; o3.onclick = () => { fb.unlock(); f3(); hud(); }; }
  $('ov').classList.add('on');
}
function hideOverlay(): void { $('ov').classList.remove('on'); }

function openHome(): void { homeTexts(); $('home').classList.add('on'); homeScene.start(); $('playBtn').focus(); boosterTexts(); }
function closeHome(): void { $('home').classList.remove('on'); homeScene.stop(); maybeCoach(); boosterTexts(); if (bonusMsg) { toast(bonusMsg); bonusMsg = ''; } }
function openSettings(): void {
  $<HTMLInputElement>('optSound').checked = save.sound;
  $<HTMLInputElement>('optVib').checked = save.vibration;
  $<HTMLInputElement>('optMusic').checked = save.music;
  $('settings').classList.add('on');
  $('setClose').focus();
}
function closeSettings(): void { $('settings').classList.remove('on'); boosterTexts(); }

/** Introduce the booster bar once, right after the tutorials, when the board is visible. */
function maybeCoach(): void {
  if (save.seenBoosters || level < 3 || replay || overlayOpen()) return;
  save.seenBoosters = true; persist();
  $('coachText').textContent = t('coachBoosters');
  const bar = document.querySelector('.boosters')!.getBoundingClientRect();
  $('coach').style.bottom = `${Math.max(12, window.innerHeight - bar.top + 14)}px`; // sits just above the booster bar
  $('coach').classList.add('on');
}

/** Play the next new level; after the last one, replay a random finished level until new packs arrive. */
function playNext(): void {
  if (save.level < LEVELS.length) { load(save.level); return; }
  toast(t('allDone'));
  load(3 + Math.floor(Math.random() * (LEVELS.length - 3)), false, true);
}

// ---------- shop ----------
function openShop(): void {
  $('shopCoins').textContent = String(save.coins);
  $('shopList').innerHTML = PRODUCTS.map(p => {
    const can = canBuy(save, p);
    return `<li class="${p.id === 'coins_l' ? 'best' : ''}"><div class="pi"><b>${t('p.' + p.id)}${p.id === 'coins_l' ? ' · ' + t('bestValue') : ''}</b><span>${t('pd.' + p.id)}</span></div>` +
      `<button data-p="${p.id}" ${can ? '' : 'disabled'}>${can ? p.price : t('owned1')}</button></li>`;
  }).join('');
  $('shop').classList.add('on');
}
function closeShop(): void { $('shop').classList.remove('on'); hud(); homeTexts(); }
$('shopList').addEventListener('click', async e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-p]');
  const p = PRODUCTS.find(x => x.id === btn?.dataset.p);
  if (!p || !canBuy(save, p)) return;
  fb.unlock();
  if (await iap.buy(p)) { grant(save, p); persist(); fb.win(); toast(t('bought')); openShop(); }
});

// ---------- level map ----------
const CHAPTER = 50;
let mapChapter = 0;
const unlocked = (): number => Math.max(save.best, save.level); // levels below this index are finished
function openMap(ch = Math.floor(save.level / CHAPTER)): void {
  mapChapter = Math.max(0, Math.min(ch, Math.ceil(LEVELS.length / CHAPTER) - 1));
  const a = mapChapter * CHAPTER, b = Math.min(LEVELS.length, a + CHAPTER);
  const done = Math.max(0, Math.min(b, unlocked()) - a);
  $('mapTitle').textContent = t('chapter', { n: mapChapter + 1 });
  $('mapSub').textContent = t('chapterSub', { a: a + 1, b, done, total: b - a });
  $<HTMLButtonElement>('mapPrev').disabled = mapChapter === 0;
  $<HTMLButtonElement>('mapNext').disabled = b >= LEVELS.length;
  let html = '';
  for (let r = a; r < b; r += 5) {
    html += `<li class="prow${((r - a) / 5) % 2 ? ' rev' : ''}">`;
    for (let i = r; i < Math.min(b, r + 5); i++) {
      const role = LEVELS[i].role, cur = i === save.level, open = i < unlocked() || cur;
      const cls = ['node', cur ? 'cur' : open ? 'done' : 'locked', role === 'hard' || role === 'super' ? role : ''].join(' ');
      const mark = role === 'bonus' ? '<i aria-hidden="true">🎁</i>' : role === 'super' ? '<i aria-hidden="true">🔥</i>' : '';
      const nw = role.startsWith('new_') ? `<b>${t('new')}</b>` : '';
      html += `<button class="${cls}" data-l="${i}" ${open ? '' : 'disabled'} aria-label="${t('playLevel', { n: i + 1 })}">${i + 1}${mark}${nw}</button>`;
    }
    html += '</li>';
  }
  $('path').innerHTML = html;
  $('map').classList.add('on');
  ($('path').querySelector('.cur') as HTMLElement | null)?.scrollIntoView({ block: 'center' });
  hideOverlay();
  boosterTexts();
}
function closeMap(): void { $('map').classList.remove('on'); boosterTexts(); }

// ---------- daily gift (automatic, no extra screen) ----------
function dailyGift(): void {
  const r = claimDaily(save, dayKey(new Date()));
  if (!r) return;
  persist(); hud(); homeTexts();
  toast(t('dailyGift', { n: r.coins }));
}

// ---------- Bracelet Workshop ----------
const BOARD_SWATCH: Record<string, string> = {
  'board.velvet': 'radial-gradient(circle at 50% 35%,#6e2b5e,#33102c 72%)',
  'board.night': 'radial-gradient(circle at 50% 35%,#2b3f7d,#0b1029 72%)',
  'board.emerald': 'radial-gradient(circle at 50% 35%,#2a7a63,#0c2a22 72%)',
  'board.ocean': 'radial-gradient(circle at 50% 35%,#2a7799,#0b2433 72%)',
  'board.rose': 'radial-gradient(circle at 50% 35%,#a5566f,#3a1426 72%)',
};
let workTab: CosKind | 'col' = 'ring';
function applyLook(): void {
  renderer.look = { ring: save.cos.ring, charm: save.cos.charm };
  cv.style.background = BOARD_SWATCH[save.cos.board] ?? BOARD_SWATCH['board.velvet'];
}
function openWork(tab: CosKind | 'col' = workTab): void {
  workTab = tab;
  $('workCoins').textContent = String(save.coins);
  document.querySelectorAll<HTMLButtonElement>('#work .tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const box = $('witems');
  if (tab === 'col') {
    const n = collected(Math.max(save.best, save.level));
    box.innerHTML = `<p class="small">${t('colText', { n, total: COLLECTION.length, c: CHAPTER_REWARD })}</p><div class="bracelet">` +
      COLLECTION.map((e, i) => `<span class="${i < n ? 'got' : ''}" title="${t('chapter', { n: i + 1 })}">${i < n ? e : '?'}</span>`).join('') + '</div>';
  } else {
    box.innerHTML = '<div class="wgrid">' + COSMETICS.filter(c => c.kind === tab).map(c => {
      const worn = save.cos[c.kind] === c.id, own = ownsCos(save, c.id);
      const pv = c.kind === 'board' ? `<div class="pv" style="background:${BOARD_SWATCH[c.id]}"></div>` : `<canvas class="pv" data-pv="${c.id}"></canvas>`;
      const label = worn ? t('worn') : own ? t('wear') : `<span class="coin" aria-hidden="true"></span> ${c.price}`;
      return `<div class="witem${worn ? ' worn' : ''}">${pv}<b>${t('cos.' + c.id)}</b><button data-cos="${c.id}" ${worn ? 'disabled' : ''}>${label}</button></div>`;
    }).join('') + '</div>';
    box.querySelectorAll<HTMLCanvasElement>('canvas[data-pv]').forEach(pc => renderer.preview(pc, tab === 'charm' ? 'charm' : 'ring', pc.dataset.pv!));
  }
  $('work').classList.add('on');
}
function closeWork(): void { $('work').classList.remove('on'); hud(); homeTexts(); }
$('work').addEventListener('click', e => {
  const el = e.target as HTMLElement;
  const tab = el.closest<HTMLButtonElement>('.tabs button')?.dataset.tab;
  if (tab) { openWork(tab as CosKind | 'col'); return; }
  const id = el.closest<HTMLButtonElement>('button[data-cos]')?.dataset.cos;
  if (!id) return;
  fb.unlock();
  const r = buyOrWear(save, id);
  if (r === 'poor') { fb.locked(); toast(t('needCoins', { n: (COSMETICS.find(c => c.id === id)?.price ?? 0) - save.coins })); return; }
  if (r === 'bought') { fb.merge(); toast(t('newLook')); } else fb.becameFree();
  persist(); applyLook(); hud(); openWork();
});

// ---------- boosters ----------
const overlayOpen = (): boolean => ['home', 'settings', 'work', 'map', 'shop', 'td'].some(id => $(id).classList.contains('on'));
function canUse(b: Booster): boolean {
  if (!game || overlayOpen()) return false;
  if (b === 'hint') return game.state === 'play' && !renderer.hint && game.suggest() !== null;
  return b === 'undo' ? game.canUndo() : b === 'slot' ? game.canAddSlot() : game.canMagnet();
}
function useBooster(b: Booster): void {
  fb.unlock();
  if (overlayOpen()) return;
  if (!canUse(b)) { fb.locked(); toast(t('no.' + b)); return; }
  const how = spendBooster(save, b);
  if (!how) { fb.locked(); toast(t('needCoins', { n: BOOSTER_PRICE[b] - save.coins })); return; }
  let ok: boolean;
  if (b === 'hint') { renderer.hint = game.suggest(); ok = renderer.hint !== null; idle = 0; }
  else ok = b === 'undo' ? game.undo() : b === 'slot' ? game.addSlot() : game.magnet();
  if (!ok) refundBooster(save, b, how);
  persist();
  if (game.state === 'play') hideOverlay();
  hud();
}

// ---------- wiring ----------
$('rs').addEventListener('click', () => { fb.unlock(); load(level); });
$('homeBtn').addEventListener('click', () => { fb.unlock(); openHome(); });
$('setBtn').addEventListener('click', () => { fb.unlock(); openSettings(); });
$('homeSet').addEventListener('click', () => { fb.unlock(); openSettings(); });
$('playBtn').addEventListener('click', () => { fb.unlock(); closeHome(); if (game.state !== 'play' || level !== save.level) playNext(); });
$('setClose').addEventListener('click', closeSettings);
$('workBtn').addEventListener('click', () => { fb.unlock(); openWork(); });
$('workClose').addEventListener('click', closeWork);
$('shopBtn').addEventListener('click', () => { fb.unlock(); openShop(); });
$('coinPill').addEventListener('click', () => { fb.unlock(); openShop(); });
$('homeCoinBtn').addEventListener('click', () => { fb.unlock(); openShop(); });
$('shopClose').addEventListener('click', closeShop);
$('mapBtn').addEventListener('click', () => { fb.unlock(); closeHome(); openMap(); });
$('mapPrev').addEventListener('click', () => openMap(mapChapter - 1));
$('mapNext').addEventListener('click', () => openMap(mapChapter + 1));
$('mapClose').addEventListener('click', () => { closeMap(); openHome(); });
$('path').addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.node');
  if (!btn || btn.disabled) return;
  fb.unlock();
  const n = Number(btn.dataset.l);
  closeMap();
  load(n, false, n !== save.level);
});
document.querySelectorAll<HTMLButtonElement>('.bst').forEach(btn => btn.addEventListener('click', () => useBooster(btn.dataset.b as Booster)));
$<HTMLInputElement>('optSound').addEventListener('change', e => { save.sound = fb.sound = (e.target as HTMLInputElement).checked; persist(); });
$<HTMLInputElement>('optMusic').addEventListener('change', e => { save.music = fb.music = (e.target as HTMLInputElement).checked; persist(); if (save.music) { fb.unlock(); fb.startMusic(); } });
$('restoreBtn').addEventListener('click', async () => {
  const n = restoreOwned(save, await iap.restore());
  persist(); toast(n > 0 || save.paid ? t('restored') : t('nothingRestore'));
});
$('coachOk').addEventListener('click', () => $('coach').classList.remove('on'));
$<HTMLInputElement>('optVib').addEventListener('change', e => { save.vibration = fb.vibration = (e.target as HTMLInputElement).checked; persist(); });
$('langSel').innerHTML = LANGS.map(l => `<option value="${l}">${LANG_NAMES[l]}</option>`).join('');
$('langSel').addEventListener('change', e => setLanguage((e.target as HTMLSelectElement).value as Lang));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSettings(); closeWork(); closeMap(); closeShop(); } });

renderer.onLand = c => game.charmLanded(c);
attachInput(cv, () => game, renderer, fb, resetIdle);

fb.sound = save.sound;
fb.vibration = save.vibration;
fb.music = save.music;
// browsers only allow sound after the first touch: start the music then
window.addEventListener('pointerdown', () => { fb.unlock(); fb.startMusic(); }, { once: true });
setLang(save.lang);
load(level);
applyTexts();
// First launch goes straight into level 1; later launches open the home screen.
applyLook();
// new weekly levels: download in the background, add them when they are verified
void fetchNewPacks(LEVELS.length).then(p => {
  const n = appendPacks(LEVELS, p);
  if (n) { toast(t('newLevels', { n })); homeTexts(); if (game.state === 'play') levelTexts(); }
});
// A small daily gift once per day (never on the very first launch).
if (save.seenHome) { openHome(); dailyGift(); }
else { save.seenHome = true; persist(); }

let saveTick = 0;
let last = performance.now();
const t0 = last;
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const blocked = ['ov', 'home', 'settings', 'work', 'map', 'shop', 'td'].some(id => $(id).classList.contains('on'));
  if (game.state === 'play' && !blocked) {
    idle += dt;
    save.playTime += dt;
    if ((saveTick += dt) > 10) { saveTick = 0; persist(); }
    const delay = level < TUTORIAL_LEVELS ? TUTORIAL_HINT_DELAY : HINT_DELAY;
    if (autoHint(level, LEVELS[level].role) && idle >= delay && !renderer.hint) renderer.hint = game.suggest();
  } else if (renderer.hint) resetIdle();
  renderer.update(dt);
  renderer.draw(game, (now - t0) / 1000, game.state === 'play');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
