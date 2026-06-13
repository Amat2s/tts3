import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Dedicated Vitest config (kept separate from vite.config.ts so the production
// build config stays minimal). The Tailwind plugin is intentionally omitted —
// tests assert structure and behavior, not compiled CSS.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
