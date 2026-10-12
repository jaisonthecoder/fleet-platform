import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Structural rules that only a scan can enforce. Foundation rule 2 is a layout property:
 * no type checker notices when a feature module reaches past a port into CargoWise.
 */

const SRC = resolve(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const FILES = walk(SRC).map((file) => ({
  path: relative(SRC, file).split(sep).join('/'),
  text: readFileSync(file, 'utf8'),
}));

const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s*from\s*'([^']+)'/g;

function importsOf(text: string) {
  return [...text.matchAll(IMPORT_RE)].map((match) => ({
    typeOnly: Boolean(match[1]),
    clause: match[2] ?? '',
    specifier: match[3] ?? '',
  }));
}

describe('adapter boundaries', () => {
  it('scanned the source tree', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it('keeps every CargoWise class inside src/integration', () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      if (file.path.startsWith('integration/')) continue;

      for (const imported of importsOf(file.text)) {
        if (/\bCw1[A-Z]/.test(imported.clause) || imported.specifier.includes('integration/cw1')) {
          offenders.push(`${file.path} -> ${imported.specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('lets a feature module import IntegrationModule, which is wiring rather than coupling', () => {
    const wiring = FILES.filter(
      (file) =>
        file.path.startsWith('modules/') &&
        importsOf(file.text).some((imported) => imported.specifier.endsWith('integration.module')),
    );

    expect(wiring.length).toBeGreaterThan(0);
  });

  it('keeps src/contracts independent of modules and integration', () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      if (!file.path.startsWith('contracts/')) continue;

      for (const imported of importsOf(file.text)) {
        if (/(^|\/)\.\.\/(modules|integration)\//.test(imported.specifier)) {
          offenders.push(`${file.path} -> ${imported.specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never uses the @/ alias for a value import', () => {
    // A value import through the alias resolves at build time and fails at runtime under
    // CommonJS with "Cannot find module '@/contracts'".
    const offenders: string[] = [];

    for (const file of FILES) {
      for (const imported of importsOf(file.text)) {
        if (imported.specifier.startsWith('@/') && !imported.typeOnly) {
          offenders.push(`${file.path} -> ${imported.specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
