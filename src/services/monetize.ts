// Ads + in-app purchases behind small interfaces. The web build uses TEST implementations
// (nothing is charged, no real ads). M6 swaps in AdMob (rewarded + interstitial) and StoreKit / Play Billing.
import type { SaveData } from './save';
import type { Booster } from '../meta/meta';

// ---------- ads ----------
export type RewardPlacement = 'continue' | 'double';
export interface AdService {
  /** Show a rewarded video. Resolves true only if the player watched it to the end. */
  showRewarded(placement: RewardPlacement): Promise<boolean>;
  showInterstitial(): Promise<void>;
  /** A rewarded video is loaded and can be shown now (offer "watch an ad" buttons only then). */
  rewardedReady(): boolean;
}

/** Interstitial rules (GDD): never in the first 10 minutes, then at most every 2 levels and 90 s,
 *  only at a natural break (after a win), never right after the player declined the 2× reward,
 *  and never again for anyone who bought anything. */
export const AD_FREE_MINUTES = 10;
export const AD_EVERY_LEVELS = 2;
export const AD_MIN_GAP_S = 90;
export function interstitialDue(s: SaveData, nowS: number, lastAdS: number, declinedDouble: boolean): boolean {
  if (s.paid || declinedDouble) return false;
  if (s.playTime < AD_FREE_MINUTES * 60) return false;
  if (s.levelsSinceAd < AD_EVERY_LEVELS) return false;
  return nowS - lastAdS >= AD_MIN_GAP_S;
}

// ---------- in-app purchases ----------
export type ProductId = 'starter' | 'noads' | 'coins_m' | 'coins_l' | 'coins_xl';
export interface Product {
  id: ProductId;
  /** fallback price; the store's localized price replaces it in M6 */
  price: string;
  coins: number;
  boosters?: Partial<Record<Booster, number>>;
  noAds?: boolean;
  /** can be bought only once */
  once?: boolean;
}
export const PRODUCTS: Product[] = [
  { id: 'starter', price: '$2.99', coins: 600, boosters: { hint: 3, undo: 3, slot: 3, magnet: 3 }, once: true },
  { id: 'noads', price: '$4.99', coins: 300, noAds: true, once: true },
  { id: 'coins_m', price: '$9.99', coins: 2500 },
  { id: 'coins_l', price: '$19.99', coins: 6000, boosters: { hint: 5, magnet: 5 } },
  { id: 'coins_xl', price: '$49.99', coins: 18000, boosters: { hint: 10, undo: 10, slot: 10, magnet: 10 } },
];
export interface IAPService {
  /** Resolves true when the purchase went through. */
  buy(p: Product): Promise<boolean>;
  /** One-time products the store says this player owns (Apple requires a restore button). */
  restore(): Promise<ProductId[]>;
}

/** Give back one-time entitlements after a reinstall (no coins again: those were spent already). */
export function restoreOwned(s: SaveData, ids: ProductId[]): number {
  let n = 0;
  for (const id of ids) {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p?.once) continue;
    if (!s.owned.includes(id)) { s.owned.push(id); n++; }
    if (p.noAds) s.noAds = true;
    s.paid = true;
  }
  return n;
}

/** Give the player what they bought. Any purchase removes forced ads for good (GDD). */
export function grant(s: SaveData, p: Product): void {
  s.coins += p.coins;
  for (const [b, n] of Object.entries(p.boosters ?? {}) as [Booster, number][]) s.boosters[b] += n;
  if (p.noAds) s.noAds = true;
  s.paid = true;
  if (p.once && !s.owned.includes(p.id)) s.owned.push(p.id);
}
export const canBuy = (s: SaveData, p: Product): boolean => !(p.once && s.owned.includes(p.id));

// ---------- test implementations (web build) ----------
/** A clearly labelled fake ad / purchase dialog so every flow can be tried before the real SDKs exist. */
export class TestDialog {
  constructor(private el: HTMLElement, private t: (k: string, v?: Record<string, string | number>) => string) {}
  private open(html: string): void { this.el.innerHTML = html; this.el.classList.add('on'); }
  private close(): void { this.el.classList.remove('on'); this.el.innerHTML = ''; }
  ad(seconds: number, skippable: boolean): Promise<boolean> {
    return new Promise(res => {
      let left = seconds;
      const render = (): void => this.open(`<h2>${this.t('testAd')}</h2><p>${this.t('testAdText', { n: left })}</p>` +
        (skippable || left <= 0 ? `<button id="tdOk">${left <= 0 ? this.t('close') : this.t('skipAd')}</button>` : ''));
      render();
      const timer = setInterval(() => { left--; render(); bind(); if (left <= 0) clearInterval(timer); }, 1000);
      const bind = (): void => { const b = this.el.querySelector<HTMLButtonElement>('#tdOk'); if (b) b.onclick = () => { clearInterval(timer); this.close(); res(left <= 0); }; };
      bind();
    });
  }
  confirm(title: string, text: string): Promise<boolean> {
    return new Promise(res => {
      this.open(`<h2>${title}</h2><p>${text}</p><button id="tdOk">${this.t('testBuy')}</button><button id="tdNo" class="ghost">${this.t('cancel')}</button>`);
      this.el.querySelector<HTMLButtonElement>('#tdOk')!.onclick = () => { this.close(); res(true); };
      this.el.querySelector<HTMLButtonElement>('#tdNo')!.onclick = () => { this.close(); res(false); };
    });
  }
}
export class TestAds implements AdService {
  constructor(private d: TestDialog) {}
  showRewarded(): Promise<boolean> { return this.d.ad(3, true); }
  async showInterstitial(): Promise<void> { await this.d.ad(3, false); }
  rewardedReady(): boolean { return true; }
}
export class TestIAP implements IAPService {
  /** pretend store account (kept apart from the game save, like a real store would be) */
  private readonly key = 'charm.teststore';
  constructor(private d: TestDialog, private t: (k: string, v?: Record<string, string | number>) => string) {}
  async buy(p: Product): Promise<boolean> {
    const ok = await this.d.confirm(this.t('p.' + p.id), this.t('testBuyText', { price: p.price }));
    if (ok && p.once) try { localStorage.setItem(this.key, JSON.stringify([...new Set([...this.owned(), p.id])])); } catch { /* ignore */ }
    return ok;
  }
  async restore(): Promise<ProductId[]> { return this.owned(); }
  private owned(): ProductId[] { try { return JSON.parse(localStorage.getItem(this.key) ?? '[]') as ProductId[]; } catch { return []; } }
}
