import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // NODE_ENV=test makes the logger silent and skips backend/.env, so tests always run on the defaults.
    env: { NODE_ENV: 'test' },
  },
});
