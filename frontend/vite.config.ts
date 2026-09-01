import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { credoraApiPlugin } from './vite-api-plugin'

// Dev server port. Indexer CORS defaults to http://localhost:3100.
export default defineConfig({
  plugins: [react(), credoraApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3100,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
