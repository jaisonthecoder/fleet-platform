/**
 * dependency-cruiser boundary rules (enforced in CI).
 * Protects the locked architecture: the telemetry ingest pipe must never reach
 * into request-path feature modules, and no cycles are allowed.
 */
module.exports = {
  forbidden: [
    {
      name: 'ingest-must-not-import-request-path',
      comment:
        'telematics-ingest is a dumb pipe; it must never import request-path feature modules (ADR-006).',
      severity: 'error',
      from: { path: '^src/modules/telematics/ingest' },
      to: {
        path: '^src/modules/(operations|bookings|entitlements|handover|fines|compliance)',
      },
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies indicate a broken boundary.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-spec',
      comment: 'Production code must not import test/spec files.',
      severity: 'error',
      from: { pathNot: '\\.spec\\.ts$' },
      to: { path: '\\.spec\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
