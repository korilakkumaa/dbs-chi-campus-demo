/**
 * Attach 2024/25 G7 Chinese scores to the official name list.
 *
 *   npm run import:roster:2425
 *   npm run import:scores:2425-g7
 *   npm run import:scores:2425-g7:second
 *
 * Second-semester 級排名 uses CA 30 + 卷一 35 + 卷二 35. Values are stored as
 * junior 20/40/40 contributions so 2025/26 G8 tracking charts stay consistent.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { basename } from 'node:path'
import xlsx from 'xlsx'
import { storedStudentNo } from '../src/data/campusScoresYear'

const XLSX = xlsx

config({ path: '.env.local' })
config()

const ACADEMIC_YEAR_START = 2024
const GRADE = 7
const SECOND = process.argv.includes('--second')
const SEMESTER = (SECOND ? 'second' : 'first') as 'first' | 'second'
const FIRST_PATH =
  "/Users/apple/Library/CloudStorage/OneDrive-DiocesanBoys'School/Chinese Language G7/Administration/2425/登分資料/G7 全級評語及排名.xlsx"
const SECOND_PATH =
  "/Users/apple/Library/CloudStorage/OneDrive-DiocesanBoys'School/Chinese Language G7/Administration/2425/登分資料/2024-25_中一_下學期_級排名.xlsx"
const DEFAULT_PATH = SECOND ? SECOND_PATH : FIRST_PATH

/** Second-semester 級排名 weights (CA 30 / 卷一 35 / 卷二 35). */
const SECOND_CA_MAX = 30
const SECOND_PAPER_WEIGHT = 35

type RosterRow = {
  student_no: string
  class_id: string
  class_number: number
  name_zh: string
  name_en: string
  teaching_group: string
  academic_year_start: number
}

type SemesterRow = {
  student_no: string
  academic_year_start: number
  grade: number
  semester: 'first' | 'second'
  daily: number
  reading: number
  writing: number
  components: Record<string, number | string>
  attitude_grade: string
  remarks: string
  source_file: string
}

function classNameToId(name: string): string {
  return `c-${name.toLowerCase().replace(/\s+/g, '-')}`
}

