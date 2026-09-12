import { describe, it, expect } from 'vitest';
import { convertCurrency } from './fx';

describe('convertCurrency', () => {
  const rates = { USD: 1, PKR: 280, EUR: 0.9 };

  it('converts between two non-USD currencies via the USD pivot', () => {
    expect(convertCurrency(2800, 'PKR', 'USD', rates)).toBe(10);
    expect(convertCurrency(10, 'USD', 'PKR', rates)).toBe(2800);
    expect(convertCurrency(9, 'EUR', 'USD', rates)).toBe(10);
  });

  it('returns the amount unchanged when from and to are the same, even with no rates loaded', () => {
    // Short-circuits before touching `rates` at all - every amount on a
    // page where the seller's currency matches their own reporting
    // currency must never be affected by a missing/incomplete fx_rates
    // snapshot.
    expect(convertCurrency(500, 'PKR', 'PKR', {})).toBe(500);
  });

  it('falls back to the original amount when the source rate is missing', () => {
    expect(convertCurrency(100, 'XYZ', 'USD', rates)).toBe(100);
  });

  it('falls back to the original amount when the target rate is missing', () => {
    expect(convertCurrency(100, 'USD', 'XYZ', rates)).toBe(100);
  });

  it('treats a stored rate of 0 as missing rather than dividing by it', () => {
    // A 0 rate would otherwise produce Infinity/NaN through the USD-pivot
    // division - falling back to the unconverted amount is what keeps a
    // corrupt fx_rates row from poisoning every amount on the dashboard.
    expect(convertCurrency(100, 'PKR', 'USD', { USD: 1, PKR: 0 })).toBe(100);
    expect(convertCurrency(100, 'USD', 'PKR', { USD: 0, PKR: 280 })).toBe(100);
  });
});
