'server-only';

import { createClient } from '@/lib/supabase/server';

// fx_rates (017_fx_rates_and_reporting_currency.sql) stores every currency's
// rate as "1 unit of currency = rate_to_pkr PKR", refreshed daily. PKR is the
// pivot rather than storing every currency pair directly, since every
// scraper's native currency is PKR (see getCategoryPricing/product-matching)
// - a pivot table avoids needing n^2 pairs for n currencies.
export type FxRates = Map<string, number>;

export async function getLatestFxRates(): Promise<FxRates> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('fx_rates')
    .select('currency, rate_to_pkr, as_of')
    .order('as_of', { ascending: false });

  const rates: FxRates = new Map([['PKR', 1]]);
  if (error || !data) return rates;

  // Rows are ordered newest-first, so the first row seen per currency is its
  // latest rate - skip any currency already set.
  for (const row of data) {
    if (rates.has(row.currency)) continue;
    rates.set(row.currency, Number(row.rate_to_pkr));
  }

  return rates;
}

// Converts an amount between two currencies via the PKR pivot. Falls back to
// a 1:1 rate for any currency missing from `rates` (e.g. fx_rates hasn't
// been backfilled for it yet) rather than throwing - a directional price
// signal off by a missing rate is still more useful than none.
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, rates: FxRates): number {
  if (fromCurrency === toCurrency) return amount;

  const fromRate = rates.get(fromCurrency) ?? 1;
  const toRate = rates.get(toCurrency) ?? 1;

  const amountInPkr = amount * fromRate;
  return amountInPkr / toRate;
}