function excelClassToName(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const s = String(raw).trim().replace(/\s+/g, ' ')
  const rSplit = s.match(/^G?(\d+)R_([A-Za-z])$/i)
  if (rSplit) return `${rSplit[1]}R_${rSplit[2].toUpperCase()}`
  const ec = s.match(/^G?\s*(\d+)\s*EC$/i)
  if (ec) return `G${ec[1]} EC`
  const form = s.match(/^G?(\d+)([A-Za-z])$/i)
  if (form) return `${form[1]}${form[2].toUpperCase()}`
  return s
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/%/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizeZh(name: string): string {
  return name.normalize('NFKC').replace(/[\s\u3000]+/g, '').trim()
}

function normalizeEn(name: string): string {
  return name.normalize('NFKC').toUpperCase().replace(/[^A-Z]/g, '')
}

function identityKey(zh: string, en: string): string | null {
  const z = normalizeZh(zh)
  const e = normalizeEn(en)
  if (z && e) return `ze:${z}|${e}`
  if (e.length >= 4) return `e:${e}`
  if (z) return `z:${z}`
  return null
}

function isRemedialScoreClass(name: string): boolean {
  return /^\d+R_/i.test(name)
}

async function upsertChunks<T extends Record<string, unknown>>(
  client: ReturnType<typeof createClient>,
  table: string,
  rows: T[],
  onConflict: string,
) {
  const size = 200
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await client.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(`${table} upsert failed: ${error.message}`)
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`)
  }
}

async function fetchRoster(
  client: ReturnType<typeof createClient>,
): Promise<RosterRow[]> {
  const page = 1000
  const all: RosterRow[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from('students')
      .select(
        'student_no, class_id, class_number, name_zh, name_en, teaching_group, academic_year_start',
      )
      .eq('academic_year_start', ACADEMIC_YEAR_START)
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    all.push(...((data ?? []) as RosterRow[]))
    if ((data ?? []).length < page) break
  }
  return all
}

function matchRoster(
  roster: RosterRow[],
  className: string,
  classNumber: number,
  nameZh: string,
  nameEn: string,
): RosterRow | null {
  if (!isRemedialScoreClass(className)) {
    const classId = classNameToId(className)
    const byClassNo = roster.filter(
      (row) => row.class_id === classId && row.class_number === classNumber,
    )
    if (byClassNo.length === 1) {
      const hit = byClassNo[0]
      const key = identityKey(nameZh, nameEn)
      const hitKey = identityKey(hit.name_zh, hit.name_en)
      if (!key || !hitKey || key === hitKey) return hit
    }
  }

  const key = identityKey(nameZh, nameEn)
  if (!key) return null
  const gradeMates = roster.filter((row) =>
    row.class_id.startsWith(`c-${GRADE}`),
  )
  const named = gradeMates.filter(
    (row) => identityKey(row.name_zh, row.name_en) === key,
  )
  if (named.length === 1) return named[0]
  return null
}

function juniorFromSecondSemester(row: unknown[]): {
  daily: number
  reading: number
  writing: number
  components: Record<string, number | string>
  attitude: string
  comment: string
} {
  const ca30 = Math.min(SECOND_CA_MAX, Math.max(0, toNum(row[16]) ?? 0))
  const paper1Raw = toNum(row[17])
  const paper1W = toNum(row[18])
  const paper2Raw = toNum(row[19])
  const paper2W = toNum(row[20])
  const total = toNum(row[21])
  const attitude = String(row[22] ?? '').trim()
  const comment = String(row[23] ?? '').trim()

  const daily = round2((ca30 / SECOND_CA_MAX) * 20)
  const reading = round2(
    paper1Raw != null
      ? (paper1Raw / 100) * 40
      : ((paper1W ?? 0) / SECOND_PAPER_WEIGHT) * 40,
  )
  const writing = round2(
    paper2Raw != null
      ? (paper2Raw / 100) * 40
      : ((paper2W ?? 0) / SECOND_PAPER_WEIGHT) * 40,
  )

  const components: Record<string, number | string> = {
    'Class Assignments Score': daily,
    'Reading Score': reading,
    'Writing Score': writing,
    CAmax: SECOND_CA_MAX,
  }
  const labels: [number, string][] = [
    [4, '實用文（一）'],
    [5, '實用文（二）'],
    [6, '作文（一）'],
    [7, '作文（二）'],
    [8, '作文（三）'],
    [9, '作文（四）'],
    [10, '作文加权'],
    [11, '廣泛閱讀'],
    [12, '聆聽'],
    [13, '測驗'],
    [14, '說話'],
    [15, '平時'],
    [16, 'C.A'],
  ]
  for (const [i, label] of labels) {
    const n = toNum(row[i])
    if (n != null) components[label] = n
  }
  if (paper1Raw != null) components['卷一'] = paper1Raw
  if (paper2Raw != null) components['卷二'] = paper2Raw
  if (total != null) components['總分'] = round2(total)
  if (attitude) components['學習態度等第'] = attitude
  if (comment) components['評語'] = comment

  return { daily, reading, writing, components, attitude, comment }
}

function juniorFromFirstSemester(row: unknown[]): {
  daily: number
  reading: number
  writing: number
  components: Record<string, number | string>
  attitude: string
  comment: string
} {
  const essay1 = toNum(row[4])
  const essay2 = toNum(row[5])
  const essay3 = toNum(row[6])
  const caEssay = toNum(row[7])
  const caAttitude = toNum(row[8])
  const caSpeaking = toNum(row[9])
  const caQuiz = toNum(row[10])
  const caReport = toNum(row[11])
  const caListen = toNum(row[12])
  const ca = toNum(row[13]) ?? 0
  const paper1Raw = toNum(row[14])
  const paper1 = toNum(row[15]) ?? 0
  const paper2Raw = toNum(row[16])
  const paper2 = toNum(row[17]) ?? 0
  const total = toNum(row[18])
  const attitude = String(row[19] ?? '').trim()
  const comment = String(row[20] ?? '').trim()

  const components: Record<string, number | string> = {
    'Class Assignments Score': round2(ca),
    'Reading Score': round2(paper1),
    'Writing Score': round2(paper2),
  }
  if (essay1 != null) components['作文（一）'] = essay1
  if (essay2 != null) components['作文（二）'] = essay2
  if (essay3 != null) components['作文（三）'] = essay3
  if (caEssay != null) components['作文加权'] = round2(caEssay)
  if (caAttitude != null) components['學習態度'] = caAttitude
  if (caSpeaking != null) components['說話'] = caSpeaking
  if (caQuiz != null) components['測驗'] = caQuiz
  if (caReport != null) components['閱讀報告'] = caReport
  if (caListen != null) components['聆聽'] = caListen
  if (paper1Raw != null) components['卷一'] = paper1Raw
  if (paper2Raw != null) components['卷二'] = paper2Raw
  if (total != null) components['總分'] = round2(total)
  if (attitude) components['學習態度等第'] = attitude
  if (comment) components['評語'] = comment

  return {
    daily: round2(ca),
    reading: round2(paper1),
    writing: round2(paper2),
    components,
    attitude,
    comment,
  }
}

function isHeaderRow(
  className: string | null,
  nameZh: string,
  nameEn: string,
  attitude: string,
): boolean {
  if (!className || !nameZh) return true
  if (attitude === '態度' || nameZh === 'Cname') return true
  if (nameEn === 'Name of Applicant' || nameZh === 'Chi. N.') return true
  return false
}

function parseScoreRows(
  path: string,
  roster: RosterRow[],
): {
  semesterRows: SemesterRow[]
  teachingUpdates: RosterRow[]
  skipped: number
  unmatched: string[]
} {
  const wb = XLSX.readFile(path, { cellDates: false })
  const sheetNames = SECOND
    ? wb.SheetNames
    : [wb.Sheets['級評語'] ? '級評語' : wb.SheetNames[0]]
  const sourceFile = basename(path)
  const semesterRows: SemesterRow[] = []
  const teachingByNo = new Map<string, RosterRow>()
  const seen = new Set<string>()
  const unmatched: string[] = []
  let skipped = 0

  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    })

    for (const row of rows.slice(1)) {
      if (!row?.length) continue
      const className = excelClassToName(row[0])
      const classNumber = toNum(row[1])
      const nameEn = String(row[2] ?? '').trim()
      const nameZh = String(row[3] ?? '').trim()
      const attitudeGuess = String(
        (SECOND ? row[22] : row[19]) ?? '',
      ).trim()
      if (
        classNumber == null ||
        isHeaderRow(className, nameZh, nameEn, attitudeGuess)
      ) {
        skipped += 1
        continue
      }

      const matched = matchRoster(
        roster,
        className!,
        classNumber,
        nameZh,
        nameEn,
      )
      if (!matched) {
        unmatched.push(
          `${sheetName} ${className} ${classNumber} ${nameZh} / ${nameEn}`,
        )
        continue
      }

      if (isRemedialScoreClass(className!)) {
        teachingByNo.set(matched.student_no, {
          ...matched,
          teaching_group: className!,
        })
      }

      if (seen.has(matched.student_no)) continue
      seen.add(matched.student_no)

      const parsed = SECOND
        ? juniorFromSecondSemester(row)
        : juniorFromFirstSemester(row)

      semesterRows.push({
        student_no: matched.student_no,
        academic_year_start: ACADEMIC_YEAR_START,
        grade: GRADE,
        semester: SEMESTER,
        daily: parsed.daily,
        reading: parsed.reading,
        writing: parsed.writing,
        components: parsed.components,
        attitude_grade: parsed.attitude,
        remarks: parsed.comment,
        source_file: sourceFile,
      })
    }
  }

  return {
    semesterRows,
    teachingUpdates: [...teachingByNo.values()],
    skipped,
    unmatched,
  }
}

async function main() {
  const file = process.argv.find((a) => a.endsWith('.xlsx')) ?? DEFAULT_PATH
  console.log(
    `Academic year: 2024/25  G7 ${SEMESTER}  file=${basename(file)}`,
  )

  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const roster = (await fetchRoster(client)).filter((row) =>
    row.student_no.startsWith(`y${ACADEMIC_YEAR_START}-`),
  )
  if (roster.length === 0) {
    throw new Error(
      'No 2024/25 name-list rows found. Run `npm run import:roster:2425` first.',
    )
  }
  console.log(`Name list roster: ${roster.length}`)

  const { semesterRows, teachingUpdates, skipped, unmatched } = parseScoreRows(
    file,
    roster,
  )
  console.log(
    `Scores matched=${semesterRows.length} skipped=${skipped} unmatched=${unmatched.length}`,
  )
  if (unmatched.length) {
    console.log('Unmatched sample:')
    for (const line of unmatched.slice(0, 20)) console.log('  ', line)
  }

  if (!SECOND) {
    const leftover = await client
      .from('students')
      .select('student_no')
      .eq('academic_year_start', ACADEMIC_YEAR_START)
      .like('student_no', '2425-%')
    const leftoverNos = (leftover.data ?? []).map(
      (row: { student_no: string }) => row.student_no,
    )
    if (leftoverNos.length) {
      console.log(`Deleting ${leftoverNos.length} synthetic 2425-* roster rows…`)
      const { error } = await client
        .from('students')
        .delete()
        .eq('academic_year_start', ACADEMIC_YEAR_START)
        .like('student_no', '2425-%')
      if (error) throw new Error(`delete synthetic students: ${error.message}`)
    }
  }

  console.log('\nUpserting via service role…')
  if (teachingUpdates.length) {
    await upsertChunks(client, 'students', teachingUpdates, 'student_no')
  }
  await upsertChunks(
    client,
    'semester_records',
    semesterRows.map((row) => ({ ...row })),
    'student_no,academic_year_start,semester',
  )
  console.log('\nDone.')
  console.log(
    `Expected stored student_no example: ${storedStudentNo(ACADEMIC_YEAR_START, 'STID')}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
