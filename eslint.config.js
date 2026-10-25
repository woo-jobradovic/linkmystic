import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/engine/**/*.js', 'src/main/**/*.js', 'scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['src/main/preload.cjs', 'src/main/preload-lcd.cjs', 'scripts/**/*.cjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: { ...globals.node, window: 'readonly' } },
  },
  {
    files: ['src/renderer/**/*.js', 'src/lcd/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, ImageDecoder: 'readonly' } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
];
