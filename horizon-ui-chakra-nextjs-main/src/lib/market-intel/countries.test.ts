import { describe, it, expect } from 'vitest';
import { getCountryProductConfig, SUPPORTED_COUNTRIES } from './countries';

describe('getCountryProductConfig', () => {
  it('defaults every known country to skuRequired: false - no market is assumed to need one without a real reason', () => {
    for (const { code } of SUPPORTED_COUNTRIES) {
      expect(getCountryProductConfig(code).skuRequired).toBe(false);
    }
  });

  it('falls back to the same default for an unrecognised country code, never throws', () => {
    expect(getCountryProductConfig('ZZ')).toEqual({ skuRequired: false });
  });

  it('falls back to the same default for null/undefined - a seller onboarded before this feature shipped', () => {
    expect(getCountryProductConfig(null)).toEqual({ skuRequired: false });
    expect(getCountryProductConfig(undefined)).toEqual({ skuRequired: false });
  });
});
