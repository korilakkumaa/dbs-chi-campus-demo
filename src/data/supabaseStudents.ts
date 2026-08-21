import type { SemesterScores, Student, YearRecord } from '../types'
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

function roundScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)))
}

function recentFromComponents(
  components: Record<string, number | string> | null | undefined,
): { label: string; score: number }[] {
  if (!components) return []
  const wanted: { match: (k: string) => boolean; label: string }[] = [
    { match: (k) => k.includes('測驗') || k.includes('統測'), label: '測驗' },
    { match: (k) => k.includes('卷一'), label: '卷一' },
    { match: (k) => k.includes('卷二'), label: '卷二' },
    { match: (k) => k.includes('作文（一）') || k.includes('作文 (一)'), label: '作文一' },
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
    const scores: SemesterScores = {
      daily: roundScore(Number(r.daily)),
      reading: roundScore(Number(r.reading)),
      writing: roundScore(Number(r.writing)),
    }
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

export async function fetchCampusStudentsFromSupabase(): Promise<Student[] | null> {
  if (!supabase) return null

  const { data: studentRows, error: studentError } = await supabase
    .from('students')
    .select(
      'student_no, class_id, class_number, name_zh, name_en, teaching_group, academic_year_start, house, french, roster_remarks',
    )
    .eq('academic_year_start', 2025)
    .order('class_id')
    .order('class_number')

  if (studentError) {
    console.error('Supabase students:', studentError.message)
    return null
  }
  if (!studentRows?.length) return []

  const { data: classRows } = await supabase.from('classes').select('id, name')
  const classNameById = new Map(
    (classRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
  )

  const { data: semesterRows, error: semesterError } = await supabase
    .from('semester_records')
    .select(
      'student_no, academic_year_start, grade, semester, daily, reading, writing, components, attitude_grade, remarks',
    )
    .eq('academic_year_start', 2025)

  if (semesterError) {
    console.error('Supabase semester_records:', semesterError.message)
    return null
  }

  const byStudent = new Map<string, SemesterRow[]>()
  for (const row of (semesterRows ?? []) as SemesterRow[]) {
    const list = byStudent.get(row.student_no) ?? []
    list.push(row)
    byStudent.set(row.student_no, list)
  }

  return (studentRows as StudentRow[]).map((s) => {
    const className = classNameById.get(s.class_id) ?? s.class_id
    const records = byStudent.get(s.student_no) ?? []
    const yearHistory = buildYearHistory(s.student_no, className, records)
    const latest =
      records.find((r) => r.semester === 'second') ??
      records.find((r) => r.semester === 'first')
    const readingScore = roundScore(Number(latest?.reading ?? 0))
    const writingScore = roundScore(Number(latest?.writing ?? 0))
    const dailyScore = roundScore(Number(latest?.daily ?? 0))
    const progress = roundScore((dailyScore + readingScore + writingScore) / 3)

    const noteParts = [
      latest?.remarks?.trim(),
      s.roster_remarks?.trim(),
      s.house ? `House: ${s.house}` : '',
    ].filter(Boolean)

    return {
      id: s.student_no,
      name: s.name_zh,
      classId: s.class_id,
      classNumber: s.class_number,
      progress,
      readingScore,
      correctRate: writingScore,
      recentScores: recentFromComponents(latest?.components ?? null),
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
