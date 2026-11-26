// Real in-app purchases on iPhone (StoreKit 2 through @capgo/native-purchases).
// Product IDs in App Store Connect: com.mucahitkurkaya.charmlet.<id>. "noads" is Non-Consumable, the rest Consumable
// ("starter" is limited to one purchase by the game itself).
import type { IAPService, Product, ProductId } from '../services/monetize';
import { PRODUCTS } from '../services/monetize';

export const STORE_PREFIX = 'com.mucahitkurkaya.charmlet.';
const GRANTED_KEY = 'charm.iap.tx';

export const storeId = (id: ProductId): string => STORE_PREFIX + id;
export const gameId = (storeIdentifier: string): ProductId | null => {
  const id = storeIdentifier.startsWith(STORE_PREFIX) ? storeIdentifier.slice(STORE_PREFIX.length) : '';
  return (PRODUCTS.some(p => p.id === id) ? id : null) as ProductId | null;
};

/** Transaction ids already turned into coins, so a purchase is never granted twice. */
export class GrantedLog {
  private ids: string[];
  constructor(private store: Pick<Storage, 'getItem' | 'setItem'> | null) {
    let v: unknown = [];
    try { v = JSON.parse(store?.getItem(GRANTED_KEY) ?? '[]'); } catch { /* fresh */ }
    this.ids = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  }
  has(id: string): boolean { return this.ids.includes(id); }
  add(id: string): void {
    if (!id || this.has(id)) return;
    this.ids.push(id);
    if (this.ids.length > 300) this.ids = this.ids.slice(-300);
    try { this.store?.setItem(GRANTED_KEY, JSON.stringify(this.ids)); } catch { /* ignore */ }
  }
}

export class StoreIAP implements IAPService {
  private prices = new Map<ProductId, string>();
  /** true once the App Store has answered with our products (agreement active, products set up) */
  get ready(): boolean { return this.prices.size > 0; }
  /** last purchase was cancelled by the player (no error message then) */
  cancelled = false;
  private pending: ProductId | null = null;
  private log = new GrantedLog(typeof localStorage === 'undefined' ? null : localStorage);
  /** last failure reason (not shown to players; sent to analytics) */
  lastError = '';

  /** onLateGrant: a purchase finished outside buy() (approved later by a parent, interrupted, etc.). */
  constructor(private onLateGrant: (p: Product) => void) {}

  async start(): Promise<void> {
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      const { products } = await NativePurchases.getProducts({ productIdentifiers: PRODUCTS.map(p => storeId(p.id)), productType: PURCHASE_TYPE.INAPP });
      for (const pr of products) { const id = gameId(pr.identifier); if (id && pr.priceString) this.prices.set(id, pr.priceString); }
      await NativePurchases.addListener('transactionUpdated', tx => {
        const id = gameId(tx.productIdentifier);
        if (!id || this.pending === id || this.log.has(tx.transactionId)) return;
        this.log.add(tx.transactionId);
        const p = PRODUCTS.find(x => x.id === id);
        if (p) this.onLateGrant(p);
      });
    } catch (e) { this.lastError = String((e as Error)?.message ?? e); }
  }

  /** The store's price in the player's currency (falls back to the dollar price until the store answers). */
  price(p: Product): string { return this.prices.get(p.id) ?? p.price; }

  async buy(p: Product): Promise<boolean> {
    if (this.pending) return false;
    this.pending = p.id;
    this.cancelled = false;
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      const tx = await NativePurchases.purchaseProduct({
        productIdentifier: storeId(p.id), productType: PURCHASE_TYPE.INAPP, quantity: 1, isConsumable: p.id !== 'noads',
      });
      if (!tx?.transactionId || this.log.has(tx.transactionId)) return false;
      this.log.add(tx.transactionId);
      return true;
    } catch (e) {
      this.lastError = String((e as Error)?.message ?? e);
      this.cancelled = /cancel/i.test(this.lastError);
      return false;
    } finally { this.pending = null; }
  }

  async restore(): Promise<ProductId[]> {
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      await NativePurchases.restorePurchases();
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      const ids = purchases.filter(x => !x.revocationDate).map(x => gameId(x.productIdentifier)).filter((x): x is ProductId => !!x);
      return [...new Set(ids)].filter(id => PRODUCTS.find(p => p.id === id)?.noAds);
    } catch (e) { this.lastError = String((e as Error)?.message ?? e); return []; }
  }
}
