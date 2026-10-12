/**
 * Turns the two CargoWise catalogue workbooks in `docs/` into the JSON the
 * lookup seed reads.
 *
 * Run once when a workbook is replaced, then commit the output. The workbook
 * stays the record; the JSON is a derived artefact and records the SHA-256 it
 * came from so a stale extract is detectable.
 *
 * An .xlsx is a zip of XML. Rather than add a spreadsheet dependency for a
 * script that runs a handful of times, this reads the zip directly: zlib can
 * inflate the entries, and the central directory is simple enough to walk.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const docs = new URL('../../docs/', import.meta.url);
const outDir = new URL('../../apps/noatum-customer-portal-api/prisma/seed-data/', import.meta.url);

/** Reads a zip's central directory and inflates the named entries. */
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Not a zip file: no end-of-central-directory record.');

  const entryCount = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const files = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt central directory.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and extra field, at its own lengths.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    files.set(name, method === 0 ? data : inflateRawSync(data));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const decodeEntities = (text) =>
  text
    .replaceAll(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

/** Shared strings are <si> elements whose text may be split across <t> runs. */
function sharedStrings(xml) {
  if (!xml) return [];
  return [...xml.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, item]) =>
    decodeEntities([...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(([, text]) => text).join('')),
  );
}

const columnIndex = (reference) =>
  [...reference.replace(/\d+/g, '')].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;

/** Returns the sheet as rows of strings, with gaps filled so columns line up. */
function readSheet(xml, strings) {
  const text = xml.toString('utf8');
  return [...text.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(([, rowXml]) => {
    const cells = [];
    for (const [, attributes, body] of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = attributes.match(/r="([A-Z]+)\d+"/)?.[1];
      const type = attributes.match(/t="([^"]+)"/)?.[1];
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/)?.[1];

      let value = '';
      if (type === 's' && raw !== undefined) value = strings[Number(raw)] ?? '';
      else if (type === 'inlineStr' && inline !== undefined) value = decodeEntities(inline);
      else if (raw !== undefined) value = decodeEntities(raw);

      const index = reference ? columnIndex(reference) : cells.length;
      while (cells.length < index) cells.push('');
      cells[index] = value.trim();
    }
    return cells;
  });
}

function load(file) {
  const buffer = readFileSync(new URL(file, docs));
  const entries = unzip(buffer);
  const sheetName = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error(`No worksheet found in ${file}.`);

  const rows = readSheet(entries.get(sheetName), sharedStrings(entries.get('xl/sharedStrings.xml')));
  const [header, ...body] = rows;
  return {
    sha256: createHash('sha256').update(buffer).digest('hex'),
    header,
    rows: body.filter((row) => row.some((cell) => cell !== '')),
  };
}

const yes = (value) => String(value).toUpperCase() === 'Y';

const documents = load('document_type_list.xlsx');
const events = load('events_full_list.xlsx');

const documentColumn = Object.fromEntries(documents.header.map((name, index) => [name, index]));
const eventColumn = Object.fromEntries(events.header.map((name, index) => [name, index]));

const required = (columns, ...names) => {
  const missing = names.filter((name) => columns[name] === undefined);
  if (missing.length) throw new Error(`Workbook is missing expected columns: ${missing.join(', ')}`);
};
required(documentColumn, 'Doc Type', 'Description', 'Category', 'Active', 'Published');
required(eventColumn, 'Code', 'Event Name', 'Is Active');

/**
 * A code can appear more than once when CargoWise defines it in several
 * categories. The lookup keys on code alone, so keep the first definition and
 * report the rest rather than letting a later row overwrite silently.
 */
const documentTypes = [];
const duplicateDocumentTypes = [];
const seenDocument = new Set();
for (const row of documents.rows) {
  const code = row[documentColumn['Doc Type']];
  if (!code) continue;
  if (seenDocument.has(code)) {
    duplicateDocumentTypes.push(code);
    continue;
  }
  seenDocument.add(code);
  documentTypes.push({
    code,
    name: row[documentColumn.Description] || code,
    category: row[documentColumn.Category] || '',
    isActive: yes(row[documentColumn.Active]),
    isPublished: yes(row[documentColumn.Published]),
  });
}

const eventCodes = [];
const seenEvent = new Set();
for (const row of events.rows) {
  const code = row[eventColumn.Code];
  if (!code || seenEvent.has(code)) continue;
  seenEvent.add(code);
  eventCodes.push({
    code,
    name: row[eventColumn['Event Name']] || code,
    isActive: yes(row[eventColumn['Is Active']]),
  });
}

const documentCategories = [...new Set(documentTypes.map((type) => type.category).filter(Boolean))].sort();

mkdirSync(outDir, { recursive: true });

const write = (file, payload) => {
  writeFileSync(new URL(file, outDir), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${file}`);
};

write('cw1-document-types.json', {
  source: 'docs/document_type_list.xlsx',
  sha256: documents.sha256,
  extractedAt: new Date().toISOString().slice(0, 10),
  categories: documentCategories,
  items: documentTypes,
});

write('cw1-event-codes.json', {
  source: 'docs/events_full_list.xlsx',
  sha256: events.sha256,
  extractedAt: new Date().toISOString().slice(0, 10),
  items: eventCodes,
});

console.log(
  `${documentTypes.length} document types across ${documentCategories.length} categories ` +
    `(${documentTypes.filter((type) => type.isPublished).length} published), ${eventCodes.length} event codes.`,
);
if (duplicateDocumentTypes.length) {
  console.log(`Skipped ${duplicateDocumentTypes.length} repeated document codes: ${duplicateDocumentTypes.join(', ')}`);
}
