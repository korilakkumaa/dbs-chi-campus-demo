import { formatAcademicYearLabel } from './academicYear'
import { withDerivedAssessmentTeachers } from './assessmentDutyDerive'
import type {
  AssessmentDutyCategoryKey,
  AssessmentDutyYear,
  GradeDutyRow,
} from './assessmentDutyTypes'
import type { EcAppendixRow } from './assessmentDutyParse'

/** Shared category labels for all assessment-duty year documents. */
export const DEFAULT_ASSESSMENT_CATEGORY_LABELS: Record<
  AssessmentDutyCategoryKey,
  string
> = {
  phaseTest: '階段性統測',
  paper1: '卷一：閱讀能力',
  paper2: '卷二：寫作能力',
  listeningSba: '聆聽評估 / SBA 校本評核',
  makeupSpecial: '學年補考 / 專項分班試',
}

export const DEFAULT_ASSESSMENT_CATEGORY_SHORT_LABELS: Record<
  AssessmentDutyCategoryKey,
  string
> = {
  phaseTest: '統測',
  paper1: '卷一',
  paper2: '卷二',
  listeningSba: '聆聽/SBA',
  makeupSpecial: '補考/專項',
}

const DEFAULT_GRADE_SHELL: { gradeLabel: string; gradeShort: string }[] = [
  { gradeLabel: '中一 (G7)', gradeShort: '中一' },
  { gradeLabel: '中二 (G8)', gradeShort: '中二' },
  { gradeLabel: '中三 (G9)', gradeShort: '中三' },
  { gradeLabel: '中四 (G10)', gradeShort: '中四' },
  { gradeLabel: '中五 (G11)', gradeShort: '中五' },
  { gradeLabel: '中六 (G12)', gradeShort: '中六' },
]

function emptyGradeMatrix(): GradeDutyRow[] {
  return DEFAULT_GRADE_SHELL.map((g) => ({
    gradeLabel: g.gradeLabel,
    gradeShort: g.gradeShort,
    categories: {},
  }))
}

function emptyEcAppendix(): EcAppendixRow[] {
  return DEFAULT_GRADE_SHELL.map((g) => ({
    grade: g.gradeShort,
    firstPaper1: null,
    firstPaper2: null,
    secondPaper1: null,
    secondPaper2: null,
  }))
}

/** Blank year document for admin bootstrap (no seed / remote row yet). */
export function createEmptyAssessmentDuty(startYear: number): AssessmentDutyYear {
  const label = formatAcademicYearLabel(startYear)
  return withDerivedAssessmentTeachers({
    startYear,
    label,
    title: `${label.replace('/', '-')}年度 中文科各級考核擬題與分工`,
    categoryLabels: { ...DEFAULT_ASSESSMENT_CATEGORY_LABELS },
    categoryShortLabels: { ...DEFAULT_ASSESSMENT_CATEGORY_SHORT_LABELS },
    gradeMatrix: emptyGradeMatrix(),
    ecAppendix: emptyEcAppendix(),
  })
}

/** Copy matrix/appendix into another academic year; teachers are re-derived. */
export function cloneAssessmentDutyForYear(
  source: AssessmentDutyYear,
  startYear: number,
): AssessmentDutyYear {
  const label = formatAcademicYearLabel(startYear)
  return withDerivedAssessmentTeachers({
    startYear,
    label,
    title: source.title.replace(source.label, label),
    categoryLabels: structuredClone(source.categoryLabels),
    categoryShortLabels: structuredClone(source.categoryShortLabels),
    gradeMatrix: structuredClone(source.gradeMatrix),
    ecAppendix: structuredClone(source.ecAppendix),
  })
}
