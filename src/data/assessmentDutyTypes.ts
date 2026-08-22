import type {
  DutySlot,
  EcAppendixRow,
  TeacherDutyItem,
} from './assessmentDutyParse'

export type AssessmentDutyCategoryKey =
  | 'phaseTest'
  | 'paper1'
  | 'paper2'
  | 'listeningSba'
  | 'makeupSpecial'

export type WorkloadTier = 'high' | 'medium' | 'moderate' | 'low' | 'none'

export type GradeDutyRow = {
  gradeLabel: string
  gradeShort: string
  categories: Partial<Record<AssessmentDutyCategoryKey, DutySlot[]>>
}

export type TeacherDutyRow = {
  name: string
  code: string
  firstSemester: TeacherDutyItem[]
  secondSemester: TeacherDutyItem[]
  totalWeight: number | null
  workloadTier: WorkloadTier
}

export type AssessmentDutyYear = {
  startYear: number
  label: string
  title: string
  categoryLabels: Record<AssessmentDutyCategoryKey, string>
  categoryShortLabels: Record<AssessmentDutyCategoryKey, string>
  gradeMatrix: GradeDutyRow[]
  teachers: TeacherDutyRow[]
  ecAppendix: EcAppendixRow[]
}
