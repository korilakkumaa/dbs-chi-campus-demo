import { ASSESSMENT_DUTY_2627 } from './assessmentDuty2627.generated'
import type { AssessmentDutyYear } from './assessmentDutyTypes'

export type { AssessmentDutyCategoryKey, AssessmentDutyYear, TeacherDutyRow, WorkloadTier } from './assessmentDutyTypes'
export type { DutySlot, TeacherDutyItem } from './assessmentDutyParse'

const BY_START_YEAR: Record<number, AssessmentDutyYear> = {
  2026: ASSESSMENT_DUTY_2627,
}

export function listAssessmentDutyYears(): number[] {
  return Object.keys(BY_START_YEAR)
    .map(Number)
    .sort((a, b) => b - a)
}

export function getAssessmentDuty(startYear: number): AssessmentDutyYear | null {
  return BY_START_YEAR[startYear] ?? null
}

export function workloadTierLabel(tier: AssessmentDutyYear['teachers'][number]['workloadTier']): string {
  switch (tier) {
    case 'high':
      return '≥3.0'
    case 'medium':
      return '≥2.5'
    case 'moderate':
      return '≥2.0'
    case 'low':
      return '<2.0'
    default:
      return '—'
  }
}
