/**
 * Loads the Phase 1 lookup catalogue into Postgres.
 *
 * Reference data, not demo data: this belongs in every environment, so unlike
 * the demo identity seed it has no dev-only guard. It is idempotent - rerun it
 * after changing the catalogue and only the differences land.
 *
 * Ownership is respected on rerun. `is_customer_visible` and `sort_order` are
 * decisions the portal makes after the first load, so a reseed never resets
 * them; a document type somebody approved stays approved.
 *
 * Note for whoever builds the editing screen: labels ARE overwritten on rerun,
 * which is right while the catalogue file is the only author of them. Once
 * staff can edit a label, this needs an ownership guard or it will undo them.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { catalogue, LOCALES } from '../../apps/noatum-customer-portal-api/prisma/seed-data/catalogue.mjs';

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

const quote = (value) =>
  value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;

/** psql takes one statement at a time happily, but a 3,500-row insert is better batched. */
function* batches(rows, size) {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}

const datasets = catalogue();
const statements = ["SELECT set_config('app.is_internal', 'true', true);"];

// --- categories -------------------------------------------------------------

const categoryRows = datasets.map(
  (set) =>
    `(${quote(set.code)}, ${quote(set.name)}, ${quote(set.description ?? null)}, ` +
    `${quote(set.ownership)}::"LookupOwnership", ${quote(set.sourceSystem ?? null)}, ${quote(set.sourceRef ?? null)}, ` +
    `${Number(set.sortOrder) || 0})`,
);

statements.push(
  `INSERT INTO lookup_category (code, name, description, ownership, source_system, source_ref, sort_order)
   VALUES ${categoryRows.join(',\n          ')}
   ON CONFLICT (code) DO UPDATE SET
     name = EXCLUDED.name,
     description = EXCLUDED.description,
     ownership = EXCLUDED.ownership,
     source_system = EXCLUDED.source_system,
     source_ref = EXCLUDED.source_ref,
     -- Order is a portal decision once somebody has made one, so the seed only
     -- supplies the baseline for a list still sitting at the default.
     sort_order = CASE WHEN lookup_category.sort_order = 0
                       THEN EXCLUDED.sort_order ELSE lookup_category.sort_order END,
     updated_at = now();`,
);

for (const set of datasets.filter((entry) => entry.parentCategory)) {
  statements.push(
    `UPDATE lookup_category c SET parent_category_id = p.id, updated_at = now()
     FROM lookup_category p
     WHERE c.code = ${quote(set.code)} AND p.code = ${quote(set.parentCategory)}
       AND c.parent_category_id IS DISTINCT FROM p.id;`,
  );
}

// --- items ------------------------------------------------------------------

let itemCount = 0;
let translationCount = 0;

for (const set of datasets) {
  const rows = set.items.map((item, index) => {
    itemCount += 1;
    const active = item.isActive === undefined ? true : Boolean(item.isActive);
    // An inactive source row is never customer visible, whatever the category default.
    const visible = Boolean(set.customerVisible) && active;
    return (
      `(${quote(item.code)}, ${(index + 1) * 10}, ${active}, ${visible}, ${quote(item.sourceRef ?? null)})`
    );
  });

  for (const batch of batches(rows, 250)) {
    statements.push(
      `INSERT INTO lookup_item (category_id, code, sort_order, is_active, is_customer_visible, source_ref)
       SELECT c.id, v.code, v.sort_order, v.is_active, v.is_customer_visible, v.source_ref
       FROM lookup_category c
       CROSS JOIN (VALUES ${batch.join(',\n                             ')})
         AS v(code, sort_order, is_active, is_customer_visible, source_ref)
       WHERE c.code = ${quote(set.code)}
       ON CONFLICT (category_id, code) DO UPDATE SET
         is_active = EXCLUDED.is_active,
         source_ref = EXCLUDED.source_ref,
         updated_at = now();`,
    );
  }

  // Parents resolve inside the permitted parent category, which for a
  // self-nesting list such as hazard classes is the category itself.
  const parented = set.items.filter((item) => item.parent);
  if (parented.length) {
    const parentCategory = set.parentCategory ?? set.code;
    for (const batch of batches(parented, 250)) {
      const pairs = batch.map((item) => `(${quote(item.code)}, ${quote(item.parent)})`);
      statements.push(
        `UPDATE lookup_item i SET parent_id = p.id, updated_at = now()
         FROM (VALUES ${pairs.join(',\n                       ')}) AS v(child_code, parent_code)
         JOIN lookup_category pc ON pc.code = ${quote(parentCategory)}
         JOIN lookup_item p ON p.category_id = pc.id AND p.code = v.parent_code
         JOIN lookup_category cc ON cc.code = ${quote(set.code)}
         WHERE i.category_id = cc.id AND i.code = v.child_code
           AND i.parent_id IS DISTINCT FROM p.id;`,
      );
    }
  }

  // --- translations ---------------------------------------------------------

  const translations = [];
  for (const item of set.items) {
    for (const locale of LOCALES) {
      const label = item.labels?.[locale];
      if (!label) continue;
      translationCount += 1;
      translations.push(`(${quote(item.code)}, ${quote(locale)}, ${quote(label)})`);
    }
  }

  for (const batch of batches(translations, 250)) {
    statements.push(
      `INSERT INTO lookup_item_translation (item_id, locale, label)
       SELECT i.id, v.locale, v.label
       FROM lookup_category c
       JOIN lookup_item i ON i.category_id = c.id
       JOIN (VALUES ${batch.join(',\n                    ')}) AS v(code, locale, label) ON v.code = i.code
       WHERE c.code = ${quote(set.code)}
       ON CONFLICT (item_id, locale) DO UPDATE SET
         label = EXCLUDED.label,
         updated_at = now();`,
    );
  }
}

statements.push(
  `SELECT c.code AS category, c.ownership::text AS ownership, count(i.id) AS items,
          count(i.id) FILTER (WHERE i.is_customer_visible) AS customer_visible,
          count(i.id) FILTER (WHERE i.parent_id IS NOT NULL) AS nested
   FROM lookup_category c LEFT JOIN lookup_item i ON i.category_id = c.id
   GROUP BY c.code, c.ownership ORDER BY c.ownership::text, c.code;`,
);

const result = spawnSync(
  'docker',
  ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
    'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', ownerUser, '-d', database],
  { cwd: root, env: composeEnv, input: `BEGIN;\n${statements.join('\n')}\nCOMMIT;\n`, stdio: ['pipe', 'inherit', 'inherit'] },
);

if (result.status !== 0) throw new Error('Seeding the lookup catalogue failed; nothing was committed.');
console.log(
  `Seeded ${datasets.length} categories, ${itemCount} items and ${translationCount} translations.`,
);
