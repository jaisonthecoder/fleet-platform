/**
 * Loads the UN/LOCODE port directory into Postgres.
 *
 * Reference data, not demo data, so it belongs in every environment and has no
 * dev-only guard - the same footing as seed-lookups.mjs.
 *
 * Two sources, in order of authority:
 *
 *   1. A UN/LOCODE CSV from UNECE, passed as `--file <path>`. This is the real
 *      directory: ~100k rows, reissued twice a year. Columns are read by name, so
 *      an edition that adds one does not break the load.
 *   2. The starter set below, used when no file is given. It is the lanes a demo
 *      or a first environment needs, written out so the feature is usable before
 *      the licensing paperwork for the full file is finished. Every row it writes
 *      is stamped `source = 'starter-set'`, so it is obvious in the table which
 *      rows are provisional and a real import replaces them cleanly.
 *
 * Idempotent, and it respects Noatum's own decisions on rerun: `is_active` is set
 * on insert and never overwritten afterwards. Whether Noatum offers a location is
 * not the UN's call, so a port somebody switched off stays off through the next
 * edition.
 *
 *   node infra/scripts/seed-ports.mjs
 *   node infra/scripts/seed-ports.mjs --file ./unlocode-2025-1.csv
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = parseEnv(
  readFileSync(new URL('../../apps/noatum-customer-portal-api/.env.local', import.meta.url), 'utf8'),
);

if (!env.DATABASE_MIGRATION_URL) throw new Error('DATABASE_MIGRATION_URL is required.');

const owner = new URL(env.DATABASE_MIGRATION_URL);
const database = decodeURIComponent(owner.pathname.slice(1));
const ownerUser = decodeURIComponent(owner.username);

const composeEnv = {
  ...process.env,
  ...env,
  POSTGRES_USER: ownerUser,
  POSTGRES_PASSWORD: decodeURIComponent(owner.password),
  POSTGRES_DB: database,
  POSTGRES_PORT: owner.port || '5432',
};

const argument = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  const pair = process.argv.find((value) => value.startsWith(`--${name}=`));
  return pair ? pair.slice(name.length + 3) : undefined;
};

/**
 * The starter set: [code, name, country, seaport, airport].
 *
 * Chosen as Noatum's own markets plus the lanes a Spain- or Gulf-based forwarder
 * quotes daily. Not a substitute for the directory - it is roughly 0.05% of it -
 * and every row says so through its `source`.
 */
const STARTER = [
  // Spain and Portugal
  ['ESVLC', 'Valencia', 'ES', true, false],
  ['ESBCN', 'Barcelona', 'ES', true, true],
  ['ESALG', 'Algeciras', 'ES', true, false],
  ['ESBIO', 'Bilbao', 'ES', true, true],
  ['ESMAD', 'Madrid', 'ES', false, true],
  ['ESLPA', 'Las Palmas de Gran Canaria', 'ES', true, true],
  ['PTLIS', 'Lisboa', 'PT', true, true],
  ['PTLEI', 'Leixoes', 'PT', true, false],
  // Gulf
  ['AEJEA', 'Jebel Ali', 'AE', true, false],
  ['AEDXB', 'Dubai', 'AE', true, true],
  ['AEAUH', 'Abu Dhabi', 'AE', true, true],
  ['AESHJ', 'Sharjah', 'AE', true, true],
  ['SAJED', 'Jeddah', 'SA', true, true],
  ['SADMM', 'Dammam', 'SA', true, true],
  ['OMSLL', 'Salalah', 'OM', true, true],
  ['QADOH', 'Doha', 'QA', true, true],
  ['KWKWI', 'Kuwait', 'KW', true, true],
  ['BHBAH', 'Bahrain', 'BH', true, true],
  // North Europe
  ['NLRTM', 'Rotterdam', 'NL', true, false],
  ['BEANR', 'Antwerpen', 'BE', true, false],
  ['DEHAM', 'Hamburg', 'DE', true, true],
  ['DEBRV', 'Bremerhaven', 'DE', true, false],
  ['FRLEH', 'Le Havre', 'FR', true, false],
  ['GBFXT', 'Felixstowe', 'GB', true, false],
  ['GBSOU', 'Southampton', 'GB', true, false],
  ['GBLON', 'London', 'GB', true, true],
  // Mediterranean
  ['ITGOA', 'Genova', 'IT', true, true],
  ['ITSPE', 'La Spezia', 'IT', true, false],
  ['GRPIR', 'Piraeus', 'GR', true, false],
  ['TRIST', 'Istanbul', 'TR', true, true],
  ['MAPTM', 'Tanger Med', 'MA', true, false],
  ['EGALY', 'Alexandria', 'EG', true, true],
  ['EGPSD', 'Port Said', 'EG', true, false],
  // Asia
  ['CNSHA', 'Shanghai', 'CN', true, true],
  ['CNNGB', 'Ningbo', 'CN', true, true],
  ['CNSZX', 'Shenzhen', 'CN', true, true],
  ['CNTAO', 'Qingdao', 'CN', true, true],
  ['HKHKG', 'Hong Kong', 'HK', true, true],
  ['SGSIN', 'Singapore', 'SG', true, true],
  ['KRPUS', 'Busan', 'KR', true, true],
  ['JPTYO', 'Tokyo', 'JP', true, true],
  ['JPYOK', 'Yokohama', 'JP', true, false],
  ['MYPKG', 'Port Klang', 'MY', true, false],
  ['THLCH', 'Laem Chabang', 'TH', true, false],
  ['VNSGN', 'Ho Chi Minh City', 'VN', true, true],
  ['INNSA', 'Nhava Sheva', 'IN', true, false],
  ['INMAA', 'Chennai', 'IN', true, true],
  ['LKCMB', 'Colombo', 'LK', true, true],
  // Americas
  ['USLAX', 'Los Angeles', 'US', true, true],
  ['USLGB', 'Long Beach', 'US', true, false],
  ['USNYC', 'New York', 'US', true, true],
  ['USSAV', 'Savannah', 'US', true, true],
  ['USHOU', 'Houston', 'US', true, true],
  ['USSEA', 'Seattle', 'US', true, true],
  ['CAVAN', 'Vancouver', 'CA', true, true],
  ['MXVER', 'Veracruz', 'MX', true, false],
  ['BRSSZ', 'Santos', 'BR', true, false],
  // Africa and Oceania
  ['ZADUR', 'Durban', 'ZA', true, true],
  ['AUSYD', 'Sydney', 'AU', true, true],
  ['AUMEL', 'Melbourne', 'AU', true, true],
];

