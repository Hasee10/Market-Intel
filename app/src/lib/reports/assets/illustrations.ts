'server-only';

import { existsSync } from 'fs';
import { join } from 'path';

// Approved decorative illustrations (see illustrations/README.txt) - added
// 2026-08-04, then deleted the same day when the renderer was rebuilt against
// the reference deck on the (mistaken) reasoning that any image is the
// "flattened chart" failure mode the report brief forbids. That rule is
// about DATA visuals: a bar chart or price ladder pasted in as a picture
// instead of a real chart/shape object, which the reference deck itself
// avoids on every actual data slide (verified via python-pptx: Executive
// Snapshot, Market Position, Pricing Intelligence, Competitor Tracking are
// all native AUTO_SHAPE/chart objects there too). The reference's own
// pictures sit only on the cover and chapter-divider slides - pure brand
// illustration, encoding no data - so using these here does not reintroduce
// what the rule actually prohibits.
//
// Scoped to the cover slide only for now. Wiring these into the seven
// section-divider layouts as well is a reasonable follow-up, but each of
// those already has its own text/ghost-numeral layout that would need
// visual verification against a real render before adding a large image
// into the same space - not something to do without seeing the result.

const ASSETS_DIR = join(process.cwd(), 'src/lib/reports/assets/illustrations');

/** Natural pixel size of every asset in this pack - all delivered at 1536x1024 (3:2). */
export const ILLUSTRATION_ASPECT_RATIO = 1536 / 1024;

const COVER_ILLUSTRATION = 'ryvl_analytics_dashboard_illustration.png';

/**
 * Absolute filesystem path to the cover illustration, or null if the asset
 * is missing (e.g. a deploy that excludes this directory) - callers must
 * treat that as "skip the image", never throw and break report generation
 * over a decorative asset.
 */
export function coverIllustrationPath(): string | null {
  const path = join(ASSETS_DIR, COVER_ILLUSTRATION);
  return existsSync(path) ? path : null;
}
