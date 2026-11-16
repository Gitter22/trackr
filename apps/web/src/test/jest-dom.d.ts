import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// jest-dom's bundled types target Vitest's older Assertion<T>; Vitest 5 is Assertion<R, T>.
// Merge the matchers into Vitest 5's Matchers interface instead.
declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
