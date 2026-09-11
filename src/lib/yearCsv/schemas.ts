import type { WhitelistTeacher } from '../../data/teacherWhitelist'
import { cell, parseCsv, toCsv, truthyFlag } from './csv'
import type { GradeDeadline } from '../../types'
import type { AssessmentDutyYear, AssessmentDutyCategoryKey, GradeDutyRow } from '../../data/assessmentDutyTypes'
import type { DutyPart, DutySemester, DutySlot, EcAppendixRow } from '../../data/assessmentDutyParse'
import type { DeptDutyItem, DeptDutyPerson, DeptDutyYear } from '../../data/deptDutyTypes'
import {
  createEmptyAssessmentDuty,
  DEFAULT_ASSESSMENT_CATEGORY_LABELS,
} from '../../data/assessmentDutyFactory'
import { formatAcademicYearLabel } from '../../data/academicYear'
import { emptyGradeDeadlines } from '../../data/gradeDeadlines'
import { storedStudentNo } from '../../data/campusScoresYear'
import {
  academicYearWindowForIso,
  type DayPeriod,
  type SchoolWeekday,
  type TeacherTimetableEntry,
} from '../../data/teacherTimetable'

export type YearCsvKind =
  | 'teacher_whitelist'
  | 'student_roster'
  | 'chinese_streaming'
  | 'school_calendar'
  | 'assessment_duty'
  | 'dept_duty'
  | 'semester_scores'
  | 'grade_deadlines'
  | 'teacher_timetable'

export type CsvIssue = { row: number; message: string }

export type ParsedYearCsv<T> = {
  ok: boolean
  data: T
  issues: CsvIssue[]
  previewRows: string[][]
}

export const YEAR_CSV_KIND_LABEL: Record<YearCsvKind, string> = {
  teacher_whitelist: '教師白名單',
  student_roster: '學生名單',
  chinese_streaming: '中文教學組分組',
  school_calendar: '校曆活動',
  assessment_duty: '出卷分工',
  dept_duty: '職責',
  semester_scores: '學期成績',
  grade_deadlines: '成績截止日期',
  teacher_timetable: '時間表（個人／班級）',
}

export const WHITELIST_HEADERS = [
  'Initial',
  'Chi. Name',
  'Email Address',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
] as const

export function whitelistToCsv(teachers: WhitelistTeacher[]): string {
  return toCsv(
    [...WHITELIST_HEADERS],
    teachers.map((t) => [
      t.initial,
      t.name,
      t.email,
      t.classes[0] ?? '',
      t.classes[1] ?? '',
      t.classes[2] ?? '',
      t.classes[3] ?? '',
    ]),
  )
}

export function parseWhitelistCsv(text: string): ParsedYearCsv<WhitelistTeacher[]> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const teachers: WhitelistTeacher[] = []
  const previewRows: string[][] = []

  rows.forEach((row, idx) => {
    const line = idx + 2
    const initial = cell(row, 'Initial', 'initial')
    const name = cell(row, 'Chi. Name', 'name', 'Chi Name')
    const email = cell(row, 'Email Address', 'email')
    const classes = [
      cell(row, 'Class 1'),
      cell(row, 'Class 2'),
      cell(row, 'Class 3'),
      cell(row, 'Class 4'),
    ].filter(Boolean)
    if (!initial && !email && !name) return
    if (!initial) {
      issues.push({ row: line, message: '缺少 Initial' })
      return
    }
    if (!email) {
      issues.push({ row: line, message: '缺少 Email Address' })
      return
    }
    teachers.push({ initial: initial.toUpperCase(), name, email: email.toLowerCase(), classes })
    previewRows.push([initial, name, email, classes.join(' / ')])
  })

  return { ok: issues.length === 0 && teachers.length > 0, data: teachers, issues, previewRows }
}

export const ROSTER_HEADERS = [
  'stid',
  'class',
  'class_number',
  'name_zh',
  'name_en',
  'house',
  'french',
  'remarks',
] as const

