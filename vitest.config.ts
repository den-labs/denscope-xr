import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
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
