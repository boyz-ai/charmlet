import './style.css';
import { Game } from './core/game';
import { Renderer } from './render/renderer';
import { attachInput } from './input/input';
import { FeedbackManager } from './feedback/feedback';
import { HINTS_TR, LAYOUTS, LEVELS, ROLE_NAMES_TR } from './levels/levels';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('c');
const fb = new FeedbackManager();
const renderer = new Renderer(cv);

let level = 0, streak = 0, failedOnce = false;
let game!: Game;

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
  $('lv').textContent = `Seviye ${n + 1} / ${LEVELS.length} · ${ROLE_NAMES_TR[spec.role] ?? spec.role}`;
  $('hint').textContent = HINTS_TR[spec.role] ?? '';
  hideOverlay();
  hud();
}

function hud(): void { $('mv').textContent = String(game.moves); $('st').textContent = String(streak); }

function onWin(): void {
  fb.win();
  if (!failedOnce) streak++;
  hud();
  const last = level === LEVELS.length - 1;
  show('Bileklik çözüldü!',
    (failedOnce ? '' : `Seri: ${streak}. `) + (last ? 'Tüm seviyeleri bitirdin!' : 'Sıradaki bileklik hazır.'),
    last ? 'Baştan oyna' : 'Sonraki seviye', () => load(last ? 0 : level + 1));
}

function onLose(reason: 'tray' | 'moves'): void {
  fb.lose();
  failedOnce = true;
  const retry = (): void => { streak = 0; load(level, true); };
  if (reason === 'tray') {
    show('Tepsi doldu', 'Aynı renkleri arka arkaya çıkarmayı dene.', 'Tekrar dene', retry);
  } else {
    const left = game.rings.filter(r => !r.gone).length;
    show('Hamlen bitti', `${streak > 0 ? `Serin (${streak}) yanacak! ` : ''}Az kaldı: ${left} halka kaldı!`,
      '+3 hamle (deneme)', () => { game.addMoves(3); hideOverlay(); },
      'Tekrar dene', retry);
  }
}

function show(title: string, text: string, b1: string, f1: () => void, b2?: string, f2?: () => void): void {
  $('ot').textContent = title; $('op').textContent = text;
  const o1 = $('ob'), o2 = $('ob2');
  o1.textContent = b1; o1.onclick = () => { fb.unlock(); f1(); hud(); };
  o2.style.display = b2 ? '' : 'none';
  if (b2 && f2) { o2.textContent = b2; o2.onclick = () => { fb.unlock(); f2(); hud(); }; }
  $('ov').classList.add('on');
}
function hideOverlay(): void { $('ov').classList.remove('on'); }

$('rs').addEventListener('click', () => { fb.unlock(); load(level); });
renderer.onLand = c => game.charmLanded(c);
attachInput(cv, () => game, renderer, fb);

let last = performance.now();
const t0 = last;
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  renderer.update(dt);
  renderer.draw(game, (now - t0) / 1000, game.state === 'play');
  requestAnimationFrame(frame);
}
load(0);
requestAnimationFrame(frame);
