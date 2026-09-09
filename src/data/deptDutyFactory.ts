import { formatAcademicYearLabel } from './academicYear'
import { withDerivedDeptTeachers } from './deptDutyDerive'
import type { DeptDutyYear } from './deptDutyTypes'

/** Blank year document for admin bootstrap. */
export function createEmptyDeptDuty(startYear: number): DeptDutyYear {
  const label = formatAcademicYearLabel(startYear)
  return withDerivedDeptTeachers({
    startYear,
    label,
    source: 'bootstrap-empty',
    items: [],
    teachers: [],
  })
}

export function cloneDeptDutyForYear(
  source: DeptDutyYear,
  startYear: number,
): DeptDutyYear {
  const label = formatAcademicYearLabel(startYear)
  return withDerivedDeptTeachers({
    startYear,
    label,
    source: `cloned-from-${source.startYear}`,
    items: structuredClone(source.items),
    teachers: [],
  })
}
