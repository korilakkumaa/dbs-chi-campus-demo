import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Basenames that start with "ad" (adminYearImport, AdminPage) are blocked by
 * some ad blockers and school filters. 出卷 always loads the year-import chunk,
 * so those users see "Failed to fetch dynamically imported module".
 * A name may still contain "ad" later (academicYear) — only the prefix is unsafe.
 */
function chunkFileNames(chunk: { name: string }): string {
  const base = chunk.name.split('/').pop() || 'chunk'
  const blockedPrefix = /^(ad|track)|analytic|banner|sponsor/i.test(base)
  return `assets/${blockedPrefix ? 'm' : base}-[hash].js`
}

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'docs',
    rolldownOptions: {
      output: {
        chunkFileNames,
      },
    },
  },
})
