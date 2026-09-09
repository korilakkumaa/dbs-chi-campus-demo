/**
 * Delete semester_records copied by sync-prior-scores-to-2627
 * (source_file LIKE 'sync2627:%'). Prior-year history for continuing
 * students is shown via STID linking in fetchCampusStudentsFromSupabase;
 * these denormalized copies caused transfer students to inherit wrong scores.
 *
 *   npm run cleanup:sync2627-scores
 *   npm run cleanup:sync2627-scores -- --sql   # write SQL only
 *   npm run cleanup:sync2627-scores -- --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'

config({ path: '.env.local' })
config()

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sqlOnly = process.argv.includes('--sql')
  const dryRun = process.argv.includes('--dry-run')

  const deleteSql = [
    '-- Remove denormalized prior-year copies from sync-prior-scores-to-2627',
    "-- Continuing students' history is linked at read time by official STID.",
    "delete from public.semester_records where source_file like 'sync2627:%';",
    '',
  ].join('\n')

  if (sqlOnly) {
    mkdirSync('scripts/out', { recursive: true })
    const path = 'scripts/out/cleanup-sync2627-scores.sql'
    writeFileSync(path, deleteSql, 'utf8')
    console.log(`Wrote ${path}`)
    return
  }

  if (!url || !serviceKey) {
    console.error('Need SUPABASE_SERVICE_ROLE_KEY (or pass --sql)')
    process.exit(1)
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { count, error: countError } = await client
    .from('semester_records')
    .select('student_no', { count: 'exact', head: true })
    .like('source_file', 'sync2627:%')

  if (countError) throw new Error(countError.message)

  console.log(`Found ${count ?? 0} semester_records with source_file like sync2627:%`)

  if (dryRun) {
    console.log('Dry run — no rows deleted.')
    return
  }

  if ((count ?? 0) === 0) {
    console.log('Nothing to delete.')
    return
  }

  const { error: delError, count: deleted } = await client
    .from('semester_records')
    .delete({ count: 'exact' })
    .like('source_file', 'sync2627:%')

  if (delError) throw new Error(delError.message)

  const { count: left, error: leftError } = await client
    .from('semester_records')
    .select('student_no', { count: 'exact', head: true })
    .like('source_file', 'sync2627:%')

  if (leftError) throw new Error(leftError.message)
  console.log(`Deleted ${deleted ?? count ?? 0} rows. Remaining sync2627 rows: ${left ?? 0}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
