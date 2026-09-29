import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Project Pages lives at https://korilakkumaa.github.io/dbs-chi-campus-demo/ .
 * Rollup still emits lazy routes as `import("./PapersPage-….js")`. Some browsers
 * resolve that dynamic specifier from the document URL instead of the module
 * URL, so the request misses `/assets/` and GitHub answers with 404.html
 * (`text/html`). The loader then reports
 * "Failed to fetch dynamically imported module".
 */
const pagesBase = '/dbs-chi-campus-demo/'

function absoluteDynamicChunkImports(base: string): Plugin {
  const prefix = base.endsWith('/') ? base : `${base}/`
  const dynamicImportRe = /import\(\s*(['"`])(\.\.?\/[^'"`]+)\1\s*\)/g
  return {
    name: 'absolute-dynamic-chunk-imports',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        chunk.code = chunk.code.replace(dynamicImportRe, (full, quote: string, spec: string) => {
          const resolved = path.posix.normalize(
            path.posix.join(path.posix.dirname(chunk.fileName), spec),
          )
          if (resolved.startsWith('..')) return full
          return `import(${quote}${prefix}${resolved}${quote})`
        })
      }
    },
  }
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react(), absoluteDynamicChunkImports(pagesBase)],
  base: command === 'build' || isPreview ? pagesBase : '/',
  build: {
    outDir: 'docs',
  },
}))
