import { baseConfig } from '../../packages/config/eslint.base.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Nest relies on parameter decorators and DI metadata; empty constructors
      // with only `private readonly` params are idiomatic, not dead code.
      '@typescript-eslint/no-useless-constructor': 'off',
    },
  },
];