export type RosterCsvRow = {
  student_no: string
  class_name: string
  class_number: number
  name_zh: string
  name_en: string
  house: string
  french: boolean
  remarks: string
}

export function rosterTemplateCsv(): string {
  return toCsv([...ROSTER_HEADERS], [
    ['12345', '7D', 1, '陳大文', 'Chan Tai Man', 'G', 'N', ''],
  ])
}

export function parseRosterCsv(
  text: string,
  startYear: number,
): ParsedYearCsv<RosterCsvRow[]> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const data: RosterCsvRow[] = []
  const previewRows: string[][] = []

  rows.forEach((row, idx) => {
    const line = idx + 2
    const stid = cell(row, 'stid', 'STID', 'student_no')
    const className = cell(row, 'class', 'Class')
    const classNumber = Number(cell(row, 'class_number', 'class_no', 'Class No'))
    const nameZh = cell(row, 'name_zh', 'Name ZH', '中文姓名')
    const nameEn = cell(row, 'name_en', 'Name EN', '英文姓名')
    if (!stid && !className) return
    if (!stid) {
      issues.push({ row: line, message: '缺少 stid' })
      return
    }
    if (!className) {
      issues.push({ row: line, message: '缺少 class' })
      return
    }
    if (!Number.isFinite(classNumber) || classNumber <= 0) {
      issues.push({ row: line, message: 'class_number 無效' })
      return
    }
    const french = truthyFlag(cell(row, 'french', 'French'))
    data.push({
      student_no: storedStudentNo(startYear, stid),
      class_name: className,
      class_number: classNumber,
      name_zh: nameZh,
      name_en: nameEn,
      house: cell(row, 'house', 'House'),
      french,
      remarks: cell(row, 'remarks', 'roster_remarks'),
    })
    previewRows.push([stid, className, String(classNumber), nameZh || nameEn])
  })

  return { ok: issues.length === 0 && data.length > 0, data, issues, previewRows }
}

export const STREAMING_HEADERS = [
  'stid',
  'admin_class',
  'group_name',
  'teacher_initial',
  'french',
] as const

export type StreamingCsvRow = {
  student_no: string
  teaching_group: string
  french: boolean
}

export function streamingTemplateCsv(): string {
  return toCsv([...STREAMING_HEADERS], [
    ['12345', '7D', '7D', 'FYC', 'N'],
    ['12346', '7A', 'G7 EC', 'WKL', 'Y'],
  ])
}

export function parseStreamingCsv(
  text: string,
  startYear: number,
): ParsedYearCsv<StreamingCsvRow[]> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const data: StreamingCsvRow[] = []
  const previewRows: string[][] = []

  rows.forEach((row, idx) => {
    const line = idx + 2
    const stid = cell(row, 'stid', 'STID')
    const groupName = cell(row, 'group_name', 'Group Name', 'group')
    const teacher = cell(row, 'teacher_initial', 'Initial', 'teacher')
    const french = truthyFlag(cell(row, 'french', 'French'))
    if (!stid && !groupName) return
    if (!stid) {
      issues.push({ row: line, message: '缺少 stid' })
      return
    }
    if (!groupName) {
      issues.push({ row: line, message: '缺少 group_name' })
      return
    }
    const teaching_group = teacher
      ? `${normalizeGroupLabel(groupName)}-${teacher.toUpperCase()}`
      : normalizeGroupLabel(groupName)
    data.push({
      student_no: storedStudentNo(startYear, stid),
      teaching_group,
      french,
    })
    previewRows.push([stid, teaching_group, french ? 'Y' : 'N'])
  })

  return { ok: issues.length === 0 && data.length > 0, data, issues, previewRows }
}

function normalizeGroupLabel(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ')
  const ec = s.match(/^G?\s*(\d+)\s*EC$/i)
  if (ec) return `G${ec[1]} EC`
  const form = s.match(/^G?(\d+)([A-Za-z])$/i)
  if (form) return `${form[1]}${form[2].toUpperCase()}`
  return s
}

