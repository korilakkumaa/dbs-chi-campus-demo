/**
 * Regenerates src/data/assessmentDuty2627.generated.ts from the assessment duty workbook.
 *
 *   npm run import:assessment-duty
 *   tsx scripts/import-assessment-duty.ts [path.xlsx]
 */
import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import xlsx from 'xlsx'
import {
  gradeShortLabel,
  parseEcAppendix,
  parseGradeCell,
  parseTeacherBullets,
} from '../src/data/assessmentDutyParse'
import type { AssessmentDutyCategoryKey } from '../src/data/assessmentDutyTypes'
import type { DutySlot, TeacherDutyItem } from '../src/data/assessmentDutyParse'

const XLSX = xlsx
const DEFAULT = 'data/source/2026-2027_Chinese_Assessment_Duty.xlsx'
const OUT = 'src/data/assessmentDuty2627.generated.ts'
const START_YEAR = 2026

const CATEGORY_KEYS: AssessmentDutyCategoryKey[] = [
  'phaseTest',
  'paper1',
  'paper2',
  'listeningSba',
  'makeupSpecial',
]

const CATEGORY_LABELS: Record<AssessmentDutyCategoryKey, string> = {
  phaseTest: '階段性統測',
  paper1: '卷一：閱讀能力',
  paper2: '卷二：寫作能力',
  listeningSba: '聆聽評估 / SBA 校本評核',
  makeupSpecial: '學年補考 / 專項分班試',
}

const CATEGORY_SHORT: Record<AssessmentDutyCategoryKey, string> = {
  phaseTest: '統測',
  paper1: '卷一',
  paper2: '卷二',
  listeningSba: '聆聽/SBA',
  makeupSpecial: '補考/專項',
}

function lit(v: unknown) {
  return JSON.stringify(v)
}

function cellStr(v: unknown): string | null {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (!s || s === '—') return null
  return s
}

