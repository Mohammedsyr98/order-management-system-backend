import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'dist/**'],
    fileParallelism: false,
    setupFiles: ['src/test/setup-env.ts'],
    testTimeout: 15_000,
  },
});