export const CALENDAR_HEADERS = [
  'Date',
  'DayOfWeek',
  'Event',
  'Category',
  'PIC',
  'Notes',
  'IsHoliday',
  'IsConsecutiveHoliday',
] as const

export type CalendarCsvRow = {
  date: string
  title: string
  kind: 'holiday' | 'event' | 'non-school-day' | 'school-day'
  notes: string
  pic: string
}

export function calendarTemplateCsv(): string {
  return toCsv([...CALENDAR_HEADERS], [
    ['2026-09-01', 'Tuesday', 'Beginning of School Year', 'School Start', '', '', 'No', 'No'],
  ])
}

export function parseCalendarCsv(text: string): ParsedYearCsv<CalendarCsvRow[]> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const data: CalendarCsvRow[] = []
  const previewRows: string[][] = []

  rows.forEach((row, idx) => {
    const line = idx + 2
    const date = cell(row, 'Date', 'date')
    const title = cell(row, 'Event', 'title', 'Title')
    if (!date && !title) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      issues.push({ row: line, message: 'Date 須為 YYYY-MM-DD' })
      return
    }
    if (!title) {
      issues.push({ row: line, message: '缺少 Event' })
      return
    }
    const isHoliday = truthyFlag(cell(row, 'IsHoliday'))
    const category = cell(row, 'Category').toLowerCase()
    let kind: CalendarCsvRow['kind'] = 'event'
    if (isHoliday || category.includes('holiday')) kind = 'holiday'
    else if (category.includes('non-school') || category.includes('no school')) {
      kind = 'non-school-day'
    }
    data.push({
      date,
      title,
      kind,
      notes: cell(row, 'Notes'),
      pic: cell(row, 'PIC'),
    })
    previewRows.push([date, title, kind])
  })

  return { ok: issues.length === 0 && data.length > 0, data, issues, previewRows }
}

export const ASSESSMENT_HEADERS = [
  'grade',
  'category',
  'semester',
  'part',
  'note',
  'teacher_initial',
  'weight',
  'section',
  'ec_slot',
] as const

export function assessmentTemplateCsv(): string {
  return toCsv([...ASSESSMENT_HEADERS], [
    ['中一 (G7)', 'phaseTest', 'first', '', '', 'FYC', '0.5', 'matrix', ''],
    ['中一', '', '', '', '', 'WKL', '', 'ec', 'firstPaper1'],
  ])
}

export function assessmentDutyToCsv(duty: AssessmentDutyYear): string {
  const rows: Array<Array<string>> = []
  for (const grade of duty.gradeMatrix) {
    for (const [cat, slots] of Object.entries(grade.categories)) {
      for (const slot of slots ?? []) {
        rows.push([
          grade.gradeLabel,
          cat,
          slot.semester,
          slot.part ?? '',
          slot.note ?? '',
          slot.teacherCode,
          slot.weight != null ? String(slot.weight) : '',
          'matrix',
          '',
        ])
      }
    }
  }
  for (const ec of duty.ecAppendix) {
    for (const [ecSlot, code] of [
      ['firstPaper1', ec.firstPaper1],
      ['firstPaper2', ec.firstPaper2],
      ['secondPaper1', ec.secondPaper1],
      ['secondPaper2', ec.secondPaper2],
    ] as const) {
      if (!code) continue
      rows.push([ec.grade, '', '', '', '', code, '', 'ec', ecSlot])
    }
  }
  return toCsv([...ASSESSMENT_HEADERS], rows)
}

function parseSemester(raw: string): DutySemester {
  const s = raw.trim().toLowerCase()
  if (s === 'second' || s === '2' || s === '下') return 'second'
  if (s === 'both' || s === '全年') return 'both'
  if (s === 'mock') return 'mock'
  if (s === 'year' || s === '學年') return 'year'
  return 'first'
}

function parsePart(raw: string): DutyPart | null {
  const s = raw.trim()
  if (s === '甲' || s === '乙' || s === '甲乙') return s
  return null
}

