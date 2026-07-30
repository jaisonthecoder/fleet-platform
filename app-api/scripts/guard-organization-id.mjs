// CI guard (ADR-008): application code must never reference the dormant
// `organization_id` tenant column. It stays inert (RLS off, no branching)
// until a superseding ADR enables multi-org. Migrations and schema definitions
// legitimately declare it; this guard only scans src/modules/**.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/modules';
// Explicit organization ownership boundaries may reference the seam while RLS
// remains dormant. All domain modules stay prohibited until scope migration.
const ALLOWLIST_SUFFIXES = [
  'services/audit.service.ts',
  'services/access.service.ts',
  'repositories/platform.repository.ts',
  'services/hierarchy.service.ts',
  'services/scope-authorization.service.ts',
  'dashboards/services/dashboards.service.ts',
  'dashboards/repositories/dashboards.repository.ts',
  'identity/controllers/user-admin.controller.ts',
  'identity/services/user-admin.service.ts',
  'bookings/repositories/bookings.repository.ts',
  'bookings/services/booking.service.ts',
  'bookings/services/consent-template.provider.ts',
  'vehicles/controllers/vehicle.controller.ts',
  'vehicles/repositories/vehicle.repository.ts',
  'vehicles/services/transfer.service.ts',
  'vehicles/services/vehicle.service.ts',
  'telematics-domain/controllers/telematics.controller.ts',
  'telematics-domain/repositories/telematics.repository.ts',
  'telematics-domain/services/live-map.service.ts',
  'entitlements/repositories/entitlements.repository.ts',
  'entitlements/services/entitlement.service.ts',
  'entitlements/services/entitlement-consent-template.provider.ts',
  'handover/repositories/handover.repository.ts',
  'handover/services/handover.service.ts',
  'vendors/controllers/vendor.controller.ts',
  'vendors/repositories/vendor.repository.ts',
  'vendors/services/vendor.service.ts',
];
const ALLOWLIST_SEGMENTS = [
  '/consent-administration/',
  '/organization-administration/',
  '/policy/',
  '/policy-administration/',
];

const violations = [];

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      scan(path);
      continue;
    }
    if (!path.endsWith('.ts') || path.endsWith('.spec.ts')) continue;
    const normalized = path.replaceAll('\\', '/');
    if (ALLOWLIST_SUFFIXES.some((allowed) => normalized.endsWith(allowed))) continue;
    if (ALLOWLIST_SEGMENTS.some((allowed) => normalized.includes(allowed))) continue;
    const text = readFileSync(path, 'utf8');
    text.split(/\r?\n/).forEach((line, index) => {
      if (/organization_id|organizationId/.test(line)) {
        violations.push(`${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

scan(ROOT);

if (violations.length > 0) {
  console.error(
    'organization_id guard FAILED — app code must not reference the dormant tenant column (ADR-008):',
  );
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(
  'organization_id guard OK — references remain confined to approved organization/audit boundaries.',
);
