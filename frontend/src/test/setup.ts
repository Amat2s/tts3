import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// React Testing Library does not auto-clean up between tests under Vitest's
// default config, so unmount and clear the DOM after every test.
afterEach(() => {
  cleanup()
})

// jsdom does not implement ResizeObserver — stub it so components that use it
// for layout measurement don't throw in tests.
if (typeof ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    constructor(_callback: ResizeObserverCallback) {}
  }
  ;(globalThis as unknown as Record<string, unknown>).ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver
}
