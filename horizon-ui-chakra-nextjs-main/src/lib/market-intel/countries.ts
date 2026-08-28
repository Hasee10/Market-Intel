// Country metadata for the seller product catalogue - lets the app stop
// forcing fields a seller's market doesn't use (ROADMAP: country-aware
// product catalogue, migration 027) without a rearchitecture. This is
// deliberately a small, pure config module: no DB table, no admin UI,
// callable from both server and client code.

// ISO 3166-1 alpha-2, mirroring SUPPORTED_CURRENCIES's shape in
// src/types/products.ts. Short list on purpose - only the markets this
// product actually has sellers or credible near-term expansion in. Add to
// this as real sellers show up in a new country, not speculatively.
export const SUPPORTED_COUNTRIES = [
  { code: 'PK', label: 'Pakistan' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'IN', label: 'India' },
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code'];

export interface CountryProductConfig {
  /** Whether the CSV bulk-import / product forms should require a SKU. */
  skuRequired: boolean;
}

// Every country defaults to skuRequired: false. There is no real basis
// today to mandate a SKU for any specific market - inventing one here
// would be exactly the kind of unjustified requirement this config exists
// to prevent. The value of this module is the mechanism (a single lookup
// call sites can depend on), not a specific set of asserted national
// rules: tightening a given country's requirements later, once there's an
// actual reason to, is a one-line change here, not new infrastructure.
const COUNTRY_PRODUCT_CONFIG: Record<string, CountryProductConfig> = {};

const DEFAULT_PRODUCT_CONFIG: CountryProductConfig = { skuRequired: false };

export function getCountryProductConfig(country: string | null | undefined): CountryProductConfig {
  if (!country) return DEFAULT_PRODUCT_CONFIG;
  return COUNTRY_PRODUCT_CONFIG[country] ?? DEFAULT_PRODUCT_CONFIG;
}