export function parseAssessmentDutyCsv(
  text: string,
  startYear: number,
  base?: AssessmentDutyYear | null,
): ParsedYearCsv<AssessmentDutyYear> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const duty = base
    ? structuredClone(base)
    : createEmptyAssessmentDuty(startYear)
  duty.startYear = startYear
  duty.label = formatAcademicYearLabel(startYear)
  if (!duty.categoryLabels) {
    duty.categoryLabels = { ...DEFAULT_ASSESSMENT_CATEGORY_LABELS }
  }

  const matrixByGrade = new Map<string, GradeDutyRow>()
  for (const g of duty.gradeMatrix) matrixByGrade.set(g.gradeLabel, { ...g, categories: {} })
  const ecByGrade = new Map<string, EcAppendixRow>()
  for (const ec of duty.ecAppendix) {
    ecByGrade.set(ec.grade, {
      grade: ec.grade,
      firstPaper1: null,
      firstPaper2: null,
      secondPaper1: null,
      secondPaper2: null,
    })
  }
  const previewRows: string[][] = []

  const labelToKey = new Map<string, AssessmentDutyCategoryKey>()
  for (const [k, v] of Object.entries(duty.categoryLabels)) {
    labelToKey.set(v, k as AssessmentDutyCategoryKey)
    labelToKey.set(k, k as AssessmentDutyCategoryKey)
  }

  rows.forEach((row, idx) => {
    const line = idx + 2
    const grade = cell(row, 'grade', 'Grade')
    const code = cell(row, 'teacher_initial', 'Initial', 'code').toUpperCase()
    const section = (cell(row, 'section') || 'matrix').toLowerCase()
    if (!grade && !code) return
    if (!grade || !code) {
      issues.push({ row: line, message: 'grade / teacher_initial 為必填' })
      return
    }
    previewRows.push([grade, cell(row, 'category'), cell(row, 'semester'), code, section])

    if (section === 'ec') {
      const ecSlot = cell(row, 'ec_slot', 'slot') as keyof Omit<EcAppendixRow, 'grade'>
      const key =
        ecSlot === 'firstPaper1' ||
        ecSlot === 'firstPaper2' ||
        ecSlot === 'secondPaper1' ||
        ecSlot === 'secondPaper2'
          ? ecSlot
          : 'firstPaper1'
      let ec = ecByGrade.get(grade)
      if (!ec) {
        ec = {
          grade,
          firstPaper1: null,
          firstPaper2: null,
          secondPaper1: null,
          secondPaper2: null,
        }
        ecByGrade.set(grade, ec)
      }
      ec[key] = code
      return
    }

    const paper = cell(row, 'category', 'paper', 'Paper')
    const catKey =
      labelToKey.get(paper) ??
      (['phaseTest', 'paper1', 'paper2', 'listeningSba', 'makeupSpecial'].includes(paper)
        ? (paper as AssessmentDutyCategoryKey)
        : null)
    if (!catKey) {
      issues.push({ row: line, message: `無法辨識 category：${paper || '(空白)'}` })
      return
    }
    let gradeRow = matrixByGrade.get(grade)
    if (!gradeRow) {
      gradeRow = {
        gradeLabel: grade,
        gradeShort: grade.replace(/^中[一二三四五六]\s*/u, '').replace(/[()]/g, '') || grade,
        categories: {},
      }
      matrixByGrade.set(grade, gradeRow)
    }
    const weightRaw = cell(row, 'weight')
    const weight = weightRaw === '' ? null : Number(weightRaw)
    const slot: DutySlot = {
      semester: parseSemester(cell(row, 'semester')),
      part: parsePart(cell(row, 'part')),
      note: cell(row, 'note') || null,
      teacherCode: code,
      weight: weight != null && Number.isFinite(weight) ? weight : null,
    }
    const slots = gradeRow.categories[catKey] ?? []
    slots.push(slot)
    gradeRow.categories[catKey] = slots
  })

  duty.gradeMatrix =
    matrixByGrade.size > 0 ? [...matrixByGrade.values()] : duty.gradeMatrix
  duty.ecAppendix = ecByGrade.size > 0 ? [...ecByGrade.values()] : duty.ecAppendix
  return {
    ok: issues.length === 0 && previewRows.length > 0,
    data: duty,
    issues,
    previewRows,
  }
}

