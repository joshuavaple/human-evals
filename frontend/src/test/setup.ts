import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  // Unmount rendered components after each test. Testing Library only does this
  // automatically when Vitest globals are enabled, which this project doesn't use.
  cleanup()
  // Forget calls made to mocked functions, so each test starts counting from zero.
  vi.clearAllMocks()
})
