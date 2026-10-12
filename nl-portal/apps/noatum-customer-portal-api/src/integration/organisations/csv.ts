/**
 * RFC 4180 CSV reader.
 *
 * Hand-rolled rather than another dependency: the import contract is a handful of
 * flat columns, and the two things that actually break naive splitting — quoted
 * commas and escaped quotes — are a dozen lines to handle properly.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return [];

  const header = rows[0]!.map((column) => column.trim().toLowerCase());
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ''])));
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; } else { quoted = false; }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') { quoted = true; continue; }
    if (character === ',') { row.push(cell); cell = ''; continue; }
    if (character === '\r') continue;
    if (character === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += character;
  }

  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function csvBoolean(value: string | undefined, fallback = false): boolean {
  const normalised = (value ?? '').trim().toLowerCase();
  if (normalised === '') return fallback;
  return ['true', '1', 'y', 'yes', 't'].includes(normalised);
}

export function csvList(value: string | undefined): string[] {
  return (value ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * A login page, an HTML error body or a renamed column all arrive as a parseable
 * 200. Without this the rows are silently dropped and the export looks legitimately
 * empty — which, on an authoritative run, is indistinguishable from "delete
 * everything".
 */
export function requireColumns(rows: Record<string, string>[], required: string[], fileName: string): void {
  if (rows.length === 0) {
    throw new Error(`${fileName} contained no data rows. Refusing to treat that as an empty directory.`);
  }
  const present = new Set(Object.keys(rows[0] ?? {}));
  const missing = required.filter((column) => !present.has(column));
  if (missing.length > 0) {
    throw new Error(`${fileName} is missing the column(s) ${missing.join(', ')}. This does not look like the organisation export.`);
  }
}
