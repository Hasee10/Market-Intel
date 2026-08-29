// Ceiling on rows accepted by a single /api/*/bulk-import call (leaks.md
// finding #6 - all three endpoints previously accepted an unbounded array
// and passed it straight to a Supabase upsert). They're authenticated, so
// this isn't an anonymous DoS, but one seller shouldn't be able to stall a
// serverless function or the database with a 500k-row paste. Sized well
// above any realistic single catalog export; larger migrations should be
// chunked by the caller.
export const MAX_IMPORT_ROWS = 5000;

// Minimal RFC 4180-ish CSV parser (quoted fields, escaped "" quotes, commas
// and newlines inside quotes) - hand-rolled instead of adding a dependency
// since seller-uploaded product/customer/order exports are simple tabular
// data, not a case that needs a full CSV spec implementation.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0].trim() === ''));
}

export function csvToObjects(text: string): { headers: string[]; rows: string[][] } {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = parsed;
  return { headers: headers.map((h) => h.trim()), rows };
}

// Export-side counterpart to parseCsv/csvToObjects above. Generalizes the
// quote-escaping/comma-joining logic that already existed once, ad hoc, in
// RetentionPanel.tsx's downloadCsv() - extracted here so every CSV export in
// the app (at-risk customers, competitor scorecards, matched listings, ...)
// shares one implementation instead of re-deriving the same escaping rules.
export function objectsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
): string {
  const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(','));
  return [header, ...body].join('\n');
}

// Browser-only (uses document/URL) - for client components triggering a
// download in response to a click, same mechanics RetentionPanel.tsx already
// used inline. Revokes the object URL after triggering the click, same as
// the original - the download itself doesn't need the URL to stay alive.
export function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