function parseWeight(v: unknown): number | null {
  if (v == null || v === '' || v === '—') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseTeacherName(raw: string): { name: string; code: string } {
  const m = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (m) return { name: m[1].trim(), code: m[2].trim() }
  return { name: raw.trim(), code: '' }
}

function emitSlots(slots: DutySlot[], indent: string) {
  return slots
    .map(
      (s) =>
        `${indent}{ semester: ${lit(s.semester)}, part: ${s.part ? lit(s.part) : 'null'}, note: ${s.note ? lit(s.note) : 'null'}, teacherCode: ${lit(s.teacherCode)}, weight: ${s.weight ?? 'null'} },`,
    )
    .join('\n')
}

function emitTeacherItems(items: TeacherDutyItem[], indent: string) {
  return items
    .map(
      (item) =>
        `${indent}{ ec: ${item.ec}, grade: ${lit(item.grade)}, task: ${lit(item.task)}, weight: ${item.weight ?? 'null'} },`,
    )
    .join('\n')
}

function parseGradeMatrix(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['各級考核擬題分工表']
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  const headerRow = rows.find(
    (r) => r?.[0] === '考核年級' && String(r?.[1] ?? '').includes('階段性'),
  )
  if (!headerRow) throw new Error('Grade matrix header row not found')

  const headerIdx = rows.indexOf(headerRow)
  const gradeRows: {
    gradeLabel: string
    gradeShort: string
    categories: Partial<Record<AssessmentDutyCategoryKey, DutySlot[]>>
  }[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const gradeLabel = cellStr(row?.[0])
    if (!gradeLabel) break
    if (gradeLabel.startsWith('【附錄')) break

    const categories: Partial<Record<AssessmentDutyCategoryKey, DutySlot[]>> = {}
    CATEGORY_KEYS.forEach((key, colIdx) => {
      const val = cellStr(row?.[colIdx + 1])
      const slots = parseGradeCell(val)
      if (slots.length) categories[key] = slots
    })
    gradeRows.push({
      gradeLabel,
      gradeShort: gradeShortLabel(gradeLabel),
      categories,
    })
  }

  const appendix: string[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const first = cellStr(row?.[0])
    if (!first) continue
    if (first.startsWith('•')) appendix.push(first)
  }

  return { gradeRows, appendix }
}

function parseTeacherStats(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets['教師個人考核擬題統計表']
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  const headerIdx = rows.findIndex((r) => r?.[0] === '教師')
  if (headerIdx < 0) throw new Error('Teacher stats header row not found')

  const teachers: {
    name: string
    code: string
    firstSemester: TeacherDutyItem[]
    secondSemester: TeacherDutyItem[]
    totalWeight: number | null
  }[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const rawName = cellStr(row?.[0])
    if (!rawName) continue
    if (rawName.startsWith('備註')) break

    const { name, code } = parseTeacherName(rawName)
    teachers.push({
      name,
      code,
      firstSemester: parseTeacherBullets(cellStr(row?.[1])),
      secondSemester: parseTeacherBullets(cellStr(row?.[2])),
      totalWeight: parseWeight(row?.[3]),
    })
  }

  return teachers
}

function workloadTier(weight: number | null): 'high' | 'medium' | 'moderate' | 'low' | 'none' {
  if (weight == null) return 'none'
  if (weight >= 3) return 'high'
  if (weight >= 2.5) return 'medium'
  if (weight >= 2) return 'moderate'
  return 'low'
}

function emit() {
  const path = process.argv[2] ?? DEFAULT
  const wb = XLSX.readFile(path)
  const { gradeRows, appendix } = parseGradeMatrix(wb)
  const teachers = parseTeacherStats(wb)
  const ecAppendix = parseEcAppendix(appendix)

  const lines: string[] = []
  lines.push(`/** Auto-generated from ${basename(path)} — 2026/27. Do not edit by hand. */`)
  lines.push(`import type { AssessmentDutyYear } from './assessmentDutyTypes'`)
  lines.push('')
  lines.push(`export const ASSESSMENT_DUTY_2627: AssessmentDutyYear = {`)
  lines.push(`  startYear: ${START_YEAR},`)
  lines.push(`  label: '2026/27',`)
  lines.push(`  title: '2026-2027年度 中文科各級考核擬題與分工',`)
  lines.push(`  categoryLabels: {`)
  for (const key of CATEGORY_KEYS) lines.push(`    ${key}: ${lit(CATEGORY_LABELS[key])},`)
  lines.push(`  },`)
  lines.push(`  categoryShortLabels: {`)
  for (const key of CATEGORY_KEYS) lines.push(`    ${key}: ${lit(CATEGORY_SHORT[key])},`)
  lines.push(`  },`)
  lines.push(`  gradeMatrix: [`)
  for (const row of gradeRows) {
    lines.push(`    {`)
    lines.push(`      gradeLabel: ${lit(row.gradeLabel)},`)
    lines.push(`      gradeShort: ${lit(row.gradeShort)},`)
    lines.push(`      categories: {`)
    for (const key of CATEGORY_KEYS) {
      const slots = row.categories[key]
      if (!slots?.length) continue
      lines.push(`        ${key}: [`)
      lines.push(emitSlots(slots, '          '))
      lines.push(`        ],`)
    }
    lines.push(`      },`)
    lines.push(`    },`)
  }
  lines.push(`  ],`)
  lines.push(`  teachers: [`)
  for (const t of teachers) {
    lines.push(`    {`)
    lines.push(`      name: ${lit(t.name)},`)
    lines.push(`      code: ${lit(t.code)},`)
    lines.push(`      firstSemester: [`)
    if (t.firstSemester.length) lines.push(emitTeacherItems(t.firstSemester, '        '))
    lines.push(`      ],`)
    lines.push(`      secondSemester: [`)
    if (t.secondSemester.length) lines.push(emitTeacherItems(t.secondSemester, '        '))
    lines.push(`      ],`)
    lines.push(`      totalWeight: ${t.totalWeight ?? 'null'},`)
    lines.push(`      workloadTier: '${workloadTier(t.totalWeight)}',`)
    lines.push(`    },`)
  }
  lines.push(`  ],`)
  lines.push(`  ecAppendix: [`)
  for (const row of ecAppendix) {
    lines.push(`    {`)
    lines.push(`      grade: ${lit(row.grade)},`)
    lines.push(`      firstPaper1: ${row.firstPaper1 ? lit(row.firstPaper1) : 'null'},`)
    lines.push(`      firstPaper2: ${row.firstPaper2 ? lit(row.firstPaper2) : 'null'},`)
    lines.push(`      secondPaper1: ${row.secondPaper1 ? lit(row.secondPaper1) : 'null'},`)
    lines.push(`      secondPaper2: ${row.secondPaper2 ? lit(row.secondPaper2) : 'null'},`)
    lines.push(`    },`)
  }
  lines.push(`  ],`)
  lines.push(`}`)
  lines.push('')

  writeFileSync(OUT, lines.join('\n'), 'utf8')
  console.log(`Wrote ${OUT} (${gradeRows.length} grades, ${teachers.length} teachers)`)
}

emit()
