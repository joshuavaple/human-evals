/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where the FastAPI backend runs during development (see ../backend).
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Lets code import from '@/features/...' instead of long '../../..' paths.
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    // The browser only talks to the Vite dev server; requests to /api are
    // forwarded to the backend, so no CORS setup is needed.
    proxy: { '/api': BACKEND_URL },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
