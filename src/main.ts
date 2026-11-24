import './style.css';
import { Game } from './core/game';
import { Renderer } from './render/renderer';
import { attachInput } from './input/input';
import { FeedbackManager } from './feedback/feedback';
import { LAYOUTS, LEVELS } from './levels/levels';
import { LocalSaveService, type Lang, type SaveData } from './services/save';
import { setLang, t } from './i18n';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('c');
const fb = new FeedbackManager();
const renderer = new Renderer(cv);
const store = new LocalSaveService();
const save: SaveData = store.load();
const persist = (): void => store.save(save);

let level = Math.min(save.level, LEVELS.length - 1);
let failedOnce = false;
let game!: Game;

// ---------- language & static texts ----------
function applyTexts(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => (el.textContent = t(el.dataset.i18n!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria!)));
  document.title = t('title');
  $('langTr').setAttribute('aria-pressed', String(save.lang === 'tr'));
  $('langEn').setAttribute('aria-pressed', String(save.lang === 'en'));
  if (game) levelTexts();
  homeTexts();
}
function levelTexts(): void {
  const spec = LEVELS[level];
  $('lv').textContent = `${t('level', { n: level + 1, total: LEVELS.length })} · ${t('role.' + spec.role)}`;
  $('hint').textContent = t('hint.' + spec.role);
}
function homeTexts(): void {
  $('playBtn').textContent = `${t('play')} · ${t('playLevel', { n: level + 1 })}`;
  $('homeStreak').textContent = save.streak > 0 ? t('streakNow', { n: save.streak }) : '';
}
function setLanguage(l: Lang): void { save.lang = l; setLang(l); persist(); applyTexts(); }

// ---------- game ----------
function load(n: number, keepFail = false): void {
  level = n;
  if (!keepFail) failedOnce = false;
  const spec = LEVELS[n];
  game = new Game(spec, LAYOUTS[spec.layout]);
  renderer.reset();
  game.on(e => {
    switch (e.type) {
      case 'release': fb.release(); renderer.fly(e.color, e.from, e.slot); break;
      case 'merge': fb.merge(); renderer.burst(e.slots, e.color); break;
      case 'locked': fb.locked(); renderer.shake(e.ring); break;
      case 'becameFree': fb.becameFree(); break;
      case 'move': hud(); break;
      case 'win': onWin(); break;
      case 'lose': onLose(e.reason); break;
    }
  });
  levelTexts();
  hideOverlay();
  hud();
}

function hud(): void { $('mv').textContent = String(game.moves); $('st').textContent = String(save.streak); }

function onWin(): void {
  fb.win();
  if (!failedOnce) save.streak++;
  const last = level === LEVELS.length - 1;
  save.level = last ? 0 : level + 1;
  persist();
  hud();
  show(t('winTitle'), (failedOnce ? '' : t('winStreak', { n: save.streak })) + (last ? t('winLast') : t('winNext')),
    last ? t('again') : t('next'), () => load(save.level));
}

function onLose(reason: 'tray' | 'moves'): void {
  fb.lose();
  failedOnce = true;
  const retry = (): void => { save.streak = 0; persist(); load(level, true); };
  if (reason === 'tray') {
    show(t('trayFullTitle'), t('trayFullText'), t('retry'), retry);
  } else {
    const left = game.rings.filter(r => !r.gone).length;
    show(t('outOfMovesTitle'), (save.streak > 0 ? t('streakBurn', { n: save.streak }) : '') + t('ringsLeft', { n: left }),
      t('plusMoves'), () => { game.addMoves(3); hideOverlay(); }, t('retry'), retry);
  }
}

// ---------- overlays ----------
function show(title: string, text: string, b1: string, f1: () => void, b2?: string, f2?: () => void): void {
  $('ot').textContent = title; $('op').textContent = text;
  const o1 = $('ob'), o2 = $('ob2');
  o1.textContent = b1; o1.onclick = () => { fb.unlock(); f1(); hud(); };
  o2.style.display = b2 ? '' : 'none';
  if (b2 && f2) { o2.textContent = b2; o2.onclick = () => { fb.unlock(); f2(); hud(); }; }
  $('ov').classList.add('on');
}
function hideOverlay(): void { $('ov').classList.remove('on'); }

function openHome(): void { homeTexts(); $('home').classList.add('on'); $('playBtn').focus(); }
function closeHome(): void { $('home').classList.remove('on'); }
function openSettings(): void {
  $<HTMLInputElement>('optSound').checked = save.sound;
  $<HTMLInputElement>('optVib').checked = save.vibration;
  $('settings').classList.add('on');
  $('setClose').focus();
}
function closeSettings(): void { $('settings').classList.remove('on'); }

// ---------- wiring ----------
$('rs').addEventListener('click', () => { fb.unlock(); load(level); });
$('homeBtn').addEventListener('click', () => { fb.unlock(); openHome(); });
$('setBtn').addEventListener('click', () => { fb.unlock(); openSettings(); });
$('homeSet').addEventListener('click', () => { fb.unlock(); openSettings(); });
$('playBtn').addEventListener('click', () => { fb.unlock(); closeHome(); if (game.state !== 'play' || level !== save.level) load(save.level); });
$('setClose').addEventListener('click', closeSettings);
$<HTMLInputElement>('optSound').addEventListener('change', e => { save.sound = fb.sound = (e.target as HTMLInputElement).checked; persist(); });
$<HTMLInputElement>('optVib').addEventListener('change', e => { save.vibration = fb.vibration = (e.target as HTMLInputElement).checked; persist(); });
$('langTr').addEventListener('click', () => setLanguage('tr'));
$('langEn').addEventListener('click', () => setLanguage('en'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

renderer.onLand = c => game.charmLanded(c);
attachInput(cv, () => game, renderer, fb);

fb.sound = save.sound;
fb.vibration = save.vibration;
setLang(save.lang);
load(level);
applyTexts();
// First launch goes straight into level 1; later launches open the home screen.
if (save.seenHome) openHome();
else { save.seenHome = true; persist(); }

let last = performance.now();
const t0 = last;
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  renderer.update(dt);
  renderer.draw(game, (now - t0) / 1000, game.state === 'play');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
