import { describe, expect, it } from 'vitest';
import { REVIEW_AT, reviewDue } from '../src/native/review';
import { track } from '../src/services/analytics';

const DAY = 86400000;
describe('rate-the-app prompt', () => {
  it('only at milestone wins with a streak', () => {
    expect(reviewDue(REVIEW_AT[0], 3, Date.now(), null)).toBe(true);
    expect(reviewDue(REVIEW_AT[0] + 1, 3, Date.now(), null)).toBe(false);
    expect(reviewDue(REVIEW_AT[0], 1, Date.now(), null)).toBe(false);
  });
  it('waits 45 days between asks and stops after 3', () => {
    const now = 100 * DAY;
    expect(reviewDue(40, 5, now, JSON.stringify({ n: 1, last: now - 10 * DAY }))).toBe(false);
    expect(reviewDue(40, 5, now, JSON.stringify({ n: 1, last: now - 50 * DAY }))).toBe(true);
    expect(reviewDue(40, 5, now, JSON.stringify({ n: 3, last: 0 }))).toBe(false);
    expect(reviewDue(40, 5, now, '{broken')).toBe(true);
  });
});
describe('analytics', () => {
  it('is a no-op without a key and never throws', () => expect(() => track('x', { a: 1 })).not.toThrow());
});