export const DEPT_HEADERS = ['category', 'title', 'teacher_initial', 'role', 'notes'] as const

export function deptTemplateCsv(): string {
  return toCsv([...DEPT_HEADERS], [
    ['課程', '初中課程', 'FYC', 'leader', ''],
    ['課程', '初中課程', 'LKL', 'member', ''],
  ])
}

export function deptDutyToCsv(duty: DeptDutyYear): string {
  const rows: Array<Array<string>> = []
  for (const item of duty.items) {
    for (const p of item.leaders) {
      rows.push(['', item.title, p.code, 'leader', p.note ?? ''])
    }
    for (const p of item.members) {
      rows.push(['', item.title, p.code, 'member', p.note ?? ''])
    }
    for (const g of item.memberGroups ?? []) {
      for (const p of g.people) {
        rows.push([g.label, item.title, p.code, 'member', p.note ?? ''])
      }
    }
  }
  return toCsv([...DEPT_HEADERS], rows)
}

export function parseDeptDutyCsv(
  text: string,
  startYear: number,
  base?: DeptDutyYear | null,
): ParsedYearCsv<DeptDutyYear> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const byTitle = new Map<string, DeptDutyItem>()
  const previewRows: string[][] = []
  let nextId = 1

  rows.forEach((row, idx) => {
    const line = idx + 2
    const title = cell(row, 'title', 'Title')
    const code = cell(row, 'teacher_initial', 'Initial', 'code').toUpperCase()
    const role = (cell(row, 'role') || 'member').toLowerCase()
    const category = cell(row, 'category')
    const notes = cell(row, 'notes', 'note')
    if (!title && !code) return
    if (!title || !code) {
      issues.push({ row: line, message: 'title / teacher_initial 為必填' })
      return
    }
    previewRows.push([category, title, code, role])
    let item = byTitle.get(title)
    if (!item) {
      item = {
        id: nextId++,
        title,
        leaders: [],
        members: [],
        memberGroups: category ? [{ label: category, people: [] }] : undefined,
      }
      byTitle.set(title, item)
    }
    const person: DeptDutyPerson = { code, name: code, note: notes || undefined }
    if (role === 'leader') {
      if (!item.leaders.some((p) => p.code === code)) item.leaders.push(person)
    } else if (category) {
      if (!item.memberGroups) item.memberGroups = []
      let group = item.memberGroups.find((g) => g.label === category)
      if (!group) {
        group = { label: category, people: [] }
        item.memberGroups.push(group)
      }
      if (!group.people.some((p) => p.code === code)) group.people.push(person)
    } else if (!item.members.some((p) => p.code === code)) {
      item.members.push(person)
    }
  })

  const duty: DeptDutyYear = {
    startYear,
    label: base?.label || formatAcademicYearLabel(startYear),
    source: base?.source || 'csv-import',
    items: [...byTitle.values()],
    teachers: [],
  }

  return {
    ok: issues.length === 0 && duty.items.length > 0,
    data: duty,
    issues,
    previewRows,
  }
}

export const SCORES_HEADERS = [
  'stid',
  'semester',
  'daily',
  'reading',
  'writing',
] as const

export type ScoreCsvRow = {
  student_no: string
  semester: 1 | 2
  daily: number
  reading: number
  writing: number
}

export function scoresTemplateCsv(): string {
  return toCsv([...SCORES_HEADERS], [['12345', 1, 80, 75, 70]])
}

