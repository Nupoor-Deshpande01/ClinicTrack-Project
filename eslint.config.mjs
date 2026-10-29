/**
 * ESLint flat config for the whole monorepo.
 * - server/ code runs on Node.js (CommonJS style)
 * - client/ code runs in the browser (ESM + React)
 * - public-site/ is plain static files, nothing to lint there yet.
 */
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    // Ignore generated / third-party output
    ignores: [
      '**/node_modules/**',
      'client/dist/**',
      'server/exports/**',
      'server/backups/**',
      'public-site/assets/vendor/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['server/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off', // props come from well-typed components in this small project
    },
  },
];
