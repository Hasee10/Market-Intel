import { describe, it, expect, vi, afterEach } from 'vitest';
import { relativeTime, NOTIFICATION_TYPE_DOT, NOTIFICATION_TYPE_LABEL } from './relative-time';

// Frozen clock: every assertion below is relative to "now", so a real clock
// makes the boundary cases (59m vs 60m) flake depending on execution speed.
const NOW = new Date('2026-09-02T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  afterEach(() => vi.useRealTimers());

  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return relativeTime(iso);
  };

  it('collapses anything under a minute to "just now"', () => {
    expect(at(ago(0))).toBe('just now');
    expect(at(ago(20 * 1000))).toBe('just now');
  });

  it('reports minutes, then hours, then days', () => {
    expect(at(ago(5 * MINUTE))).toBe('5m ago');
    expect(at(ago(3 * HOUR))).toBe('3h ago');
    expect(at(ago(2 * DAY))).toBe('2d ago');
  });

  // The Watchlist case this helper exists for: low-stock re-alerts fire at
  // most once a day per product, so consecutive alerts about the same
  // product must render as distinguishably different ages.
  it('distinguishes daily re-alerts about the same product', () => {
    expect(at(ago(1 * DAY))).toBe('1d ago');
    expect(at(ago(2 * DAY))).toBe('2d ago');
    expect(at(ago(3 * DAY))).toBe('3d ago');
  });

  it('returns an empty string for an unparseable date rather than "NaN ago"', () => {
    expect(at('not a date')).toBe('');
    expect(at('')).toBe('');
  });
});

describe('notification type maps', () => {
  it('covers every NotificationType with both a dot colour and a label', () => {
    // Mirrors NotificationType in lib/notifications/notify.ts - a new type
    // added there without a colour here renders as an unlabelled grey dot.
    for (const type of ['price_alert', 'low_stock', 'churn_risk']) {
      expect(NOTIFICATION_TYPE_DOT[type]).toBeTruthy();
      expect(NOTIFICATION_TYPE_LABEL[type]).toBeTruthy();
    }
  });

  it('separates the seller\'s own stock from a competitor\'s price, which share one feed', () => {
    expect(NOTIFICATION_TYPE_LABEL.low_stock).not.toBe(NOTIFICATION_TYPE_LABEL.price_alert);
    expect(NOTIFICATION_TYPE_DOT.low_stock).not.toBe(NOTIFICATION_TYPE_DOT.price_alert);
  });
});