export function parseScoresCsv(
  text: string,
  startYear: number,
): ParsedYearCsv<ScoreCsvRow[]> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const data: ScoreCsvRow[] = []
  const previewRows: string[][] = []

  rows.forEach((row, idx) => {
    const line = idx + 2
    const stid = cell(row, 'stid', 'STID')
    const semester = Number(cell(row, 'semester', 'Semester'))
    const daily = Number(cell(row, 'daily', 'Daily'))
    const reading = Number(cell(row, 'reading', 'Reading'))
    const writing = Number(cell(row, 'writing', 'Writing'))
    if (!stid) return
    if (semester !== 1 && semester !== 2) {
      issues.push({ row: line, message: 'semester 須為 1 或 2' })
      return
    }
    for (const [label, n] of [
      ['daily', daily],
      ['reading', reading],
      ['writing', writing],
    ] as const) {
      if (!Number.isFinite(n)) {
        issues.push({ row: line, message: `${label} 無效` })
        return
      }
    }
    data.push({
      student_no: storedStudentNo(startYear, stid),
      semester: semester as 1 | 2,
      daily,
      reading,
      writing,
    })
    previewRows.push([stid, String(semester), String(daily), String(reading), String(writing)])
  })

  return { ok: issues.length === 0 && data.length > 0, data, issues, previewRows }
}

export const DEADLINE_HEADERS = [
  'grade',
  'activity_title',
  'activity_due',
  'submitted',
] as const

export function deadlinesToCsv(rows: GradeDeadline[]): string {
  return toCsv(
    [...DEADLINE_HEADERS],
    rows.map((d) => [
      d.grade,
      d.activityTitle,
      d.activityDue,
      d.submitted ? 'Y' : 'N',
    ]),
  )
}

export function deadlinesTemplateCsv(): string {
  return deadlinesToCsv(emptyGradeDeadlines())
}

export function parseDeadlinesCsv(text: string): ParsedYearCsv<GradeDeadline[]> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const base = emptyGradeDeadlines()
  const byGrade = new Map(base.map((d) => [d.grade, { ...d }]))
  const previewRows: string[][] = []

  rows.forEach((row, idx) => {
    const line = idx + 2
    const grade = Number(cell(row, 'grade', 'Grade'))
    if (!grade) return
    if (!byGrade.has(grade)) {
      issues.push({ row: line, message: `不支援年級 ${grade}` })
      return
    }
    const next = byGrade.get(grade)!
    next.activityTitle = cell(row, 'activity_title', 'activityTitle')
    next.activityDue = cell(row, 'activity_due', 'activityDue')
    next.submitted = truthyFlag(cell(row, 'submitted'))
    previewRows.push([
      String(grade),
      next.activityTitle,
      next.activityDue,
      next.submitted ? 'Y' : 'N',
    ])
  })

  return {
    ok: issues.length === 0,
    data: [...byGrade.values()],
    issues,
    previewRows,
  }
}

export const TIMETABLE_HEADERS = [
  'teacher_initial',
  'weekday',
  'start',
  'end',
  'type',
  'subject',
  'group',
  'room',
  'label',
] as const

export type TimetableYearMap = Record<string, TeacherTimetableEntry>

function isSchoolWeekday(n: number): n is SchoolWeekday {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5
}

export function timetableTemplateCsv(): string {
  return toCsv([...TIMETABLE_HEADERS], [
    ['FYC', 1, '08:30', '09:15', 'lesson', 'CHIN', '7A', 'R101', ''],
    ['FYC', 1, '09:15', '09:30', 'break', '', '', '', '小息'],
    ['FYC', 1, '09:30', '10:15', 'free', '', '', '', ''],
  ])
}

export function timetablesToCsv(timetables: TimetableYearMap): string {
  const rows: Array<Array<string | number>> = []
  const teacherIds = Object.keys(timetables).sort((a, b) => a.localeCompare(b))
  for (const teacherId of teacherIds) {
    const initial = teacherId.replace(/^u-/i, '').toUpperCase()
    const entry = timetables[teacherId]
    for (const day of [1, 2, 3, 4, 5] as const) {
      for (const period of entry.weekly[day] ?? []) {
        rows.push([
          initial,
          day,
          period.start,
          period.end,
          period.type,
          period.type === 'lesson' ? period.subject : '',
          period.type === 'lesson' ? period.group : '',
          period.type === 'lesson' ? period.room : '',
          period.type === 'break' ? period.label ?? '' : '',
        ])
      }
    }
  }
  return toCsv([...TIMETABLE_HEADERS], rows)
}

