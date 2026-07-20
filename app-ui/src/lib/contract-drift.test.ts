import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLATFORM_ROLES } from '@/features/auth/roles'
import { ROLE_SOURCES } from '@/features/identity/user-admin.contract'
import { POLICY_RULE_TYPES } from '@/features/policy/policy.contract'

/**
 * Contract-drift guard (pulled forward from U8 — the biggest structural risk).
 *
 * The app-ui mirrors a subset of the backend `app-api/src/contracts/**` + DB
 * enums as local types. This test reads the backend source in the monorepo and
 * asserts the **shared vocabularies** (role/status/reason-code sets) match
 * exactly, so a value added/renamed in the backend can never silently diverge
 * from the UI copy.
 *
 * **Every phase that mirrors a new backend enum / reason-code set MUST add an
 * entry to `CHECKS`** (see the placeholders below).
 *
 * If the backend source is absent (app-ui built in isolation), each check skips
 * with a warning instead of failing — the guard is meaningful only where both
 * packages are present (the monorepo / CI).
 */

/** Reads a backend source file relative to the app-api package root, or null. */
function backendSource(relativeToApiRoot: string): string | null {
  const path = fileURLToPath(
    new URL(`../../../app-api/${relativeToApiRoot}`, import.meta.url),
  )
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** Extracts the string members of a `pgEnum('name', [ '...' , ... ])` declaration. */
function pgEnumValues(src: string, constName: string): string[] {
  const re = new RegExp(
    `${constName}\\s*=\\s*pgEnum\\(\\s*'[^']+'\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  )
  const match = src.match(re)
  if (!match) throw new Error(`pgEnum '${constName}' not found in backend source`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** Extracts the members of a `z.enum([ '...' , ... ])` assigned to a named const. */
function zEnumValues(src: string, constName: string): string[] {
  const re = new RegExp(`${constName}\\s*=\\s*z\\.enum\\(\\s*\\[([\\s\\S]*?)\\]`)
  const match = src.match(re)
  if (!match) throw new Error(`z.enum '${constName}' not found in backend source`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** Extracts string members of a named `as const` array declaration. */
function constArrayValues(src: string, constName: string): string[] {
  const re = new RegExp(`${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`)
  const match = src.match(re)
  if (!match) throw new Error(`const array '${constName}' not found in backend source`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

interface DriftCheck {
  name: string
  /** Path relative to `app-api/`. */
  backendFile: string
  /** Pulls the canonical set of values out of the backend source. */
  extract: (src: string) => string[]
  /** The values the app-ui mirrors locally. */
  ui: readonly string[]
}

const CHECKS: DriftCheck[] = [
  {
    name: 'PlatformRole ↔ backend fleet_role enum (18 roles)',
    backendFile: 'src/common/database/schema/_shared.ts',
    extract: (src) => pgEnumValues(src, 'roleEnum'),
    ui: PLATFORM_ROLES,
  },
  {
    name: 'role source ↔ backend roleSourceSchema',
    backendFile: 'src/contracts/user-admin.contract.ts',
    extract: (src) => zEnumValues(src, 'roleSourceSchema'),
    ui: ROLE_SOURCES,
  },
  {
    name: 'policy rule types ↔ backend POLICY_RULE_TYPES',
    backendFile: 'src/contracts/policy-rules.contract.ts',
    extract: (src) => constArrayValues(src, 'POLICY_RULE_TYPES'),
    ui: POLICY_RULE_TYPES,
  },
  // ── Register future mirrors here as each phase lands them ────────────────
  //  U2 vehicles : vehicleLifecycleStatusEnum / vehicleOperationalStatusEnum
  //  U3 booking  : bookingStatusEnum + BOOKING_REASON keys
  //  U5 fines    : fineStatusEnum, attributionBasis + FINE_REASON keys;
  //                entitlementStatus + ENTITLEMENT_REASON keys
  //  U7 dashboards: CostVisibility ('full' | 'aggregate' | 'masked')
]

describe('contract drift (app-ui mirrors ↔ app-api source)', () => {
  for (const check of CHECKS) {
    it(check.name, () => {
      const src = backendSource(check.backendFile)
      if (src === null) {
        // eslint-disable-next-line no-console
        console.warn(
          `contract-drift: backend source not found (${check.backendFile}) — skipped (isolated build)`,
        )
        return
      }
      const backendValues = [...check.extract(src)].sort()
      const uiValues = [...check.ui].sort()
      expect(uiValues).toEqual(backendValues)
    })
  }
})
