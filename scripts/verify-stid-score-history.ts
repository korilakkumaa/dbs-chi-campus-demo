/**
 * Verify STID-only history linking against Supabase (read-only).
 *
 *   npx tsx scripts/verify-stid-score-history.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { officialStudentNo } from '../src/data/campusScoresYear'

config({ path: '.env.local' })
config()

const ROSTER_YEAR = 2026
const PAGE = 1000

type StudentRow = {
  student_no: string
  class_id: string
  academic_year_start: number
}

type SemesterRow = {
  student_no: string
  academic_year_start: number
  grade: number
  semester: string
  source_file: string | null
}

async function fetchAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}

function gradeFromClassId(classId: string): number | null {
  const match = classId.match(/^c-g?(\d+)/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/** Same rule as supabaseStudents.linkedStudentNos (STID only). */
function linkedNosFor(
  roster: StudentRow,
  rowsByYear: Map<number, StudentRow[]>,
): Set<string> {
  const nos = new Set<string>([roster.student_no])
  const official = officialStudentNo(roster.student_no)
  const priorYears = [...rowsByYear.keys()]
    .filter((year) => year < roster.academic_year_start)
    .sort((a, b) => b - a)
  for (const year of priorYears) {
    const hits = (rowsByYear.get(year) ?? []).filter(
      (row) => officialStudentNo(row.student_no) === official,
    )
    if (hits.length === 1) nos.add(hits[0].student_no)
  }
  return nos
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Need VITE_SUPABASE_URL and a Supabase key in .env.local')
    process.exit(1)
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const allStudents = await fetchAll<StudentRow>((from, to) =>
    client
      .from('students')
      .select('student_no, class_id, academic_year_start')
      .lte('academic_year_start', ROSTER_YEAR)
      .range(from, to),
  )

  const rowsByYear = new Map<number, StudentRow[]>()
  for (const row of allStudents) {
    const list = rowsByYear.get(row.academic_year_start) ?? []
    list.push(row)
    rowsByYear.set(row.academic_year_start, list)
  }

  const roster = rowsByYear.get(ROSTER_YEAR) ?? []
  const priorStids = new Set(
    allStudents
      .filter((s) => s.academic_year_start < ROSTER_YEAR)
      .map((s) => officialStudentNo(s.student_no)),
  )

  const records = await fetchAll<SemesterRow>((from, to) =>
    client
      .from('semester_records')
      .select('student_no, academic_year_start, grade, semester, source_file')
      .lte('academic_year_start', ROSTER_YEAR)
      .range(from, to),
  )

  const { count: syncLeft, error: syncErr } = await client
    .from('semester_records')
    .select('student_no', { count: 'exact', head: true })
    .like('source_file', 'sync2627:%')
  if (syncErr) throw new Error(syncErr.message)

  let continuingWithHistory = 0
  let continuingWithoutHistory = 0
  let transfersWithPriorHistory = 0
  let transfersClean = 0
  const transferSamples: string[] = []
  let syncIgnored = 0

  for (const s of roster) {
    const official = officialStudentNo(s.student_no)
    const linked = linkedNosFor(s, rowsByYear)
    const currentGrade = gradeFromClassId(s.class_id)
    const history = records.filter((r) => {
      if (r.academic_year_start > ROSTER_YEAR) return false
      if (r.source_file?.startsWith('sync2627:')) {
        syncIgnored++
        return false
      }
      if (linked.has(r.student_no)) return true
      if (r.student_no === s.student_no) return true
      return (
        r.academic_year_start < ROSTER_YEAR &&
        officialStudentNo(r.student_no) === official
      )
    })

    const priorRecords = history.filter((r) => {
      if (r.academic_year_start >= ROSTER_YEAR) return false
      if (currentGrade == null) return true
      // display grade would be currentGrade - (rosterYear - recordYear)
      const display = currentGrade - (ROSTER_YEAR - r.academic_year_start)
      return display < currentGrade && display >= 7
    })

    const hadPriorRoster = priorStids.has(official)
    const hasPriorScores = priorRecords.length > 0

    if (hadPriorRoster) {
      if (hasPriorScores) continuingWithHistory++
      else continuingWithoutHistory++
    } else if (hasPriorScores) {
      transfersWithPriorHistory++
      if (transferSamples.length < 8) {
        transferSamples.push(
          `${official} class=${s.class_id} priorYears=${[
            ...new Set(priorRecords.map((r) => r.academic_year_start)),
          ].join(',')}`,
        )
      }
    } else {
      transfersClean++
    }
  }

  console.log(`Roster year ${ROSTER_YEAR}: ${roster.length} students`)
  console.log(`Remaining sync2627 rows in DB: ${syncLeft ?? 0}`)
  console.log(
    `Continuing (STID in prior year): ${continuingWithHistory} with prior scores, ${continuingWithoutHistory} without`,
  )
  console.log(
    `No prior STID (likely transfer/new): ${transfersClean} clean, ${transfersWithPriorHistory} still show prior grades`,
  )
  if (transferSamples.length) {
    console.log('Samples with unexpected prior history:')
    for (const line of transferSamples) console.log(`  ${line}`)
  }

  let failed = false
  if ((syncLeft ?? 0) > 0) {
    console.error(`\nWARN: ${syncLeft} sync2627 rows remain — run cleanup:sync2627-scores`)
  }
  if (transfersWithPriorHistory > 0) {
    console.error(
      `\nFAIL: ${transfersWithPriorHistory} students without prior-year roster STID still resolve older scores.`,
    )
    failed = true
  }
  if (continuingWithHistory === 0 && roster.length > 0) {
    console.error(
      '\nFAIL: no continuing students have prior scores — STID linking may be broken.',
    )
    failed = true
  }

  if (failed) process.exit(1)
  console.log('\nOK: STID-only history; transfers without prior STID have no older scores.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
