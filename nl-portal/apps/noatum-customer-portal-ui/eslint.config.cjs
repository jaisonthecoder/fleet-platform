const { builtinRules } = require('eslint/use-at-your-own-risk');
const typescript = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-config-prettier');
const legacy = require('./.eslintrc.cjs');

const compatibleReact = {
  ...react,
  rules: Object.fromEntries(
    Object.entries(react.rules).map(([name, rule]) => [
      name,
      {
        ...rule,
        create(context) {
          const compatibleContext = Object.create(context, {
            getFilename: { value: () => context.filename },
            getSourceCode: { value: () => context.sourceCode },
          });
          return rule.create(compatibleContext);
        },
      },
    ]),
  ),
};

module.exports = [
  {
    ignores: legacy.ignorePatterns.map((pattern) => `${pattern}/**`),
  },
  {
    rules: Object.fromEntries(
      [...builtinRules]
        .filter(([, rule]) => rule.meta.docs.recommended)
        .map(([name]) => [name, 'error']),
    ),
  },
  ...typescript.configs['flat/recommended'],
  { ...react.configs.flat.recommended, plugins: { react: compatibleReact } },
  reactHooks.configs.flat.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx,js,jsx,cjs,mjs}'],
    settings: legacy.settings,
    rules: legacy.rules,
  },
];
