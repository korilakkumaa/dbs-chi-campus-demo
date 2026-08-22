import type {
  AssessmentDutyCategoryKey,
  AssessmentDutyYear,
  GradeDutyRow,
} from './assessmentDutyTypes'
import type { DutyPart, DutySemester, DutySlot, TeacherDutyItem } from './assessmentDutyParse'
import { semesterLabel } from './assessmentDutyParse'
import { teacherWhitelistForYear } from './teacherWhitelist'

export const GRADE_CATEGORY_ORDER: AssessmentDutyCategoryKey[] = [
  'phaseTest',
  'paper1',
  'paper2',
  'listeningSba',
  'makeupSpecial',
]

const CATEGORY_SORT: Record<AssessmentDutyCategoryKey, number> = {
  phaseTest: 0,
  paper1: 1,
  paper2: 2,
  listeningSba: 3,
  makeupSpecial: 4,
}

type SemesterGroup = 'first' | 'second' | 'mock' | 'other'

const SEMESTER_GROUP_ORDER: SemesterGroup[] = ['first', 'second', 'mock', 'other']

const SEMESTER_GROUP_LABEL: Record<SemesterGroup, string> = {
  first: '上學期',
  second: '下學期',
  mock: 'Mock 試',
  other: '其他安排',
}

const NOTE_READABLE: Record<string, string> = {
  聆聽: '聆聽評估',
  SBA文: 'SBA 文字報告',
  SBA口: 'SBA 口頭匯報',
  分班試: '新生分班試',
  TSA: 'Pre-mock TSA',
  初中擬: '初中補考擬題',
  初中改: '初中補考閱卷',
  高中擬: '高中補考擬題',
  高中改: '高中補考閱卷',
  'Post-Mock': 'Post-Mock 小測',
}

export type GradeDutyDisplayRow = {
  semesterGroup: SemesterGroup
  categoryKey: AssessmentDutyCategoryKey
  itemLabel: string
  partLabel: string
  teacherName: string
  teacherCode: string
  weight: number | null
}

export function teacherNameMapForYear(startYear: number): Map<string, string> {
  const map = new Map<string, string>()
  for (const t of teacherWhitelistForYear(startYear)) {
    map.set(t.initial, t.name)
  }
  return map
}

export function resolveTeacherName(code: string, nameMap: Map<string, string>): string {
  return nameMap.get(code) ?? code
}

export function formatTeacherLabel(
  code: string,
  nameMap: Map<string, string>,
): { name: string; code: string; known: boolean } {
  const name = resolveTeacherName(code, nameMap)
  return { name, code, known: name !== code }
}

function semesterToGroup(semester: DutySemester): SemesterGroup {
  if (semester === 'first') return 'first'
  if (semester === 'second') return 'second'
  if (semester === 'mock') return 'mock'
  return 'other'
}

function partFromSlot(part: DutyPart | null, semester: DutySemester): string {
  if (part === '甲') return '甲部'
  if (part === '乙') return '乙部'
  if (part === '甲乙') return '甲、乙部'
  if (semester === 'both') return '全年'
  if (semester === 'year') return '學年'
  return '—'
}

const PART_LABEL_SORT: Record<string, number> = {
  甲部: 0,
  乙部: 1,
  '甲、乙部': 2,
  '—': 10,
  全年: 11,
  學年: 12,
  上學期: 20,
  下學期: 21,
}

function comparePartLabels(a: string, b: string): number {
  const orderA = PART_LABEL_SORT[a] ?? 50
  const orderB = PART_LABEL_SORT[b] ?? 50
  if (orderA !== orderB) return orderA - orderB
  return a.localeCompare(b, 'zh-Hant')
}

const CATEGORY_READABLE: Record<AssessmentDutyCategoryKey, string> = {
  phaseTest: '階段性統測',
  paper1: '卷一（閱讀）',
  paper2: '卷二（寫作）',
  listeningSba: '聆聽／SBA',
  makeupSpecial: '補考／專項',
}

function itemLabelForSlot(
  categoryKey: AssessmentDutyCategoryKey,
  slot: DutySlot,
): string {
  if (slot.note) {
    return NOTE_READABLE[slot.note] ?? slot.note
  }
  return CATEGORY_READABLE[categoryKey]
}

