import { defineConfig } from 'vitest/config'

// Unit tests: no database, no network. Database tests live in test/db and use vitest.db.config.ts.
export default defineConfig({
  test: { environment: 'node', include: ['test/unit/**/*.test.ts'] },
})
