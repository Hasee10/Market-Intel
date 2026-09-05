'server-only';

import { createAdminClient } from '@/lib/supabase/server';
import { SUPPORTED_CURRENCIES } from '@/types/products';

const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';

export type FxJobResult = {
  ratesStored: number;
  rateDate: string;
};

// Refreshes the daily fx_rates snapshot used to convert seller amounts
// (orders/products/customers, each potentially in a different currency)
// into one consistent number before aggregating on the dashboard and in the
// PPTX report. open.er-api.com is free, keyless, and covers every currency
// in SUPPORTED_CURRENCIES - no account/API key to provision.
export async function refreshFxRates(): Promise<FxJobResult> {
  const res = await fetch(FX_API_URL);
  if (!res.ok) {
    throw new Error(`FX rate fetch failed: ${res.status} ${await res.text()}`);
  }

  const payload = await res.json();
  if (payload.result !== 'success' || !payload.rates) {
    throw new Error(`FX rate API returned an unexpected payload: ${JSON.stringify(payload).slice(0, 200)}`);
  }

  const rateDate = new Date().toISOString().slice(0, 10);
  const rows = SUPPORTED_CURRENCIES.filter((c) => c.code !== 'USD')
    .map((c) => ({
      base_currency: 'USD',
      // Widened to string on purpose: the filter above narrows c.code to the
      // non-USD currencies, which would make the explicit USD/USD row pushed
      // below un-assignable to the inferred element type. TS 4.9 didn't infer
      // this narrowly; TS 5 does.
      quote_currency: c.code as string,
      rate: payload.rates[c.code],
      rate_date: rateDate,
    }))
    .filter((row) => typeof row.rate === 'number');

  // USD/USD is always 1 - stored explicitly so lookups don't need a special
  // case for "converting from/to the base currency".
  rows.push({ base_currency: 'USD', quote_currency: 'USD', rate: 1, rate_date: rateDate });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('fx_rates')
    .upsert(rows, { onConflict: 'base_currency,quote_currency,rate_date' });

  if (error) throw new Error(`Failed to write fx_rates: ${error.message}`);

  return { ratesStored: rows.length, rateDate };
}
