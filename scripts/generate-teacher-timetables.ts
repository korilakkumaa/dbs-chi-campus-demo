/**
 * Regenerates teacher weekly timetable modules from a CLS Excel export.
 *
 *   npx tsx scripts/generate-teacher-timetables.ts --year 2026 [path.xlsx]
 *   npx tsx scripts/generate-teacher-timetables.ts --year 2025 [path.xlsx]
 *
 * Default (no --year) is 2026/27 so existing generate:timetables stays unchanged.
 */
import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import xlsx from 'xlsx'

const XLSX = xlsx

type YearPreset = {
  label: string
  validFrom: string
  validTo: string
  teachingUntil: string
  out: string
  exportName: string
  defaultXlsx: string
}

const YEAR_PRESETS: Record<number, YearPreset> = {
  2025: {
    label: '2025/26',
    validFrom: '2025-09-01',
    validTo: '2026-08-31',
    teachingUntil: '2026-07-15',
    out: 'src/data/teacherWeekly2526.generated.ts',
    exportName: 'TEACHER_WEEKLY_2526',
    defaultXlsx: '/Users/apple/Downloads/CHINESETeacher_V7_20250903.xlsx',
  },
  2026: {
    label: '2026/27',
    validFrom: '2026-09-01',
    validTo: '2027-08-31',
    teachingUntil: '2027-07-12',
    out: 'src/data/teacherWeekly2627.generated.ts',
    exportName: 'TEACHER_WEEKLY_2627',
    defaultXlsx: '/Users/apple/Downloads/CHNESETeacher_3Aug2026.xlsx',
  },
}

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

function tidyGroup(raw: string): string {
  return raw.replace(/,/g, ', ').replace(/,\s+/g, ', ')
}

/** Token is one teacher initial, or a comma-separated list of them (CLP slots). */
function looksLikeTeacherToken(token: string, initials: Set<string>): boolean {
  const bits = token
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  if (bits.length === 0) return false
  return bits.every((b) => initials.has(b))
}

/**
 * CLS cells are either:
 *   Group Subject Room                  (2026/27)
 *   Group Subject Teacher Room          (2025/26)
 *   Group Subject Teacher[,Teacher…]    (CLP / meetings, no room)
 */
function parseLesson(text: string, initials: Set<string>): Period | null {
  const t = text.trim()
  if (!t) return null
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { type: 'lesson', start: '', end: '', subject: '', group: parts[0], room: '' }
  }
  if (parts.length === 2) {
    return {
      type: 'lesson',
      start: '',
      end: '',
      group: tidyGroup(parts[0]),
      subject: parts[1],
      room: '',
    }
  }

  let room = ''
  let subject = ''
  let groupParts: string[]

  if (looksLikeTeacherToken(parts[parts.length - 1], initials)) {
    room = ''
    subject = parts[parts.length - 2]
    groupParts = parts.slice(0, -2)
  } else if (
    parts.length >= 4 &&
    looksLikeTeacherToken(parts[parts.length - 2], initials)
  ) {
    room = parts[parts.length - 1]
    subject = parts[parts.length - 3]
    groupParts = parts.slice(0, -3)
  } else {
    room = parts[parts.length - 1]
    subject = parts[parts.length - 2]
    groupParts = parts.slice(0, -2)
  }

  return {
    type: 'lesson',
    start: '',
    end: '',
    group: tidyGroup(groupParts.join(' ')),
    subject,
    room,
  }
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function parseSheet(
  wb: XLSX.WorkBook,
  name: string,
  initials: Set<string>,
): Record<1 | 2 | 3 | 4 | 5, Period[]> {
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
      const parsed = parseLesson(String(cell), initials)
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

function parseArgs(): { year: number; file: string } {
  const args = process.argv.slice(2)
  let year = 2026
  let file: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--year') {
      const raw = args[++i]
      const n = Number(raw)
      if (!YEAR_PRESETS[n]) {
        throw new Error(`Unknown --year ${raw}. Use ${Object.keys(YEAR_PRESETS).join(' or ')}.`)
      }
      year = n
      continue
    }
    if (a.startsWith('-')) {
      throw new Error(`Unknown flag ${a}`)
    }
    file = a
  }
  const preset = YEAR_PRESETS[year]
  return { year, file: file ?? preset.defaultXlsx }
}

function main() {
  const { year, file } = parseArgs()
  const preset = YEAR_PRESETS[year]
  if (!preset) throw new Error(`Missing preset for ${year}`)
  const wb = XLSX.readFile(file, { cellDates: false })
  const initials = new Set(wb.SheetNames.map((n) => n.trim().toUpperCase()))
  const all: Record<string, Record<1 | 2 | 3 | 4 | 5, Period[]>> = {}
  for (const name of wb.SheetNames) {
    all[name] = parseSheet(wb, name, initials)
    const lessons = Object.values(all[name]).flat().filter((p) => p.type === 'lesson').length
    console.log(name, 'lessons', lessons)
  }

  const lines: string[] = [
    `/** Auto-generated from ${basename(file)} — ${preset.label}. Do not edit by hand. */`,
    `import type { DayPeriod, SchoolWeekday } from './teacherTimetable'`,
    '',
    'const YEAR = {',
    `  label: '${preset.label}',`,
    `  validFrom: '${preset.validFrom}',`,
    `  validTo: '${preset.validTo}',`,
    `  teachingUntil: '${preset.teachingUntil}',`,
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

  lines.push(`export const ${preset.exportName}: Record<`)
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

  writeFileSync(preset.out, lines.join('\n'), 'utf8')
  console.log('Wrote', preset.out)
}

main()
