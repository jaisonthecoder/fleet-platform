const typescript = require('@typescript-eslint/eslint-plugin');
const prettier = require('eslint-config-prettier');

const boundaries = [
  { group: ['**/noatum-customer-portal-ui/**', 'noatum-customer-portal-ui'], message: 'The API and UI share HTTP contracts, not source imports.' },
  { group: ['**/cw1-simulator/**', '@noatum/cw1-simulator'], message: 'The simulator is reached over HTTP, never imported.' },
];

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  ...typescript.configs['flat/recommended'],
  prettier,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: { experimentalDecorators: true, emitDecoratorMetadata: true },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', {
        paths: [{ name: '@prisma/client', importNames: ['PrismaClient'], message: 'Use TenantRepository for customer data.' }],
        patterns: boundaries,
      }],
    },
  },
  {
    files: ['src/common/tenancy/prisma.service.ts', 'test/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: boundaries }] },
  },
  {
    files: ['src/**/*.spec.ts', 'test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
  },
];
