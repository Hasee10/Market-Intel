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
