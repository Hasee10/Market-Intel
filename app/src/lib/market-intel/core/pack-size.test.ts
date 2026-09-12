import { describe, it, expect } from 'vitest';

import { hasMixedPackSizes, parsePackSize, unitPrice } from './pack-size';

// Every title below is a real one - from the seller catalogue or from
// scraped listings seen in the Competitors drawer. The false positives are
// the point of this suite: a wrong quantity divides a price by a number it
// should not be divided by, which is worse than not normalising at all.

describe('parsePackSize', () => {
  describe('real multipacks', () => {
    const cases: [string, number][] = [
      ['H&M Cotton Crew Neck T-Shirt - Pack of 3', 3],
      ['Pampers Premium Care Diapers Size 3 - Pack of 50', 50],
      ['Dog Chew Toy Bundle - Set of 5', 5],
      ['C6 H4 LED Headlight Bulbs - 2pcs Car Set', 2],
      ['Homestead Ceramic Dinner Set 32pc', 32],
      ['Anchor 5-Piece Stainless Steel Cutlery Set', 5],
      ['Hot Wheels 5-Car Pack', 5],
      ['Gillette Mach3 Razor with 2 Cartridges - Pack of 4', 4],
      ['Socks 12 Pack', 12],
      ['Storage Boxes, Set of 6', 6],
    ];

    it.each(cases)('reads %s as %i', (title, expected) => {
      const result = parsePackSize(title);
      expect(result.units).toBe(expected);
      expect(result.detected).toBe(true);
    });
  });

  describe('the garment trap', () => {
    // In Pakistani fashion "3 piece" is a construction - shirt, trouser,
    // dupatta - and the listing is ONE outfit. Dividing by three here is
    // the specific bug this module was written to avoid.
    const garments = [
      'Khaadi Unstitched Lawn 3 Piece Suit',
      '3 Piece - Printed Lawn Suit',
      'Bonanza Satrangi Embroidered 2 Piece Kurti',
      'Gul Ahmed 3 Pc Unstitched Lawn Dress',
      'Ladies 2 Piece Shalwar Kameez',
    ];

    it.each(garments)('reads %s as a single item', (title) => {
      const result = parsePackSize(title);
      expect(result.units).toBe(1);
      expect(result.detected).toBe(false);
    });

    it('still honours an explicit pack on a garment', () => {
      // "Pack of 3" is unambiguous even on a suit - the container word is
      // what distinguishes it from the construction sense.
      expect(parsePackSize('Lawn Suit Dupatta - Pack of 3').units).toBe(3);
    });
  });

  describe('numbers that are not quantities', () => {
    const notQuantities = [
      'Samsung Galaxy A15 128GB',
      'Xiaomi Redmi Note 13 8/256GB',
      'Philips Car LED Headlight Bulb H4',
      'Gillette Mach3 Razor',
      'Anker 20W USB-C Fast Charger',
      'Michelin Car Tyre 175/65 R14',
      'Baseus 10000mAh Power Bank',
      'Pampers Diapers Size 3',
      'Tefal Steam Iron FV1713',
      '3 in 1 Multifunction Charging Cable',
      'Capra Canbus H4 LED Headlight Bulbs - 200W 20000LM',
    ];

    it.each(notQuantities)('does not read a quantity out of %s', (title) => {
      expect(parsePackSize(title).units).toBe(1);
    });
  });

  describe('guards', () => {
    it('ignores a quantity of one - it is the default and not a multipack', () => {
      expect(parsePackSize('T-Shirt Pack of 1').detected).toBe(false);
    });

    it('ignores implausibly large counts, which are specs mis-read as counts', () => {
      // 20000LM is a lumen rating; a listing is not 20,000 headlights.
      expect(parsePackSize('LED Bulbs 20000 pcs').units).toBe(1);
    });

    it('handles an empty or whitespace title', () => {
      expect(parsePackSize('').units).toBe(1);
      expect(parsePackSize('   ').units).toBe(1);
    });

    it('distinguishes a known single from an assumed one', () => {
      // Both are 1, but only one of them is a fact.
      expect(parsePackSize('Crew Neck T-Shirt').detected).toBe(false);
      expect(parsePackSize('Crew Neck T-Shirt Pack of 3').detected).toBe(true);
    });
  });
});

describe('unitPrice', () => {
  it('divides a multipack price by its count', () => {
    expect(unitPrice(3299, 'H&M Cotton Crew Neck T-Shirt - Pack of 3')).toBeCloseTo(1099.67, 1);
  });

  it('leaves a single item price alone', () => {
    expect(unitPrice(890, 'Crew Neck T-Shirt')).toBe(890);
  });

  it('does not divide a garment "3 piece" price', () => {
    expect(unitPrice(5499, 'Khaadi Unstitched Lawn 3 Piece Suit')).toBe(5499);
  });

  it('keeps a null price null rather than collapsing it to zero', () => {
    expect(unitPrice(null, 'Pack of 3')).toBeNull();
  });
});

describe('hasMixedPackSizes', () => {
  it('is true when a multipack is compared against singles', () => {
    // The exact situation that produced a wrong "164% above the median".
    expect(
      hasMixedPackSizes([
        'H&M Cotton Crew Neck T-Shirt - Pack of 3',
        'Crew Neck T-Shirt',
        'Basic Crew-Neck T-Shirt',
      ]),
    ).toBe(true);
  });

  it('is false when everything is a single item', () => {
    expect(hasMixedPackSizes(['Crew Neck T-Shirt', 'Basic Crew-Neck T-Shirt'])).toBe(false);
  });

  it('is false when every listing is the same size pack', () => {
    expect(hasMixedPackSizes(['Socks Pack of 3', 'Socks - Pack of 3'])).toBe(false);
  });

  it('is false for garments that all say "3 piece"', () => {
    // They all parse to 1, so there is nothing mixed and no warning.
    expect(
      hasMixedPackSizes(['Khaadi Lawn 3 Piece Suit', '3 Piece - Printed Lawn Suit']),
    ).toBe(false);
  });
});
