import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Next compiles JSX with the automatic runtime, but vitest's esbuild
  // defaults to the classic transform, which expects `React` to be in scope.
  // Every component file here relies on the automatic runtime and imports no
  // React namespace, so rendering one in a test fails with "React is not
  // defined" until this is set. Only surfaced once the first component test
  // was written - the suite was pure logic before that.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // See src/test/server-only-stub.ts. Not a dependency; Next aliases it
      // at build time and vitest otherwise cannot resolve the import.
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
    },
  },
});
