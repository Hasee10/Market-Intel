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