/**
 * UNECE publishes the directory as CSV. Columns are matched by header name rather
 * than position, and a row is kept only when its Function column marks it a
 * seaport (1) or an airport (4) - the two this platform can route through.
 */
function fromCsv(path) {
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new Error(`${path} is empty.`);

  const split = (line) => {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) { cells.push(cell); cell = ''; }
      else cell += char;
    }
    cells.push(cell);
    return cells.map((value) => value.trim());
  };

  const header = split(lines[0]).map((name) => name.toLowerCase());
  const at = (names) => {
    const index = header.findIndex((name) => names.includes(name));
    if (index === -1) throw new Error(`Column not found: expected one of ${names.join(', ')}`);
    return index;
  };

  const country = at(['country', 'countrycode', 'country code']);
  const location = at(['location', 'locationcode', 'location code']);
  const name = at(['name', 'nodiacritics', 'namewodiacritics']);
  const functions = at(['function', 'functions']);
  const subdivision = header.findIndex((value) => value.includes('subdiv'));

  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const code = `${cells[country] ?? ''}${cells[location] ?? ''}`.toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(code)) continue;

    const classifier = cells[functions] ?? '';
    const isSeaport = classifier.includes('1');
    const isAirport = classifier.includes('4');
    if (!isSeaport && !isAirport) continue;

    const label = (cells[name] ?? '').slice(0, 120);
    if (label === '') continue;

    rows.push([
      code,
      label,
      code.slice(0, 2),
      isSeaport,
      isAirport,
      subdivision === -1 ? null : (cells[subdivision] || null),
    ]);
  }
  return rows;
}

const file = argument('file');
const rows = file
  ? fromCsv(file)
  : STARTER.map(([code, name, country, sea, air]) => [code, name, country, sea, air, null]);
const source = file ? `unlocode:${file.split(/[\\/]/).pop()}`.slice(0, 60) : 'starter-set';

const quote = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;

function* batches(list, size) {
  for (let i = 0; i < list.length; i += size) yield list.slice(i, i + size);
}

const statements = [
  // Every write in this transaction is a portal act on reference data.
  "SELECT set_config('app.is_internal', 'true', true);",
];

for (const batch of batches(rows, 500)) {
  const values = batch
    .map(([code, name, country, sea, air, subdiv]) =>
      `(${quote(code)}, ${quote(name)}, ${quote(country)}, ${quote(subdiv)}, ${sea}, ${air}, ${quote(source)})`)
    .join(',\n    ');

  statements.push(
    `INSERT INTO port (code, name, country_code, subdivision, is_seaport, is_airport, source)
   VALUES
    ${values}
   ON CONFLICT (code) DO UPDATE SET
     name         = EXCLUDED.name,
     country_code = EXCLUDED.country_code,
     subdivision  = EXCLUDED.subdivision,
     is_seaport   = EXCLUDED.is_seaport,
     is_airport   = EXCLUDED.is_airport,
     source       = EXCLUDED.source,
     updated_at   = now();`,
  );
}

const result = spawnSync(
  'docker',
  ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
    'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', ownerUser, '-d', database],
  { cwd: root, env: composeEnv, input: `BEGIN;\n${statements.join('\n')}\nCOMMIT;\n`, stdio: ['pipe', 'inherit', 'inherit'] },
);

if (result.status !== 0) throw new Error('Seeding the port directory failed; nothing was committed.');

process.stdout.write(
  `\n  ${rows.length} ports loaded from ${file ? file : 'the starter set'} (source = ${source}).\n`
  + (file ? '' : '  Provisional. Run again with --file <UNECE csv> for the full directory.\n') + '\n',
);
