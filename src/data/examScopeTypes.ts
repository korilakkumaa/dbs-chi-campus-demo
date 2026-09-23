import type { Paper1ExamScopeRow } from './paper1ExamScopeData'

/** Year document wrapping paper-1 exam-scope rows (測考範圍). */
export type ExamScopeYear = {
  startYear: number
  label: string
  source: string
  rows: Paper1ExamScopeRow[]
}
