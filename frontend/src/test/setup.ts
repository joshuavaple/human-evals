import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components after each test. Testing Library only does this
// automatically when Vitest globals are enabled, which this project doesn't use.
afterEach(cleanup)