/** Readable task label for teacher duty lines. */
export function formatTaskReadable(task: string): string {
  return task
    .replace(/^卷一·甲$/, '卷一（甲部）')
    .replace(/^卷一·乙$/, '卷一（乙部）')
    .replace(/^卷二·甲$/, '卷二（甲部）')
    .replace(/^卷二·乙$/, '卷二（乙部）')
    .replace(/^SBA文$/, 'SBA 文字報告')
    .replace(/^SBA口$/, 'SBA 口頭匯報')
    .replace(/^補考閱$/, '補考閱卷')
}

export function formatTeacherDutyLine(item: TeacherDutyItem): string {
  const row = teacherDutyToMineRow(item)
  const weight = row.weight != null ? ` · 權重 ${row.weight}` : ''
  return `${row.grade} · ${row.paper} · ${row.part}${weight}`
}

export type MineDutyRow = {
  grade: string
  paper: string
  part: string
  weight: number | null
}

const TASK_PAPER: Record<string, string> = {
  統測: '統測',
  卷一: '卷一',
  卷二: '卷二',
  SBA文: 'SBA 文字',
  SBA口: 'SBA 口頭',
  'Post-Mock': 'Post-Mock',
  TSA: 'TSA',
  分班試: '分班試',
  補考: '補考',
  補考閱: '補考閱卷',
  聆聽: '聆聽',
}

function splitTaskToPaperPart(task: string): { paper: string; part: string } {
  const ab = task.match(/^卷([一二])·([甲乙])$/)
  if (ab) {
    return { paper: `卷${ab[1]}`, part: `${ab[2]}部` }
  }
  if (TASK_PAPER[task]) {
    return { paper: TASK_PAPER[task], part: '—' }
  }
  return { paper: task, part: '—' }
}

export function teacherDutyToMineRow(item: TeacherDutyItem): MineDutyRow {
  const { paper, part } = splitTaskToPaperPart(item.task)
  const grade = item.ec ? `EC·${item.grade}` : item.grade
  return { grade, paper, part, weight: item.weight }
}

export function ecDutyToMineRow(item: EcDutyItem): MineDutyRow {
  return {
    grade: `EC·${item.grade}`,
    paper: item.paper,
    part: item.semester,
    weight: null,
  }
}

function slotToMineRow(
  gradeShort: string,
  categoryKey: AssessmentDutyCategoryKey,
  slot: DutySlot,
): MineDutyRow {
  let grade = gradeShort
  let paper: string
  let part = '—'

  if (slot.part === '甲') part = '甲部'
  else if (slot.part === '乙') part = '乙部'
  else if (slot.part === '甲乙') part = '甲、乙部'

  const mock = slot.semester === 'mock' ? 'Mock ' : ''

  switch (categoryKey) {
    case 'phaseTest':
      paper = '統測'
      break
    case 'paper1':
      paper = `${mock}卷一`
      break
    case 'paper2':
      paper = `${mock}卷二`
      break
    case 'listeningSba':
      paper = slot.note ? (NOTE_READABLE[slot.note] ?? slot.note) : '聆聽／SBA'
      break
    case 'makeupSpecial':
      if (slot.note?.startsWith('初中')) grade = '初中'
      else if (slot.note?.startsWith('高中')) grade = '高中'
      paper = slot.note ? (NOTE_READABLE[slot.note] ?? slot.note) : '補考／專項'
      break
    default:
      paper = '—'
  }

  return { grade, paper, part, weight: slot.weight }
}

function sortMineRows(rows: MineDutyRow[]): MineDutyRow[] {
  return [...rows].sort(
    (a, b) =>
      a.grade.localeCompare(b.grade, 'zh-Hant') ||
      a.paper.localeCompare(b.paper, 'zh-Hant') ||
      comparePartLabels(a.part, b.part),
  )
}

export type MineDutySections = {
  first: MineDutyRow[]
  second: MineDutyRow[]
  other: MineDutyRow[]
  ec: MineDutyRow[]
}

/** Build「我的出卷」from grade matrix + EC appendix (authoritative for 卷別). */
export function buildMineDutySections(
  code: string,
  duty: AssessmentDutyYear,
): MineDutySections {
  const first: MineDutyRow[] = []
  const second: MineDutyRow[] = []
  const other: MineDutyRow[] = []

  for (const gradeRow of duty.gradeMatrix) {
    for (const categoryKey of GRADE_CATEGORY_ORDER) {
      const slots = gradeRow.categories[categoryKey]
      if (!slots?.length) continue
      for (const slot of slots) {
        if (slot.teacherCode !== code) continue
        const row = slotToMineRow(gradeRow.gradeShort, categoryKey, slot)
        if (slot.semester === 'first' || slot.semester === 'mock') {
          first.push(row)
        } else if (slot.semester === 'second') {
          second.push(row)
        } else {
          other.push(row)
        }
      }
    }
  }

  const ec = sortMineRows(ecDutiesForTeacher(code, duty.ecAppendix).map(ecDutyToMineRow))

  return {
    first: sortMineRows(first),
    second: sortMineRows(second),
    other: sortMineRows(other),
    ec,
  }
}

