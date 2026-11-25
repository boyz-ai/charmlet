import './style.css';
import { Game } from './core/game';
import { Renderer } from './render/renderer';
import { attachInput } from './input/input';
import { FeedbackManager } from './feedback/feedback';
import { LAYOUTS, LEVELS } from './levels/levels';
import { LocalSaveService, type Lang, type SaveData } from './services/save';
import { setLang, t } from './i18n';
import {
  BOOSTERS, BOOSTER_PRICE, CONTINUE_MOVES, CONTINUE_PRICE, DAILY, buyContinue, claimDaily, dailyAvailable, dayKey,
  refundBooster, spendBooster, streakBonus, winCoins, autoHint, HINT_NUDGE_FAILS, type Booster,
} from './meta/meta';
import { PRODUCTS, TestAds, TestDialog, TestIAP, canBuy, grant, interstitialDue, type AdService, type IAPService } from './services/monetize';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('c');
const fb = new FeedbackManager();
const renderer = new Renderer(cv);
const store = new LocalSaveService();
const save: SaveData = store.load();
const persist = (): void => store.save(save);

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
  $('langTr').setAttribute('aria-pressed', String(save.lang === 'tr'));
  $('langEn').setAttribute('aria-pressed', String(save.lang === 'en'));
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
  $('playBtn').textContent = `${t('play')} · ${t('playLevel', { n: save.level + 1 })}`;
  $('homeStreak').textContent = save.streak > 0 ? t('streakNow', { n: save.streak }) : '';
  $('homeCoins').textContent = String(save.coins);
  $('dailyBtn').classList.toggle('glow', dailyAvailable(save, dayKey(new Date())) !== null);
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
    show(t('winTitle'), t('replayDone'), t('continueAt', { n: save.level + 1 }), () => load(save.level), t('backToMap'), () => openMap());
    return;
  }
  if (!failedOnce) save.streak++;
  const coins = winCoins(LEVELS[level].role);
  save.coins += coins;
  const last = level === LEVELS.length - 1;
  save.best = Math.max(save.best, level + 1);
  save.level = last ? 0 : level + 1;
  save.levelsSinceAd++;
  persist();
  hud();
  const text = t('winCoins', { n: coins }) + (failedOnce ? '' : t('winStreak', { n: save.streak })) + (last ? t('winLast') : t('winNext'));
  // a forced ad may come after this win → then no 2× offer (GDD: never an ad right after declining 2×)
  const adNext = interstitialDue(save, performance.now() / 1000, lastAdS, false);
  const next = async (): Promise<void> => {
    if (adNext) { await ads.showInterstitial(); lastAdS = performance.now() / 1000; save.levelsSinceAd = 0; persist(); }
    load(save.level);
  };
  if (adNext) show(t('winTitle'), text, last ? t('again') : t('next'), () => void next());
  else show(t('winTitle'), text, last ? t('again') : t('next'), () => load(save.level), t('doubleCoins', { n: coins }), async () => {
    if (await ads.showRewarded('double')) { save.coins += coins; persist(); hud(); toast(t('doubled')); }
    load(save.level);
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

function openHome(): void { homeTexts(); $('home').classList.add('on'); $('playBtn').focus(); boosterTexts(); }
function closeHome(): void { $('home').classList.remove('on'); boosterTexts(); if (bonusMsg) { toast(bonusMsg); bonusMsg = ''; } }
function openSettings(): void {
  $<HTMLInputElement>('optSound').checked = save.sound;
  $<HTMLInputElement>('optVib').checked = save.vibration;
  $('settings').classList.add('on');
  $('setClose').focus();
}
function closeSettings(): void { $('settings').classList.remove('on'); boosterTexts(); }

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

// ---------- daily reward ----------
const rewardText = (i: number): string => {
  const r = DAILY[i];
  const icons: Record<Booster, string> = { hint: '💡', undo: '↶', slot: '⊕', magnet: '🧲' };
  return `${r.coins}` + Object.keys(r.boosters ?? {}).map(b => ' ' + icons[b as Booster]).join('');
};
function openDaily(): void {
  const today = dayKey(new Date()), avail = dailyAvailable(save, today);
  const cur = avail ?? (save.dailyStep + DAILY.length - 1) % DAILY.length;
  $('days').innerHTML = DAILY.map((_, i) =>
    `<li class="${i < cur || (avail === null && i === cur) ? 'done' : ''}${i === cur && avail !== null ? ' today' : ''}${i === DAILY.length - 1 ? ' big' : ''}">` +
    `<span>${t('day', { n: i + 1 })}</span><b><span class="coin" aria-hidden="true"></span> ${rewardText(i)}</b></li>`).join('');
  const btn = $<HTMLButtonElement>('dailyClaim');
  btn.textContent = avail === null ? t('dailyDone') : t('claim');
  btn.disabled = avail === null;
  $('daily').classList.add('on');
  (avail === null ? $('dailyClose') : btn).focus();
}
function closeDaily(): void { $('daily').classList.remove('on'); homeTexts(); boosterTexts(); }
function claimToday(): void {
  const r = claimDaily(save, dayKey(new Date()));
  if (!r) return;
  persist();
  fb.merge();
  toast(t('claimed', { n: r.coins }));
  hud(); homeTexts(); openDaily();
}

// ---------- boosters ----------
const overlayOpen = (): boolean => ['home', 'settings', 'daily', 'map', 'shop', 'td'].some(id => $(id).classList.contains('on'));
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
$('playBtn').addEventListener('click', () => { fb.unlock(); closeHome(); if (game.state !== 'play' || level !== save.level) load(save.level); });
$('setClose').addEventListener('click', closeSettings);
$('dailyBtn').addEventListener('click', () => { fb.unlock(); openDaily(); });
$('shopBtn').addEventListener('click', () => { fb.unlock(); openShop(); });
$('coinPill').addEventListener('click', () => { fb.unlock(); openShop(); });
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
$('dailyClaim').addEventListener('click', () => { fb.unlock(); claimToday(); });
$('dailyClose').addEventListener('click', closeDaily);
document.querySelectorAll<HTMLButtonElement>('.bst').forEach(btn => btn.addEventListener('click', () => useBooster(btn.dataset.b as Booster)));
$<HTMLInputElement>('optSound').addEventListener('change', e => { save.sound = fb.sound = (e.target as HTMLInputElement).checked; persist(); });
$<HTMLInputElement>('optVib').addEventListener('change', e => { save.vibration = fb.vibration = (e.target as HTMLInputElement).checked; persist(); });
$('langTr').addEventListener('click', () => setLanguage('tr'));
$('langEn').addEventListener('click', () => setLanguage('en'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSettings(); closeDaily(); closeMap(); closeShop(); } });

renderer.onLand = c => game.charmLanded(c);
attachInput(cv, () => game, renderer, fb, resetIdle);

fb.sound = save.sound;
fb.vibration = save.vibration;
setLang(save.lang);
load(level);
applyTexts();
// First launch goes straight into level 1; later launches open the home screen.
// The daily reward pops up over the home screen once per day (never on the very first launch).
if (save.seenHome) { openHome(); if (dailyAvailable(save, dayKey(new Date())) !== null) openDaily(); }
else { save.seenHome = true; persist(); }

let saveTick = 0;
let last = performance.now();
const t0 = last;
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const blocked = ['ov', 'home', 'settings', 'daily', 'map', 'shop', 'td'].some(id => $(id).classList.contains('on'));
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
