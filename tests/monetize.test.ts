import { describe, expect, it } from 'vitest';
import { defaultSave } from '../src/services/save';
import { AD_EVERY_LEVELS, AD_FREE_MINUTES, AD_MIN_GAP_S, PRODUCTS, canBuy, grant, interstitialDue } from '../src/services/monetize';

const ready = () => ({ ...defaultSave('tr'), playTime: AD_FREE_MINUTES * 60, levelsSinceAd: AD_EVERY_LEVELS });

describe('interstitial rules', () => {
  it('never in the first minutes of play', () => {
    expect(interstitialDue({ ...ready(), playTime: AD_FREE_MINUTES * 60 - 1 }, 1e6, -1e9, false)).toBe(false);
  });
  it('only every few levels and not too often', () => {
    expect(interstitialDue(ready(), 1e6, -1e9, false)).toBe(true);
    expect(interstitialDue({ ...ready(), levelsSinceAd: AD_EVERY_LEVELS - 1 }, 1e6, -1e9, false)).toBe(false);
    expect(interstitialDue(ready(), 1000, 1000 - AD_MIN_GAP_S + 1, false)).toBe(false);
  });
  it('never right after declining the 2× reward', () => expect(interstitialDue(ready(), 1e6, -1e9, true)).toBe(false));
  it('never for anyone who bought something', () => expect(interstitialDue({ ...ready(), paid: true }, 1e6, -1e9, false)).toBe(false));
});

describe('purchases', () => {
  it('grants coins and boosters, removes forced ads, one-time packs only once', () => {
    const s = defaultSave('tr');
    const starter = PRODUCTS.find(p => p.id === 'starter')!;
    grant(s, starter);
    expect(s.coins).toBe(starter.coins);
    expect(s.boosters.magnet).toBe(2 + 3);
    expect(s.paid).toBe(true);
    expect(canBuy(s, starter)).toBe(false);
    expect(canBuy(s, PRODUCTS.find(p => p.id === 'coins_m')!)).toBe(true);
  });
  it('No Ads sets the flag', () => {
    const s = defaultSave('tr');
    grant(s, PRODUCTS.find(p => p.id === 'noads')!);
    expect(s.noAds).toBe(true);
  });
});
