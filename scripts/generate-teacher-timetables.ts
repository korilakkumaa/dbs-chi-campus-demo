/**
 * Regenerates src/data/teacherWeekly2627.generated.ts from the CLS export.
 *
 *   node --import tsx scripts/generate-teacher-timetables.ts [path.xlsx]
 */
import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import xlsx from 'xlsx'

const XLSX = xlsx
const DEFAULT =
  '/Users/apple/Downloads/CHNESETeacher_3Aug2026.xlsx'
const OUT =
  'src/data/teacherWeekly2627.generated.ts'

type Period =
  | { type: 'lesson'; start: string; end: string; subject: string; group: string; room: string }
  | { type: 'free'; start: string; end: string }
  | { type: 'break'; start: string; end: string; label: string }

function parseTime(cell: unknown): [string, string] | null {
  if (cell == null) return null
  const s = String(cell).replace(/\n/g, '').replace(/\s/g, '')
  const m = s.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/)
  if (!m) return null
  const nt = (t: string) => {
    const [h, min] = t.split(':')
    return `${Number(h).toString().padStart(2, '0')}:${min}`
  }
  return [nt(m[1]), nt(m[2])]
}

function rowKind(row: unknown[]): 'assembly' | 'recess' | 'lunch' | 'slot' {
  for (const c of row.slice(1, 6)) {
    if (c == null) continue
    const s = String(c).trim().toLowerCase()
    if (s.includes('pre-school') || s.includes('assembly')) return 'assembly'
    if (s === 'recess') return 'recess'
    if (s === 'lunch') return 'lunch'
  }
  return 'slot'
}

function parseLesson(text: string): Period | null {
  const t = text.trim()
  if (!t) return null
  const parts = t.split(/\s+/)
  if (parts.length === 1) {
    return { type: 'lesson', start: '', end: '', subject: '', group: parts[0], room: '' }
  }
  if (parts.length === 2) {
    return {
      type: 'lesson',
      start: '',
      end: '',
      group: parts[0].replace(/,/g, ', ').replace(/,\s+/g, ', '),
      subject: parts[1],
      room: '',
    }
  }
  const room = parts[parts.length - 1]
  const subject = parts[parts.length - 2]
  const group = parts
    .slice(0, -2)
    .join(' ')
    .replace(/,/g, ', ')
    .replace(/,\s+/g, ', ')
  return { type: 'lesson', start: '', end: '', group, subject, room }
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function parseSheet(wb: XLSX.WorkBook, name: string): Record<1 | 2 | 3 | 4 | 5, Period[]> {
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  let headerI = -1
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i]?.[1] ?? '').trim().toLowerCase() === 'mon') {
      headerI = i
      break
    }
  }
  const weekly: Record<1 | 2 | 3 | 4 | 5, Period[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  }
  if (headerI < 0) return weekly

  for (const row of rows.slice(headerI + 1)) {
    if (!row?.[0]) continue
    const times = parseTime(row[0])
    if (!times) continue
    const [start, end] = times
    const kind = rowKind(row)
    if (kind === 'assembly') continue
    if (kind === 'recess') {
      for (const d of [1, 2, 3, 4, 5] as const) {
        weekly[d].push({ type: 'break', start, end, label: '小息' })
      }
      continue
    }
    if (kind === 'lunch') {
      for (const d of [1, 2, 3, 4, 5] as const) {
        weekly[d].push({ type: 'break', start, end, label: '午膳' })
      }
      continue
    }
    for (let col = 1; col <= 5; col++) {
      const day = col as 1 | 2 | 3 | 4 | 5
      const cell = row[col]
      if (cell == null || String(cell).trim() === '') {
        weekly[day].push({ type: 'free', start, end })
        continue
      }
      const parsed = parseLesson(String(cell))
      if (!parsed || parsed.type !== 'lesson') {
        weekly[day].push({ type: 'free', start, end })
      } else {
        weekly[day].push({
          type: 'lesson',
          start,
          end,
          subject: parsed.subject,
          group: parsed.group,
          room: parsed.room,
        })
      }
    }
  }
  return weekly
}

function main() {
  const file = process.argv[2] ?? DEFAULT
  const wb = XLSX.readFile(file, { cellDates: false })
  const all: Record<string, Record<1 | 2 | 3 | 4 | 5, Period[]>> = {}
  for (const name of wb.SheetNames) {
    all[name] = parseSheet(wb, name)
    const lessons = Object.values(all[name]).flat().filter((p) => p.type === 'lesson').length
    console.log(name, 'lessons', lessons)
  }

  const lines: string[] = [
    `/** Auto-generated from ${basename(file)} — 2026/27. Do not edit by hand. */`,
    `import type { DayPeriod, SchoolWeekday } from './teacherTimetable'`,
    '',
    'const YEAR = {',
    "  label: '2026/27',",
    "  validFrom: '2026-09-01',",
    "  validTo: '2027-08-31',",
    "  teachingUntil: '2027-07-12',",
    '} as const',
    '',
    'function L(start: string, end: string, subject: string, group: string, room: string): DayPeriod {',
    "  return { type: 'lesson', start, end, subject, group, room }",
    '}',
    'function F(start: string, end: string): DayPeriod {',
    "  return { type: 'free', start, end }",
    '}',
    'function B(start: string, end: string, label: string): DayPeriod {',
    "  return { type: 'break', start, end, label }",
    '}',
    '',
    'const MORNING: DayPeriod = { type: "break", start: "08:10", end: "08:30", label: "早會" }',
    'const DISMISSAL: DayPeriod = { type: "break", start: "15:30", end: "16:00", label: "放學" }',
    '',
    'function day(...middle: DayPeriod[]): DayPeriod[] {',
    '  return [MORNING, ...middle, DISMISSAL]',
    '}',
    '',
  ]

  for (const [initial, weekly] of Object.entries(all)) {
    const v = initial.toUpperCase()
    lines.push(`const ${v}_WEEKLY: Record<SchoolWeekday, DayPeriod[]> = {`)
    for (const d of [1, 2, 3, 4, 5] as const) {
      const parts = weekly[d].map((p) => {
        if (p.type === 'lesson') {
          return `L('${p.start}', '${p.end}', '${esc(p.subject)}', '${esc(p.group)}', '${esc(p.room)}')`
        }
        if (p.type === 'free') return `F('${p.start}', '${p.end}')`
        return `B('${p.start}', '${p.end}', '${esc(p.label)}')`
      })
      lines.push(`  ${d}: day(`)
      lines.push(`    ${parts.join(',\n    ')},`)
      lines.push(`  ),`)
    }
    lines.push('}')
    lines.push('')
  }

  lines.push('export const TEACHER_WEEKLY_2627: Record<')
  lines.push('  string,')
  lines.push('  { academicYear: typeof YEAR; weekly: Record<SchoolWeekday, DayPeriod[]> }')
  lines.push('> = {')
  for (const initial of Object.keys(all)) {
    lines.push(
      `  'u-${initial.toLowerCase()}': { academicYear: { ...YEAR }, weekly: ${initial.toUpperCase()}_WEEKLY },`,
    )
  }
  lines.push('}')
  lines.push('')

  writeFileSync(OUT, lines.join('\n'), 'utf8')
  console.log('Wrote', OUT)
}

main()
