/**
 * Flush queued ABS reminder emails via Resend.
 *
 *   npm run process:homework-abs-mail
 *   npm run process:homework-abs-mail -- --id=mail-xxx
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { processQueuedHomeworkAbsEmails } from './lib/processHomeworkAbsEmails'

config({ path: '.env.local' })
config()

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  const idFlag = process.argv.find((a) => a.startsWith('--id='))
  const logId = idFlag?.slice('--id='.length)
  const client = createClient(url, key)
  const result = await processQueuedHomeworkAbsEmails(client, { logId })
  console.log(result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
