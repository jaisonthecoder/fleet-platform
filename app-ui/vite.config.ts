import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
// No dev proxy: the SPA calls the backend directly cross-origin (see
// src/lib/env.ts / VITE_API_URL). The backend permits the frontend origin via
// CORS (CORS_ORIGINS), so browser calls with a Bearer token are allowed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3175,
    strictPort: true,
  },
  preview: {
    port: 3175,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: 4,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 70, branches: 60 },
    },
  },
})
