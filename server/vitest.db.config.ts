import { defineConfig } from 'vitest/config'

// Database integration tests against the local nblao_test database (see test/db/globalSetup.ts).
// Files run one at a time because they share one database.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/db/**/*.test.ts'],
    globalSetup: ['test/db/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
