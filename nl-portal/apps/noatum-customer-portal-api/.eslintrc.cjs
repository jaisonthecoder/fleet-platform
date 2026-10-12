/**
 * Self-contained: no `extends` outside this folder, so apps/noatum-customer-portal-api lints the same whether
 * it sits in the monorepo or on its own.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.config.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            // CLAUDE.md rule 1: customer data goes through TenantRepository, which sets
            // the session variables the RLS policies read. A module holding its own
            // client is a query with no tenant scope.
            name: '@prisma/client',
            importNames: ['PrismaClient'],
            message:
              'Inject TenantRepository instead. A raw client bypasses the tenant scoping RLS depends on.',
          },
        ],
        patterns: [
          {
            // The two apps deploy separately and share no code. They talk over HTTP.
            group: ['**/noatum-customer-portal-ui/**', 'noatum-customer-portal-ui'],
            message:
              'apps/noatum-customer-portal-api must not import apps/noatum-customer-portal-ui. They deploy separately and talk over HTTP.',
          },
          {
            // CLAUDE.md rule 8: the simulator is dev/test only, reached via CW1_EADAPTER_URL.
            group: ['**/cw1-simulator/**', '@noatum/cw1-simulator'],
            message:
              'The CW1 simulator is reached over HTTP through configuration, never imported.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.spec.ts', 'test/**/*.ts'],
      rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
    },
  ],
};
