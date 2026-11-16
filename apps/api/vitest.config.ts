import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(__filename);

export default defineConfig({
  resolve: {
    // Use graphql's CJS build everywhere, like Node does at runtime. Otherwise
    // test code gets the ESM build and Yoga the CJS one: two GraphQLError classes.
    alias: { graphql: require.resolve('graphql') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup-env.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    // Integration tests share one Postgres; run files one at a time.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
