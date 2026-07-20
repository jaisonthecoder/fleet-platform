#!/usr/bin/env node
// Contract-drift guard (Phase 0 gate). Snapshots the exported surface of every
// `src/contracts/**/*.contract.ts` (const/type/interface/enum names) into a
// committed manifest and fails when the two diverge. Catches accidental
// add/remove/rename of a shared contract — the common drift between the API and
// its consumers. Shape-level type safety is additionally covered by `tsc`.
//
//   node scripts/contracts-drift.mjs            # check (CI); exit 1 on drift
//   node scripts/contracts-drift.mjs --update   # rewrite the manifest
//
// NOTE: UI-side regeneration drift (contracts -> app-ui types) is owned by the
// app-ui workspace and guarded there; this guard is the app-api half.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

const CONTRACTS_DIR = join(process.cwd(), 'src', 'contracts');
const MANIFEST = join(CONTRACTS_DIR, 'contracts.manifest.json');

/** Recursively lists every *.contract.ts file under the contracts dir. */
function listContractFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listContractFiles(full));
    } else if (entry.endsWith('.contract.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Extracts exported symbol names (const/type/interface/enum) from a source file. */
function exportedSymbols(source) {
  const names = new Set();
  const re = /export\s+(?:const|type|interface|enum|class|function)\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function buildManifest() {
  const manifest = {};
  for (const file of listContractFiles(CONTRACTS_DIR).sort()) {
    const key = relative(CONTRACTS_DIR, file).replace(/\\/g, '/');
    manifest[key] = exportedSymbols(readFileSync(file, 'utf8'));
  }
  return manifest;
}

const current = buildManifest();
const update = process.argv.includes('--update');

if (update) {
  writeFileSync(MANIFEST, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`contracts-drift: manifest updated (${Object.keys(current).length} files).`);
  process.exit(0);
}

let committed;
try {
  committed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch {
  console.error(
    'contracts-drift: no manifest found. Run `pnpm guard:contracts:update` and commit src/contracts/contracts.manifest.json.',
  );
  process.exit(1);
}

const expected = JSON.stringify(committed, null, 2);
const actual = JSON.stringify(current, null, 2);
if (expected !== actual) {
  console.error(
    'contracts-drift: DRIFT DETECTED — the exported contract surface changed but the manifest was not updated.\n' +
      'If this change is intended, run `pnpm guard:contracts:update` and commit the manifest.',
  );
  // Show a compact per-file diff of added/removed symbols.
  const files = new Set([...Object.keys(committed), ...Object.keys(current)]);
  for (const f of [...files].sort()) {
    const before = new Set(committed[f] ?? []);
    const after = new Set(current[f] ?? []);
    const added = [...after].filter((s) => !before.has(s));
    const removed = [...before].filter((s) => !after.has(s));
    if (added.length || removed.length || !committed[f] || !current[f]) {
      console.error(
        `  ${f}: ${!committed[f] ? '[new file] ' : ''}${!current[f] ? '[removed file] ' : ''}` +
          `${added.length ? `+${added.join(',+')}` : ''} ${removed.length ? `-${removed.join(',-')}` : ''}`.trim(),
      );
    }
  }
  process.exit(1);
}

console.log(`contracts-drift: OK — ${Object.keys(current).length} contract files in sync.`);
