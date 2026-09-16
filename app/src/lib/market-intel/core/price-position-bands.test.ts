import { describe, it, expect } from 'vitest';

import {
  classifyPortfolio,
  classifyPricePosition,
  summarisePortfolioBands,
  type PortfolioProduct,
} from './price-position-bands';

function product(overrides: Partial<PortfolioProduct> = {}): PortfolioProduct {
  return {
    sellerProductId: Math.random().toString(36).slice(2),
    title: 'Product',
    categorySlug: 'category',
    categoryName: 'Category',
    price: 1000,
    categoryMedian: 1000,
    perUnit: false,
    ...overrides,
  };
}

describe('classifyPricePosition', () => {
  it('calls exactly at the median at-market', () => {
    expect(classifyPricePosition(0)).toBe('at-market');
  });

  it('is at-market within the 5% tolerance either side, matching the price-position panel', () => {
    expect(classifyPricePosition(0.049)).toBe('at-market');
    expect(classifyPricePosition(-0.049)).toBe('at-market');
  });

  it('crosses into above/below just past 5%', () => {
    expect(classifyPricePosition(0.051)).toBe('above');
    expect(classifyPricePosition(-0.051)).toBe('below');
  });

  it('crosses into far-above/far-below at 25%', () => {
    expect(classifyPricePosition(0.25)).toBe('far-above');
    expect(classifyPricePosition(0.249)).toBe('above');
    expect(classifyPricePosition(-0.25)).toBe('far-below');
    expect(classifyPricePosition(-0.249)).toBe('below');
  });
});

describe('classifyPortfolio', () => {
  it('computes a signed percentage against each product own category median', () => {
    const result = classifyPortfolio([product({ price: 1300, categoryMedian: 1000 })]);
    expect(result[0].pctVsMedian).toBeCloseTo(0.3, 5);
    expect(result[0].band).toBe('far-above');
  });

  it('drops products with no usable category median rather than dividing by zero', () => {
    const result = classifyPortfolio([
      product({ categoryMedian: 0 }),
      product({ price: 1200, categoryMedian: 1000 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(1200);
  });
});

describe('summarisePortfolioBands', () => {
  it('groups into all five bands even when some are empty', () => {
    const classified = classifyPortfolio([product({ price: 1000, categoryMedian: 1000 })]);
    const summary = summarisePortfolioBands(classified);

    expect(summary.map((b) => b.band)).toEqual(['far-above', 'above', 'at-market', 'below', 'far-below']);
    expect(summary.find((b) => b.band === 'at-market')?.count).toBe(1);
    expect(summary.find((b) => b.band === 'far-above')?.count).toBe(0);
  });

  it('orders products within a band by distance from the median, furthest first', () => {
    const classified = classifyPortfolio([
      product({ title: 'mild', price: 1060, categoryMedian: 1000 }), // +6%
      product({ title: 'extreme', price: 1200, categoryMedian: 1000 }), // +20%
    ]);
    const above = summarisePortfolioBands(classified).find((b) => b.band === 'above');

    expect(above?.products.map((p) => p.title)).toEqual(['extreme', 'mild']);
  });

  it('surfaces the finding the whole panel exists for: several products far above market', () => {
    const classified = classifyPortfolio([
      product({ title: 'a', price: 1400, categoryMedian: 1000 }),
      product({ title: 'b', price: 1500, categoryMedian: 1000 }),
      product({ title: 'c', price: 990, categoryMedian: 1000 }),
    ]);
    const summary = summarisePortfolioBands(classified);

    expect(summary.find((b) => b.band === 'far-above')?.count).toBe(2);
    expect(summary.find((b) => b.band === 'at-market')?.count).toBe(1);
  });
});
