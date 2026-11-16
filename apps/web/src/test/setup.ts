import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Register jest-dom on this workspace's Vitest. ('@testing-library/jest-dom/vitest'
// would resolve the API's hoisted Vitest 3 and extend the wrong expect.)
expect.extend(matchers);
afterEach(() => cleanup());
