// Apple's own "rate this app" sheet, asked only at happy moments and rarely (iOS also limits it to 3 times a year).
import { isNative } from './native';

const KEY = 'charm.review';
/** Level numbers (1-based, just won) after which we may ask. */
export const REVIEW_AT = [15, 40, 90, 200];
const GAP_DAYS = 45;

export function reviewDue(levelWon: number, streak: number, now: number, raw: string | null): boolean {
  if (!REVIEW_AT.includes(levelWon) || streak < 2) return false;
  let st = { n: 0, last: 0 };
  try { if (raw) st = { ...st, ...JSON.parse(raw) }; } catch { /* fresh */ }
  return st.n < 3 && now - st.last > GAP_DAYS * 86400000;
}

export async function maybeAskReview(levelWon: number, streak: number): Promise<void> {
  if (!isNative()) return;
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* ignore */ }
  const now = Date.now();
  if (!reviewDue(levelWon, streak, now, raw)) return;
  try {
    const n = raw ? (JSON.parse(raw).n ?? 0) + 1 : 1;
    localStorage.setItem(KEY, JSON.stringify({ n, last: now }));
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
  } catch { /* not available: ignore */ }
}