export function parseTimetableCsv(
  text: string,
  startYear: number,
): ParsedYearCsv<TimetableYearMap> {
  const { rows } = parseCsv(text)
  const issues: CsvIssue[] = []
  const previewRows: string[][] = []
  const byTeacher = new Map<
    string,
    { initial: string; weekly: Record<SchoolWeekday, DayPeriod[]> }
  >()
  const year = academicYearWindowForIso(`${startYear}-09-01`)

  rows.forEach((row, idx) => {
    const line = idx + 2
    const initial = cell(row, 'teacher_initial', 'Initial', 'teacher').toUpperCase()
    const weekdayRaw = cell(row, 'weekday', 'day', 'Dow')
    const start = cell(row, 'start', 'Start')
    const end = cell(row, 'end', 'End')
    const type = cell(row, 'type', 'Type').toLowerCase()
    if (!initial && !start && !type) return
    if (!initial) {
      issues.push({ row: line, message: '缺少 teacher_initial' })
      return
    }
    const weekday = Number(weekdayRaw)
    if (!isSchoolWeekday(weekday)) {
      issues.push({ row: line, message: 'weekday 須為 1–5（一至五）' })
      return
    }
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
      issues.push({ row: line, message: 'start / end 須為 HH:MM' })
      return
    }
    const nt = (t: string) => {
      const [h, min] = t.split(':')
      return `${Number(h).toString().padStart(2, '0')}:${min}`
    }
    const startN = nt(start)
    const endN = nt(end)
    let period: DayPeriod | null = null
    if (type === 'lesson') {
      period = {
        type: 'lesson',
        start: startN,
        end: endN,
        subject: cell(row, 'subject', 'Subject'),
        group: cell(row, 'group', 'Group', 'class'),
        room: cell(row, 'room', 'Room'),
      }
    } else if (type === 'free') {
      period = { type: 'free', start: startN, end: endN }
    } else if (type === 'break') {
      period = {
        type: 'break',
        start: startN,
        end: endN,
        label: cell(row, 'label', 'Label') || undefined,
      }
    } else {
      issues.push({ row: line, message: `type 須為 lesson / free / break（收到 ${type || '空白'}）` })
      return
    }
    let bucket = byTeacher.get(initial)
    if (!bucket) {
      bucket = {
        initial,
        weekly: { 1: [], 2: [], 3: [], 4: [], 5: [] },
      }
      byTeacher.set(initial, bucket)
    }
    bucket.weekly[weekday].push(period)
    previewRows.push([
      initial,
      String(weekday),
      startN,
      endN,
      type,
      period.type === 'lesson' ? period.subject : period.type === 'break' ? period.label ?? '' : '',
    ])
  })

  const data: TimetableYearMap = {}
  for (const [initial, bucket] of byTeacher) {
    data[`u-${initial.toLowerCase()}`] = {
      academicYear: { ...year },
      weekly: bucket.weekly,
    }
  }

  return {
    ok: issues.length === 0 && Object.keys(data).length > 0,
    data,
    issues,
    previewRows,
  }
}

export function emptyTemplateForKind(kind: YearCsvKind): string {
  switch (kind) {
    case 'teacher_whitelist':
      return toCsv([...WHITELIST_HEADERS], [])
    case 'student_roster':
      return rosterTemplateCsv()
    case 'chinese_streaming':
      return streamingTemplateCsv()
    case 'school_calendar':
      return calendarTemplateCsv()
    case 'assessment_duty':
      return assessmentTemplateCsv()
    case 'dept_duty':
      return deptTemplateCsv()
    case 'semester_scores':
      return scoresTemplateCsv()
    case 'grade_deadlines':
      return deadlinesTemplateCsv()
    case 'teacher_timetable':
      return timetableTemplateCsv()
  }
}
