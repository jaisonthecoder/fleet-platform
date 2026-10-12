/**
 * Self-contained: no `extends` outside this folder, so apps/noatum-customer-portal-ui lints the same
 * whether it sits in the monorepo or on its own.
 *
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  env: { es2022: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist', 'node_modules', 'coverage', 'playwright-report', 'src/api/generated'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // The two apps deploy separately and share no code. The client for this API
            // is generated from its OpenAPI document into src/api/generated.
            group: ['**/noatum-customer-portal-api/src/**', 'noatum-customer-portal-api'],
            message:
              'apps/noatum-customer-portal-ui must not import apps/noatum-customer-portal-api. Generate the client from the OpenAPI document instead.',
          },
          {
            group: ['**/cw1-simulator/**', '@noatum/cw1-simulator'],
            message: 'The CW1 simulator is never imported by the SPA.',
          },
        ],
      },
    ],
  },
};
