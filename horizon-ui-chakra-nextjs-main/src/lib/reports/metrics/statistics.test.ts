import { describe, it, expect } from 'vitest';
import { median } from './statistics';

describe('median', () => {
  it('returns null for an empty list', () => {
    expect(median([])).toBeNull();
  });

  it('handles odd-length lists', () => {
    expect(median([1, 3, 2])).toBe(2);
  });

  it('averages the two middle values for even-length lists', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  // Reproduces a real bug found by inspecting a seller's actual downloaded
  // report: a catalogue mixing a Rs 12 accessory with a Rs 1,800,000 item
  // produced a "price index" of 2758 against a Rs 13,449 category median -
  // an implausible number that made the whole report look broken. It
  // wasn't a calculation bug, it was a mean being used where a median
  // belongs (a single outlier drags a mean; a median resists it). This
  // guards the fix at its source: collectors/revenue-and-products.ts now
  // calls median(), not a reduce-and-divide mean, over active product
  // prices - see the price-index math below for the actual before/after.
  it('resists a single extreme outlier the way a mean cannot - the real "tt" catalogue', () => {
    // Approximate PKR-converted prices for the real catalogue (Socks, Fuel
    // Injectors in EUR, Pepsi, Laptops, an RTX 4070 Ti in USD, and a
    // Rs 1,800,000 "1600 cc" item) - exact FX-converted figures vary with
    // live rates, but the shape (five ordinary prices plus one extreme
    // outlier) is what actually shipped in a seller's downloaded report.
    const pricesInPkr = [12, 46, 140, 88000, 336000, 1800000];
    const mean = pricesInPkr.reduce((sum, v) => sum + v, 0) / pricesInPkr.length;
    const med = median(pricesInPkr)!;

    // The mean is dragged far above every "normal" item in the catalogue -
    // this is what produced a Rs 370,945 "your price" and a 2758% price
    // index in the real, live-generated report.
    expect(mean).toBeGreaterThan(370000);

    // The median lands on the midpoint of the sorted list (between Pepsi
    // at 140 and Laptops at 88000) - nowhere near the 1,800,000 outlier,
    // unlike the mean above.
    expect(med).toBeGreaterThan(140);
    expect(med).toBeLessThan(88000);

    const categoryMedian = 13449; // this seller's real tracked category median, from the same report
    const priceIndexFromMean = (mean / categoryMedian) * 100;
    const priceIndexFromMedian = (med / categoryMedian) * 100;

    expect(priceIndexFromMean).toBeGreaterThan(2000); // the mean-based calc produces exactly the implausible class of number the seller saw
    expect(priceIndexFromMedian).toBeLessThan(500); // the median-based calc stays in a defensible range for a premium-leaning catalogue
  });
});
