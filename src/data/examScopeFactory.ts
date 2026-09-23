import { formatAcademicYearLabel } from './academicYear'
import { PAPER1_EXAM_SCOPE_ROWS } from './paper1ExamScopeData'
import type { ExamScopeYear } from './examScopeTypes'

/** Seed rows shipped with the app (fallback when Supabase has no year doc). */
export function getExamScopeSeedRows(): ExamScopeYear['rows'] {
  return structuredClone(PAPER1_EXAM_SCOPE_ROWS)
}

export function createEmptyExamScope(startYear: number): ExamScopeYear {
  return {
    startYear,
    label: formatAcademicYearLabel(startYear),
    source: 'bootstrap-empty',
    rows: [],
  }
}

/** Bootstrap from the static seed (same shape as data/paper1_exam_scope.csv). */
export function createSeedExamScope(startYear: number): ExamScopeYear {
  return {
    startYear,
    label: formatAcademicYearLabel(startYear),
    source: 'seed-paper1',
    rows: getExamScopeSeedRows(),
  }
}

export function cloneExamScopeForYear(
  source: ExamScopeYear,
  startYear: number,
): ExamScopeYear {
  return {
    startYear,
    label: formatAcademicYearLabel(startYear),
    source: `cloned-from-${source.startYear}`,
    rows: structuredClone(source.rows),
  }
}
