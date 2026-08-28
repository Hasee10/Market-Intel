import { describe, it, expect } from 'vitest';
import { tokenize, jaccard } from './similarity';

describe('tokenize', () => {
  it('treats a plural and its singular as the same token', () => {
    expect(jaccard(tokenize('Laptops'), tokenize('Laptop'))).toBe(1);
    expect(jaccard(tokenize('HP Laptop Core i5'), tokenize('Laptops'))).toBeGreaterThan(0);
  });

  it('does not mangle a short word ending in s or a double-s word', () => {
    expect(tokenize('Gas Stove')).toContain('gas');
    expect(tokenize('Sunglasses')).toContain('sunglass');
  });
});
