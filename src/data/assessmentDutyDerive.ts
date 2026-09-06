import type {
  AssessmentDutyCategoryKey,
  AssessmentDutyYear,
  GradeDutyRow,
  TeacherDutyRow,
  WorkloadTier,
} from './assessmentDutyTypes'
import type { DutySlot, EcAppendixRow, TeacherDutyItem } from './assessmentDutyParse'
import { GRADE_CATEGORY_ORDER } from './assessmentDutyDisplay'
import { teacherWhitelistForYear } from './teacherWhitelist'

function workloadTier(weight: number | null): WorkloadTier {
  if (weight == null) return 'none'
  if (weight >= 3) return 'high'
  if (weight >= 2.5) return 'medium'
  if (weight >= 2) return 'moderate'
  return 'low'
}

function roundWeight(n: number): number {
  return Math.round(n * 100) / 100
}

function slotTask(
  categoryKey: AssessmentDutyCategoryKey,
  slot: DutySlot,
): string {
  if (slot.note) {
    if (slot.note === '初中擬' || slot.note === '高中擬') return '補考'
    if (slot.note === '初中改' || slot.note === '高中改') return '補考閱'
    return slot.note
  }
  switch (categoryKey) {
    case 'phaseTest':
      return '統測'
    case 'paper1':
      if (slot.part === '甲') return '卷一·甲'
      if (slot.part === '乙') return '卷一·乙'
      return '卷一'
    case 'paper2':
      if (slot.part === '甲') return '卷二·甲'
      if (slot.part === '乙') return '卷二·乙'
      return '卷二'
    case 'listeningSba':
      return '聆聽／SBA'
    case 'makeupSpecial':
      return '補考／專項'
    default:
      return '—'
  }
}

function slotGrade(gradeShort: string, slot: DutySlot): string {
  if (slot.note?.startsWith('初中')) return '初中'
  if (slot.note?.startsWith('高中')) return '高中'
  return gradeShort
}

function pushUnique(
  list: TeacherDutyItem[],
  item: TeacherDutyItem,
): void {
  const exists = list.some(
    (x) =>
      x.ec === item.ec &&
      x.grade === item.grade &&
      x.task === item.task &&
      x.weight === item.weight,
  )
  if (!exists) list.push(item)
}

type Acc = {
  name: string
  firstSemester: TeacherDutyItem[]
  secondSemester: TeacherDutyItem[]
  weightSum: number
  hasWeight: boolean
}

function ensureAcc(
  byCode: Map<string, Acc>,
  code: string,
  nameMap: Map<string, string>,
): Acc {
  let acc = byCode.get(code)
  if (!acc) {
    acc = {
      name: nameMap.get(code) ?? code,
      firstSemester: [],
      secondSemester: [],
      weightSum: 0,
      hasWeight: false,
    }
    byCode.set(code, acc)
  }
  return acc
}

function addSlotWeight(acc: Acc, weight: number | null): void {
  if (weight == null) return
  acc.hasWeight = true
  acc.weightSum += weight
}

function ingestMatrix(
  byCode: Map<string, Acc>,
  gradeMatrix: GradeDutyRow[],
  nameMap: Map<string, string>,
): void {
  for (const gradeRow of gradeMatrix) {
    for (const categoryKey of GRADE_CATEGORY_ORDER) {
      const slots = gradeRow.categories[categoryKey]
      if (!slots?.length) continue
      for (const slot of slots) {
        if (!slot.teacherCode) continue
        const acc = ensureAcc(byCode, slot.teacherCode, nameMap)
        const item: TeacherDutyItem = {
          ec: false,
          grade: slotGrade(gradeRow.gradeShort, slot),
          task: slotTask(categoryKey, slot),
          weight: slot.weight,
        }
        if (slot.semester === 'second') {
          pushUnique(acc.secondSemester, item)
        } else if (slot.semester === 'both') {
          pushUnique(acc.firstSemester, item)
          pushUnique(acc.secondSemester, item)
        } else {
          // first | mock | year → first semester list (matches mine view grouping)
          pushUnique(acc.firstSemester, item)
        }
        addSlotWeight(acc, slot.weight)
      }
    }
  }
}

function ingestEc(
  byCode: Map<string, Acc>,
  ecAppendix: EcAppendixRow[],
  nameMap: Map<string, string>,
): void {
  for (const row of ecAppendix) {
    const pairs: { code: string | null; semester: 'first' | 'second'; paper: string }[] = [
      { code: row.firstPaper1, semester: 'first', paper: '卷一' },
      { code: row.firstPaper2, semester: 'first', paper: '卷二' },
      { code: row.secondPaper1, semester: 'second', paper: '卷一' },
      { code: row.secondPaper2, semester: 'second', paper: '卷二' },
    ]
    for (const p of pairs) {
      if (!p.code) continue
      const acc = ensureAcc(byCode, p.code, nameMap)
      const item: TeacherDutyItem = {
        ec: true,
        grade: row.grade,
        task: p.paper,
        weight: null,
      }
      if (p.semester === 'first') pushUnique(acc.firstSemester, item)
      else pushUnique(acc.secondSemester, item)
    }
  }
}

/** Rebuild teachers[] from grade matrix + EC appendix (single source of truth). */
export function deriveAssessmentTeachers(
  startYear: number,
  gradeMatrix: GradeDutyRow[],
  ecAppendix: EcAppendixRow[],
): TeacherDutyRow[] {
  const nameMap = new Map<string, string>()
  for (const t of teacherWhitelistForYear(startYear)) {
    nameMap.set(t.initial, t.name)
  }

  const byCode = new Map<string, Acc>()
  ingestMatrix(byCode, gradeMatrix, nameMap)
  ingestEc(byCode, ecAppendix, nameMap)

  const teachers: TeacherDutyRow[] = [...byCode.entries()].map(([code, acc]) => {
    const totalWeight = acc.hasWeight ? roundWeight(acc.weightSum) : null
    return {
      name: acc.name,
      code,
      firstSemester: acc.firstSemester,
      secondSemester: acc.secondSemester,
      totalWeight,
      workloadTier: workloadTier(totalWeight),
    }
  })

  teachers.sort((a, b) => a.code.localeCompare(b.code, 'en'))
  return teachers
}

export function withDerivedAssessmentTeachers(
  duty: Omit<AssessmentDutyYear, 'teachers'> & { teachers?: TeacherDutyRow[] },
): AssessmentDutyYear {
  return {
    ...duty,
    teachers: deriveAssessmentTeachers(duty.startYear, duty.gradeMatrix, duty.ecAppendix),
  }
}
