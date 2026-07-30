import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so GitHub Pages works under any repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
})
