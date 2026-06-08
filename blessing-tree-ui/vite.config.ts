import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const packageJson = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['jspdf', 'konva', 'qrcode', 'react-konva'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('/xlsx/')) {
            return 'vendor-xlsx'
          }
          if (id.includes('/jspdf/')) {
            return 'vendor-jspdf'
          }
          if (id.includes('/html2canvas/')) {
            return 'vendor-html2canvas'
          }
          if (id.includes('/dompurify/')) {
            return 'vendor-dompurify'
          }
          if (id.includes('/konva/') || id.includes('/react-konva/')) {
            return 'vendor-canvas'
          }
          if (id.includes('/qrcode/') || id.includes('/qrcode.react/') || id.includes('/@zxing/')) {
            return 'vendor-qr'
          }
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) {
            return 'vendor-react'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setup-vitest.ts',
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'test-results/**', 'playwright-report/**'],
    maxWorkers: 1,
    testTimeout: 40_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