export type MineDutyGroup = {
  label: string
  rows: MineDutyRow[]
}

export function mineDutyGroups(sections: MineDutySections): MineDutyGroup[] {
  const groups: MineDutyGroup[] = []
  if (sections.first.length) groups.push({ label: '上學期', rows: sections.first })
  if (sections.second.length) groups.push({ label: '下學期', rows: sections.second })
  if (sections.other.length) groups.push({ label: '其他安排', rows: sections.other })
  if (sections.ec.length) groups.push({ label: 'EC 延伸', rows: sections.ec })
  return groups
}

export function buildGradeDisplayRows(
  gradeRow: GradeDutyRow,
  nameMap: Map<string, string>,
): GradeDutyDisplayRow[] {
  const rows: GradeDutyDisplayRow[] = []

  for (const categoryKey of GRADE_CATEGORY_ORDER) {
    const slots = gradeRow.categories[categoryKey]
    if (!slots?.length) continue

    for (const slot of slots) {
      rows.push({
        semesterGroup: semesterToGroup(slot.semester),
        categoryKey,
        itemLabel: itemLabelForSlot(categoryKey, slot),
        partLabel: partFromSlot(slot.part, slot.semester),
        teacherName: resolveTeacherName(slot.teacherCode, nameMap),
        teacherCode: slot.teacherCode,
        weight: slot.weight,
      })
    }
  }

  return rows.sort((a, b) => {
    const sg =
      SEMESTER_GROUP_ORDER.indexOf(a.semesterGroup) -
      SEMESTER_GROUP_ORDER.indexOf(b.semesterGroup)
    if (sg !== 0) return sg
    const cg = CATEGORY_SORT[a.categoryKey] - CATEGORY_SORT[b.categoryKey]
    if (cg !== 0) return cg
    return comparePartLabels(a.partLabel, b.partLabel)
  })
}

export function semesterGroupLabel(group: SemesterGroup): string {
  return SEMESTER_GROUP_LABEL[group]
}

export function semesterGroupsInRows(rows: GradeDutyDisplayRow[]): SemesterGroup[] {
  const seen = new Set<SemesterGroup>()
  for (const r of rows) seen.add(r.semesterGroup)
  return SEMESTER_GROUP_ORDER.filter((g) => seen.has(g))
}

/** Map logged-in user id (u-fyc) to assessment-duty teacher code (FYC). */
export function resolveDutyTeacherCode(
  userId: string | undefined,
  teachers: { code: string }[],
): string | null {
  if (!userId || userId === 'u-admin' || userId === 'u-student') return null
  const raw = userId.replace(/^u-/, '')
  const code = raw.toUpperCase()
  if (teachers.some((t) => t.code === code)) return code
  return (
    teachers.find((t) => t.code.toLowerCase() === raw.toLowerCase())?.code ?? null
  )
}

export type EcDutyItem = {
  grade: string
  semester: '上學期' | '下學期'
  paper: '卷一' | '卷二'
}

export function ecDutiesForTeacher(
  code: string,
  ecAppendix: {
    grade: string
    firstPaper1: string | null
    firstPaper2: string | null
    secondPaper1: string | null
    secondPaper2: string | null
  }[],
): EcDutyItem[] {
  const items: EcDutyItem[] = []
  for (const row of ecAppendix) {
    if (row.firstPaper1 === code) {
      items.push({ grade: row.grade, semester: '上學期', paper: '卷一' })
    }
    if (row.firstPaper2 === code) {
      items.push({ grade: row.grade, semester: '上學期', paper: '卷二' })
    }
    if (row.secondPaper1 === code) {
      items.push({ grade: row.grade, semester: '下學期', paper: '卷一' })
    }
    if (row.secondPaper2 === code) {
      items.push({ grade: row.grade, semester: '下學期', paper: '卷二' })
    }
  }
  return items
}

export { semesterLabel }
