import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React Testing Library does not auto-clean up between tests under Vitest's
// default config, so unmount and clear the DOM after every test.
afterEach(() => {
  cleanup()
})
