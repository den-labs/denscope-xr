import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Spreading configDefaults is what restores '**/node_modules/**'. Writing a
    // bare `exclude` array replaces Vitest's defaults rather than extending them,
    // and the literal 'node_modules/**' it replaced them with only matches the
    // root-level directory — so dependency tests inside local tooling installs
    // (.kilocode/node_modules, .opencode/node_modules) were being collected.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/lib/**', 'src/stores/**', 'src/config/**', 'src/types/**'],
      exclude: ['**/__tests__/**', '**/test/**', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
