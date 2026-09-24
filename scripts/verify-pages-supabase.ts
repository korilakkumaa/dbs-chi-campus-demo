/**
 * Fail the Pages build if the Vite bundle was produced without
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (null supabase client).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const indexPath = join(root, 'docs', 'index.html')
const assetsDir = join(root, 'docs', 'assets')

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

const indexJsPath = join(assetsDir, match[1])
if (!existsSync(indexJsPath)) {
  console.error(`verify-pages-supabase: missing ${indexJsPath}`)
  process.exit(1)
}

const expectedUrl =
  process.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ||
  'https://heriailewjegnisaqiir.supabase.co'
const projectRef = new URL(expectedUrl).hostname.split('.')[0]
const jwtPrefix = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

// Supabase client may live in a lazy/split chunk (e.g. AuthContext-*.js), not only index-*.js.
const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
  : []

let hasUrl = false
let hasJwt = false
let foundIn: string | null = null
for (const name of jsFiles) {
  const bundle = readFileSync(join(assetsDir, name), 'utf8')
  const urlOk = bundle.includes(projectRef) && bundle.includes('supabase.co')
  const jwtOk = bundle.includes(jwtPrefix)
  if (urlOk) hasUrl = true
  if (jwtOk) hasJwt = true
  if (urlOk && jwtOk && !foundIn) foundIn = name
  if (hasUrl && hasJwt) break
}

if (!hasUrl || !hasJwt) {
  console.error(
    [
      'verify-pages-supabase: Pages bundle is missing Supabase client config.',
      `  checked: docs/assets/*.js (${jsFiles.length} files; entry ${match[1]})`,
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
  `verify-pages-supabase: ok — docs/assets/${foundIn ?? match[1]} includes Supabase URL + anon key.`,
)
