/**
 * Fail the Pages build if the Vite bundle was produced without
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (null supabase client).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const indexPath = join(root, 'docs', 'index.html')

if (!existsSync(indexPath)) {
  console.error('verify-pages-supabase: docs/index.html missing — run vite build first.')
  process.exit(1)
}

const indexHtml = readFileSync(indexPath, 'utf8')
const match = indexHtml.match(/assets\/(index-[^"'>\s]+\.js)/)
if (!match) {
  console.error('verify-pages-supabase: no docs/assets/index-*.js referenced in docs/index.html')
  process.exit(1)
}

const jsPath = join(root, 'docs', 'assets', match[1])
if (!existsSync(jsPath)) {
  console.error(`verify-pages-supabase: missing ${jsPath}`)
  process.exit(1)
}

const expectedUrl =
  process.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ||
  'https://heriailewjegnisaqiir.supabase.co'
const projectRef = new URL(expectedUrl).hostname.split('.')[0]

const bundle = readFileSync(jsPath, 'utf8')
const hasUrl = bundle.includes(projectRef) && bundle.includes('supabase.co')
const hasJwt = bundle.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')

if (!hasUrl || !hasJwt) {
  console.error(
    [
      'verify-pages-supabase: Pages bundle is missing Supabase client config.',
      `  checked: docs/assets/${match[1]}`,
      `  has project ref (${projectRef}): ${hasUrl}`,
      `  has anon JWT prefix: ${hasJwt}`,
      '',
      'Fix: ensure .env.production (or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)',
      'is available at build time, then re-run npm run build.',
      'Do not push docs/ until this check passes.',
    ].join('\n'),
  )
  process.exit(1)
}

console.log(
  `verify-pages-supabase: ok — docs/assets/${match[1]} includes Supabase URL + anon key.`,
)
