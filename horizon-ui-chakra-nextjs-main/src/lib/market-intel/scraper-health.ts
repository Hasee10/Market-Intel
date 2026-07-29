'server-only';

import { createClient } from '@/lib/supabase/server';

export type PlatformHealth = {
  platformSlug: string;
  lastRunAt: string;
  lastRunError: string | null;
  lastRunProductCount: number;
  failureRatePct: number;
  runsConsidered: number;
};

const RECENT_RUNS_WINDOW = 20;

// Internal health view over scraper_runs (see 015_phase5_6.sql) - per
// platform, the most recent run's status plus a failure rate over its last
// 20 runs. iShopping/Goto are already known to have Cloudflare/TLS friction
// (new_implementation_doc.md Phase 6) - this turns "known friction" into an
// actual measured number instead of anecdote.
export async function getScraperHealth(): Promise<PlatformHealth[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('scraper_runs')
    .select('platform_slug, product_count, error, run_at')
    .order('run_at', { ascending: false })
    .limit(500);

  if (error || !data) return [];

  const byPlatform = new Map<string, typeof data>();
  for (const row of data) {
    if (!byPlatform.has(row.platform_slug)) byPlatform.set(row.platform_slug, []);
    byPlatform.get(row.platform_slug)!.push(row);
  }

  const results: PlatformHealth[] = [];
  for (const [platformSlug, runs] of byPlatform) {
    const recent = runs.slice(0, RECENT_RUNS_WINDOW);
    const failures = recent.filter((r) => r.error).length;
    const latest = runs[0];

    results.push({
      platformSlug,
      lastRunAt: latest.run_at,
      lastRunError: latest.error,
      lastRunProductCount: latest.product_count,
      failureRatePct: Math.round((failures / recent.length) * 100),
      runsConsidered: recent.length,
    });
  }

  return results.sort((a, b) => b.failureRatePct - a.failureRatePct);
}
