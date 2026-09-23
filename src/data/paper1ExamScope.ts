import {
  PAPER1_EXAM_SCOPE_ROWS,
  type ExamScopeCohort,
  type ExamScopeGrade,
  type ExamScopePaper,
  type ExamScopeSemester,
  type Paper1ExamScopeRow,
} from './paper1ExamScopeData'

export type {
  ExamScopeCohort,
  ExamScopeGrade,
  ExamScopePaper,
  ExamScopeSemester,
  Paper1ExamScopeRow,
}

export const EXAM_SCOPE_PAPER_LABELS: Record<ExamScopePaper, string> = {
  test: '統測',
  paper1: '卷一',
  paper2: '卷二',
}

export const EXAM_SCOPE_SEMESTER_LABELS: Record<ExamScopeSemester, string> = {
  first: '上學期',
  second: '下學期',
}

export const EXAM_SCOPE_GRADE_LABELS: Record<ExamScopeGrade, string> = {
  f4: '中四',
  f5: '中五',
  f6: '中六',
}

const COHORT_FOR_GRADE: Record<ExamScopeGrade, ExamScopeCohort> = {
  f4: '中四甲部',
  f5: '中五甲部',
  f6: '中六甲部',
}

const GRADES: ExamScopeGrade[] = ['f4', 'f5', 'f6']

type FlagKey = keyof Paper1ExamScopeRow['flags']

function flagKeyFor(
  grade: ExamScopeGrade,
  semester: ExamScopeSemester,
  paper: Exclude<ExamScopePaper, 'paper2'>,
): FlagKey {
  if (grade === 'f6') {
    return paper === 'test' ? 'f6_test' : 'f6_exam'
  }
  const term = semester === 'first' ? 's1' : 's2'
  const kind = paper === 'test' ? 'test' : 'exam'
  return `${grade}_${term}_${kind}` as FlagKey
}

export type ExamScopeTitle = {
  title: string
  scoreScheme: string | null
  firstTaughtFormTerm: string
}

export type ExamScopeUnitGroup = {
  unit: string
  titles: ExamScopeTitle[]
}

export type ExamScopeGradeSection = {
  grade: ExamScopeGrade
  gradeLabel: string
  /** Extra note, e.g. F6 not split by semester */
  note?: string
  units: ExamScopeUnitGroup[]
}

function groupByUnit(rows: Paper1ExamScopeRow[]): ExamScopeUnitGroup[] {
  const units: ExamScopeUnitGroup[] = []
  const indexByUnit = new Map<string, number>()
  for (const row of rows) {
    let idx = indexByUnit.get(row.unit)
    if (idx == null) {
      idx = units.length
      indexByUnit.set(row.unit, idx)
      units.push({ unit: row.unit, titles: [] })
    }
    units[idx].titles.push({
      title: row.title,
      scoreScheme: row.scoreScheme,
      firstTaughtFormTerm: row.firstTaughtFormTerm,
    })
  }
  return units
}

/**
 * Build grade sections for a semester + paper selection.
 * Paper 2 has no scope data yet → returns empty list (UI shows empty state).
 * F6 flags are year-level (no s1/s2), so the same list appears in both semester cards.
 * Pass `rows` to use admin-uploaded / remote data; defaults to static seed.
 */
export function getPaper1ExamScopeSections(
  semester: ExamScopeSemester,
  paper: ExamScopePaper,
  rows: Paper1ExamScopeRow[] = PAPER1_EXAM_SCOPE_ROWS,
): ExamScopeGradeSection[] {
  if (paper === 'paper2') return []

  const sections: ExamScopeGradeSection[] = []
  for (const grade of GRADES) {
    const cohort = COHORT_FOR_GRADE[grade]
    const flag = flagKeyFor(grade, semester, paper)
    const matched = rows.filter(
      (row) => row.cohort === cohort && row.flags[flag],
    )
    if (!matched.length) continue
    sections.push({
      grade,
      gradeLabel: EXAM_SCOPE_GRADE_LABELS[grade],
      units: groupByUnit(matched),
    })
  }
  return sections
}
