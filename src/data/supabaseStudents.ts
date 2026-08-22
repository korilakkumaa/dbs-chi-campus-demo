import type { SupabaseClient } from '@supabase/supabase-js'
import type { SemesterScores, Student, YearRecord } from '../types'
import { subjectMaxForGrade } from './yearScoring'
import { supabase } from '../lib/supabase'

type StudentRow = {
  student_no: string
  class_id: string
  class_number: number
  name_zh: string
  name_en: string
  teaching_group: string
  academic_year_start: number
  house?: string | null
  french?: boolean | null
  roster_remarks?: string | null
}

type SemesterRow = {
  student_no: string
  academic_year_start: number
  grade: number
  semester: 'first' | 'second'
  daily: number
  reading: number
  writing: number
  components: Record<string, number | string> | null
  attitude_grade: string | null
  remarks: string | null
}

/** PostgREST defaults to max 1000 rows — page until exhausted. */
const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  buildPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[] | null; error: string | null }> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await buildPage(from, to)
    if (error) return { data: null, error: error.message }
    const page = data ?? []
    all.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { data: all, error: null }
}

function roundScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)))
}

/** Excel weighted contribution (CA≤20, reading≤40, writing≤45). */
function roundWeighted(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.max(0, n) * 10) / 10
}

function recentFromComponents(
  components: Record<string, number | string> | null | undefined,
): { label: string; score: number }[] {
  if (!components) return []
  const wanted: { match: (k: string) => boolean; label: string }[] = [
    { match: (k) => k.includes('測驗') || k.includes('統測'), label: '測驗' },
    { match: (k) => k.includes('卷一'), label: '卷一' },
    { match: (k) => k.includes('卷二'), label: '卷二' },
    {
      match: (k) => k.includes('作文（一）') || k.includes('作文 (一)'),
      label: '作文一',
    },
  ]
  const out: { label: string; score: number }[] = []
  for (const w of wanted) {
    for (const [k, v] of Object.entries(components)) {
      if (!w.match(k.toLowerCase()) && !w.match(k)) continue
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n)) continue
      // Scale sub-max marks roughly toward 0–100 for display.
      let score = n
      if (k.includes('測驗') && n <= 45) score = (n / 45) * 100
      out.push({ label: w.label, score: roundScore(score) })
      break
    }
  }
  return out.slice(0, 4)
}

