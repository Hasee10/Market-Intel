// Read-only benchmark for candidate search (migrations 047 + 048).
//
//   node scripts/perf-check-candidate-search.mjs
//
// Answers one question: on real data, is the shipped design (concurrent
// chunks of CANDIDATE_BATCH_SIZE titles) actually faster than the old one
// (one concurrent call per title)? Migration 047's header carries the
// numbers this is meant to confirm or refute - those were measured on
// synthetic rows on a laptop and have never been reproduced on production.
//
// Needs SUPABASE_SERVICE_ROLE_KEY, not the anon key. Both candidate-search
// functions inner-join market_platforms, and RLS hides that table from anon,
// so under the anon key every query returns zero rows and the timings measure
// empty round-trips - which once produced a confident and completely wrong
// "2x faster" result. That is what the rows>0 guard below exists for; keep it.
//
// SELECT-only: every call is a plain GET or one of the two `stable` RPCs.
// No writes, no DDL. The key is read from .env.local and never printed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolved against this file, not the cwd, so it runs from anywhere.
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');

const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
if (!K) { console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local'); process.exit(1); }
const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };

const get = async (p) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { headers: h });
  const b = await r.json();
  if (!Array.isArray(b)) throw new Error(`GET ${p} -> ${r.status} ${JSON.stringify(b).slice(0, 200)}`);
  return b;
};
const rpc = async (fn, args) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args) });
  return { status: r.status, body: await r.json() };
};

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
async function timeIt(label, fn, n = 7) {
  await fn(); // warm
  const t = [];
  for (let i = 0; i < n; i++) t.push(await fn());
  const m = median(t);
  console.log(`  ${label.padEnd(44)} median ${m.toFixed(0).padStart(5)}ms   min ${Math.min(...t).toFixed(0).padStart(4)}  max ${Math.max(...t).toFixed(0)}`);
  return m;
}

// Build the scope exactly the way getMarketScope() does: market_category_map
// rows for one seller category give the (category_slug, platform_id) pairs.
const mapRows = await get('market_category_map?select=seller_category_slug,category_slug,platform_id&limit=10000');
const byCat = new Map();
for (const r of mapRows) {
  if (!byCat.has(r.seller_category_slug)) byCat.set(r.seller_category_slug, []);
  byCat.get(r.seller_category_slug).push(r);
}
const [sellerCat, rows] = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)[0];
const slugs = [...new Set(rows.map((r) => r.category_slug))];
const plats = [...new Set(rows.map((r) => r.platform_id))];

const inList = slugs.slice(0, 40).map((s) => `"${s}"`).join(',');
const scopeCount = await fetch(
  `${U}/rest/v1/market_products?select=id&is_active=eq.true&category_slug=in.(${inList})`,
  { headers: { ...h, Prefer: 'count=exact', Range: '0-0' } },
).then((r) => r.headers.get('content-range'));

console.log(`seller category : ${sellerCat}`);
console.log(`scope           : ${slugs.length} category slugs, ${plats.length} platforms`);
console.log(`live rows in scope (first 40 slugs): ${scopeCount}`);

// Real seller product titles if this seller category has any; otherwise real
// market titles, which is still a representative query workload.
let titles = (await get('seller_products?select=title&is_active=eq.true&limit=20')).map((r) => r.title).filter(Boolean);
let titleSource = 'seller_products (real seller catalogue)';
if (titles.length < 20) {
  const extra = (await get(`market_products?select=title&is_active=eq.true&category_slug=in.(${inList})&limit=${20 - titles.length}`)).map((r) => r.title);
  titles = [...titles, ...extra];
  titleSource = titles.length ? 'seller_products + market_products' : 'market_products';
}
console.log(`titles          : ${titles.length} from ${titleSource}\n`);

// Guard that caught the last bad run: if the probe returns no candidates,
// every timing below is measuring empty round-trips, not real work.
const probe = await rpc('market_top_similar_candidates_batch', {
  p_category_slugs: slugs, p_platform_ids: plats, p_query_titles: titles.slice(0, 3), p_limit: 100,
});
if (probe.status !== 200) { console.log('047 NOT callable:', probe.status, JSON.stringify(probe.body).slice(0, 300)); process.exit(0); }
const probeRows = Array.isArray(probe.body) ? probe.body.length : 0;
console.log(`probe: 047 callable, ${probeRows} candidate rows for 3 titles`);
if (probeRows === 0) { console.log('\nZero candidates - timings would be meaningless. Aborting.'); process.exit(0); }

const T = titles.slice(0, 20);
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };

console.log(`\n--- resolving ${T.length} titles against LIVE production data ---`);
const a = await timeIt('A) N single calls, all concurrent (OLD)', async () => {
  const t0 = performance.now();
  await Promise.all(T.map((t) => rpc('market_top_similar_candidates', { p_category_slugs: slugs, p_platform_ids: plats, p_query_title: t, p_limit: 100 })));
  return performance.now() - t0;
});
const c = await timeIt('C) chunks of 5, concurrent (SHIPPED)', async () => {
  const t0 = performance.now();
  await Promise.all(chunk(T, 5).map((ch) => rpc('market_top_similar_candidates_batch', { p_category_slugs: slugs, p_platform_ids: plats, p_query_titles: ch, p_limit: 100 })));
  return performance.now() - t0;
});
const b = await timeIt('B) one all-titles batch (REJECTED design)', async () => {
  const t0 = performance.now();
  await rpc('market_top_similar_candidates_batch', { p_category_slugs: slugs, p_platform_ids: plats, p_query_titles: T, p_limit: 100 });
  return performance.now() - t0;
});

console.log('\n--- result ---');
console.log(`SHIPPED vs OLD            : ${(a / c).toFixed(2)}x  (${a.toFixed(0)}ms -> ${c.toFixed(0)}ms)`);
console.log(`REJECTED vs SHIPPED       : ${(b / c).toFixed(2)}x  (${b.toFixed(0)}ms vs ${c.toFixed(0)}ms)`);
console.log(b > c ? '  -> rejecting the all-in-one batch was correct on production data too'
                  : '  -> NOTE: all-in-one is FASTER here; the laptop benchmark did not hold');
