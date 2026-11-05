import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'preact',
    },
  },
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
    },
    include: ['test/**/*.spec.{ts,tsx}'],
  },
})
