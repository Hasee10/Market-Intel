'server-only';

import { createClient } from '@/lib/supabase/server';

const BASE_CURRENCY = 'USD';

export type FxRates = Record<string, number>;

// Reads today's (or the most recent available) daily snapshot from
// fx_rates, keyed by currency code -> rate relative to USD. Falls back to
// the most recent prior date if today's hasn't been fetched yet (cron runs
// once daily - there's always a gap between midnight and whenever it fires).
export async function getLatestFxRates(): Promise<FxRates> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('fx_rates')
    .select('quote_currency, rate, rate_date')
    .eq('base_currency', BASE_CURRENCY)
    .order('rate_date', { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) return { [BASE_CURRENCY]: 1 };

  const latestDate = data[0].rate_date;
  const rates: FxRates = { [BASE_CURRENCY]: 1 };
  for (const row of data) {
    if (row.rate_date === latestDate) rates[row.quote_currency] = Number(row.rate);
  }
  return rates;
}

// Converts an amount from one currency to another via USD as a pivot
// (avoids needing every currency-pair combination stored directly - just
// each currency's rate against USD). Returns the original amount unconverted
// if a needed rate is missing, rather than throwing - a stale/missing FX
// snapshot shouldn't break the whole dashboard, it should just be slightly
// wrong until the next cron run fills it in.
export function convertCurrency(amount: number, from: string, to: string, rates: FxRates): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return amount;
  const amountInUsd = amount / fromRate;
  return amountInUsd * toRate;
}