function componentNumber(
  components: Record<string, number | string> | null | undefined,
  keys: string[],
): number | null {
  if (!components) return null
  const entries = Object.entries(components)
  for (const want of keys) {
    const wantNorm = want.toLowerCase()
    for (const [k, v] of entries) {
      if (k.toLowerCase() !== wantNorm) continue
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

/**
 * Build 0–100 raw scores for yearScoring.
 * Prefer Excel summary fields (weighted contributions) and convert to raw;
 * fall back to daily/reading/writing columns.
 */
function scoresFromSemesterRow(r: SemesterRow): SemesterScores {
  const weighted = weightedScoresFromSemesterRow(r)
  const max = subjectMaxForGrade(r.grade)
  return {
    daily: roundScore(max.daily > 0 ? (weighted.daily / max.daily) * 100 : 0),
    reading: roundScore(
      max.reading > 0 ? (weighted.reading / max.reading) * 100 : 0,
    ),
    writing: roundScore(
      max.writing > 0 ? (weighted.writing / max.writing) * 100 : 0,
    ),
  }
}

/**
 * Excel semester weighted contributions (grade band: junior 20/40/40, senior 15/40/45).
 * Prefer summary fields; reading/writing columns are already contributions.
 */
function weightedScoresFromSemesterRow(r: SemesterRow): SemesterScores {
  const ca = componentNumber(r.components, [
    'class assignments score',
    'c.a%',
    'ca分 %',
    'ca分%',
  ])
  const readingContrib = componentNumber(r.components, [
    'reading score',
    '卷一 %',
    '卷一%',
  ])
  const writingContrib = componentNumber(r.components, [
    'writing score',
    '卷二 %',
    '卷二%',
  ])

  if (ca != null && readingContrib != null && writingContrib != null) {
    return {
      daily: roundWeighted(ca),
      reading: roundWeighted(readingContrib),
      writing: roundWeighted(writingContrib),
    }
  }

  const colDaily = Number(r.daily)
  const colReading = Number(r.reading)
  const colWriting = Number(r.writing)
  const max = subjectMaxForGrade(r.grade)
  return {
    daily: roundWeighted(
      ca ?? (colDaily > max.daily ? (colDaily / 100) * max.daily : colDaily),
    ),
    reading: roundWeighted(readingContrib ?? colReading),
    writing: roundWeighted(writingContrib ?? colWriting),
  }
}

function buildYearHistory(
  studentNo: string,
  className: string,
  records: SemesterRow[],
): YearRecord[] {
  const byGrade = new Map<
    number,
    { first?: SemesterScores; second?: SemesterScores }
  >()

  for (const r of records) {
    if (r.student_no !== studentNo) continue
    const slot = byGrade.get(r.grade) ?? {}
    const scores = scoresFromSemesterRow(r)
    if (r.semester === 'first') slot.first = scores
    else slot.second = scores
    byGrade.set(r.grade, slot)
  }

  const empty: SemesterScores = { daily: 0, reading: 0, writing: 0 }
  return [...byGrade.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([grade, slot]) => ({
      grade,
      className,
      first: slot.first ?? empty,
      second: slot.second ?? empty,
    }))
}

export async function fetchCampusStudentsFromSupabase(
  academicYearStart: number,
): Promise<Student[] | null> {
  if (!supabase) return null
  const client: SupabaseClient = supabase

  const { data: studentRows, error: studentError } =
    await fetchAllRows<StudentRow>((from, to) =>
      client
        .from('students')
        .select(
          'student_no, class_id, class_number, name_zh, name_en, teaching_group, academic_year_start, house, french, roster_remarks',
        )
        .eq('academic_year_start', academicYearStart)
        .order('class_id')
        .order('class_number')
        .range(from, to),
    )

  if (studentError) {
    console.error('Supabase students:', studentError)
    return null
  }
  if (!studentRows?.length) return []

  const { data: classRows } = await client.from('classes').select('id, name')
  const classNameById = new Map(
    (classRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
  )

  const { data: semesterRows, error: semesterError } =
    await fetchAllRows<SemesterRow>((from, to) =>
      client
        .from('semester_records')
        .select(
          'student_no, academic_year_start, grade, semester, daily, reading, writing, components, attitude_grade, remarks',
        )
        .eq('academic_year_start', academicYearStart)
        .order('student_no')
        .order('grade')
        .order('semester')
        .range(from, to),
    )

  if (semesterError) {
    console.error('Supabase semester_records:', semesterError)
    return null
  }

  const byStudent = new Map<string, SemesterRow[]>()
  for (const row of semesterRows ?? []) {
    const list = byStudent.get(row.student_no) ?? []
    list.push(row)
    byStudent.set(row.student_no, list)
  }

  return studentRows.map((s) => {
    const className = classNameById.get(s.class_id) ?? s.class_id
    const records = byStudent.get(s.student_no) ?? []
    const yearHistory = buildYearHistory(s.student_no, className, records)
    const latestRow =
      records.find((r) => r.semester === 'second') ??
      records.find((r) => r.semester === 'first')
    const latestScores = latestRow
      ? weightedScoresFromSemesterRow(latestRow)
      : { daily: 0, reading: 0, writing: 0 }
    const readingScore = latestScores.reading
    const writingScore = latestScores.writing
    const dailyScore = latestScores.daily

    const noteParts = [
      latestRow?.remarks?.trim(),
      s.roster_remarks?.trim(),
      s.house ? `House: ${s.house}` : '',
    ].filter(Boolean)

    return {
      id: s.student_no,
      name: s.name_zh,
      classId: s.class_id,
      classNumber: s.class_number,
      teachingGroup: s.teaching_group || undefined,
      french: Boolean(s.french),
      progress: dailyScore,
      readingScore,
      correctRate: writingScore,
      recentScores: recentFromComponents(latestRow?.components ?? null),
      yearHistory,
      strengths: [],
      notes: noteParts.join(' · '),
    } satisfies Student
  })
}

export async function fetchCampusClassesFromSupabase(): Promise<
  { id: string; name: string; grade: string; teacherId: string | null }[] | null
> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, teacher_id')
    .order('grade')
    .order('name')

  if (error) {
    console.error('Supabase classes:', error.message)
    return null
  }

  return (data ?? []).map(
    (c: {
      id: string
      name: string
      grade: number
      teacher_id: string | null
    }) => ({
      id: c.id,
      name: c.name,
      grade: `G${c.grade}`,
      teacherId: c.teacher_id,
    }),
  )
}
