/**
 * Regenerates school-wide class weekly timetable modules from a Class Excel export.
 *
 *   npx tsx scripts/generate-class-timetables.ts --year 2026 [path.xlsx]
 *
 * Class cells are `Subject Teacher Room` (newline-separated when streamed).
 * Output mirrors the personal (teacher) DayPeriod shape, with teacher initials
 * stored in `group` and concurrent streams joined as " · " within one slot.
 */
import { writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
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
  2026: {
    label: '2026/27',
    validFrom: '2026-09-01',
    validTo: '2027-08-31',
    teachingUntil: '2027-07-12',
    out: 'src/data/classWeekly2627.generated.ts',
    exportName: 'CLASS_WEEKLY_2627',
    defaultXlsx: resolve('data/source/Class&ClassT_2Sep2026_V6.xlsx'),
  },
}

type Period =
  | { type: 'lesson'; start: string; end: string; subject: string; group: string; room: string }
  | { type: 'free'; start: string; end: string }
  | { type: 'break'; start: string; end: string; label: string }

type ClassMeta = {
  classKey: string
  sheetName: string
  classTeacher: string
  homeRoom: string
  gradeLabel: string
}

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

/** One line: Subject Teacher[,Teacher…] [Room] */
function parseLessonLine(text: string): {
  subject: string
  teacher: string
  room: string
} | null {
  const t = text.trim()
  if (!t) return null
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { subject: parts[0], teacher: '', room: '' }
  }
  if (parts.length === 2) {
    return { subject: parts[0], teacher: parts[1].replace(/,/g, ', '), room: '' }
  }
  return {
    subject: parts[0],
    teacher: parts[1].replace(/,/g, ', '),
    room: parts.slice(2).join(' '),
  }
}

/**
 * Collapse one or more concurrent lines into a single DayPeriod-shaped lesson.
 * Subject / teacher / room are joined with " · " when streamed.
 */
function parseCell(text: string): Period | null {
  const lines = String(text)
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseLessonLine)
    .filter((x): x is NonNullable<typeof x> => x != null)
  if (lines.length === 0) return null
  return {
    type: 'lesson',
    start: '',
    end: '',
    subject: lines.map((l) => l.subject).join(' · '),
    group: lines.map((l) => l.teacher).filter(Boolean).join(' · '),
    room: lines.map((l) => l.room).filter(Boolean).join(' · '),
  }
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function parseSheetMeta(titleCell: unknown, sheetName: string): ClassMeta {
  const title = String(titleCell ?? '')
  const classTeacher =
    title.match(/Class Teacher\(s\):\s*([^H]*?)(?:Home Room:|$)/i)?.[1]?.trim() ??
    ''
  const homeRoom = title.match(/Home Room:\s*(.*)$/i)?.[1]?.trim() ?? ''

  const form = sheetName.match(/^S(\d+)-(G\d+[A-Z]+)$/i)
  if (form) {
    const classKey = form[2].toUpperCase()
    return {
      classKey,
      sheetName,
      classTeacher,
      homeRoom,
      gradeLabel: `G${classKey.match(/\d+/)?.[0] ?? form[1]}`,
    }
  }
  const clp = sheetName.match(/^CLP-(CLP\d+)$/i)
  if (clp) {
    const classKey = clp[1].toUpperCase()
    return {
      classKey,
      sheetName,
      classTeacher,
      homeRoom,
      gradeLabel: 'CLP',
    }
  }
  return {
    classKey: sheetName.toUpperCase(),
    sheetName,
    classTeacher,
    homeRoom,
    gradeLabel: '其他',
  }
}

function parseSheet(
  wb: XLSX.WorkBook,
  name: string,
): { meta: ClassMeta; weekly: Record<1 | 2 | 3 | 4 | 5, Period[]> } {
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  let titleCell: unknown = null
  let headerI = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    if (titleCell == null && row[0] != null && String(row[0]).includes('Timetable')) {
      titleCell = row[0]
    }
    if (String(row[1] ?? '').trim().toLowerCase() === 'mon') {
      headerI = i
      break
    }
  }

  const meta = parseSheetMeta(titleCell, name)
  const weekly: Record<1 | 2 | 3 | 4 | 5, Period[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  }
  if (headerI < 0) return { meta, weekly }

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
      const parsed = parseCell(String(cell))
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
  return { meta, weekly }
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
        throw new Error(
          `Unknown --year ${raw}. Use ${Object.keys(YEAR_PRESETS).join(' or ')}.`,
        )
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

function constName(classKey: string): string {
  return `${classKey.replace(/[^A-Za-z0-9]/g, '_')}_WEEKLY`
}

function sortClassKeys(a: string, b: string): number {
  const grade = (k: string) => {
    if (k.startsWith('CLP')) return 100
    const m = k.match(/^G(\d+)/i)
    return m ? Number(m[1]) : 99
  }
  const ga = grade(a)
  const gb = grade(b)
  if (ga !== gb) return ga - gb
  return a.localeCompare(b, 'en')
}

function main() {
  const { year, file } = parseArgs()
  const preset = YEAR_PRESETS[year]
  if (!preset) throw new Error(`Missing preset for ${year}`)
  const wb = XLSX.readFile(file, { cellDates: false })
  const all: Record<
    string,
    { meta: ClassMeta; weekly: Record<1 | 2 | 3 | 4 | 5, Period[]> }
  > = {}

  for (const name of wb.SheetNames) {
    const parsed = parseSheet(wb, name)
    if (all[parsed.meta.classKey]) {
      console.warn(
        `Duplicate classKey ${parsed.meta.classKey} from ${name}; keeping first`,
      )
      continue
    }
    all[parsed.meta.classKey] = parsed
    const lessons = Object.values(parsed.weekly)
      .flat()
      .filter((p) => p.type === 'lesson').length
    console.log(parsed.meta.classKey, 'lessons', lessons)
  }

  const keys = Object.keys(all).sort(sortClassKeys)

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
    'type ClassWeeklyEntry = {',
    '  classKey: string',
    '  gradeLabel: string',
    '  classTeacher: string',
    '  homeRoom: string',
    '  academicYear: typeof YEAR',
    '  weekly: Record<SchoolWeekday, DayPeriod[]>',
    '}',
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

  for (const classKey of keys) {
    const { weekly } = all[classKey]
    const v = constName(classKey)
    lines.push(`const ${v}: Record<SchoolWeekday, DayPeriod[]> = {`)
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

  lines.push(`export const ${preset.exportName}: Record<string, ClassWeeklyEntry> = {`)
  for (const classKey of keys) {
    const { meta } = all[classKey]
    lines.push(`  '${esc(classKey)}': {`)
    lines.push(`    classKey: '${esc(meta.classKey)}',`)
    lines.push(`    gradeLabel: '${esc(meta.gradeLabel)}',`)
    lines.push(`    classTeacher: '${esc(meta.classTeacher)}',`)
    lines.push(`    homeRoom: '${esc(meta.homeRoom)}',`)
    lines.push(`    academicYear: { ...YEAR },`)
    lines.push(`    weekly: ${constName(classKey)},`)
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')

  writeFileSync(preset.out, lines.join('\n'), 'utf8')
  console.log('Wrote', preset.out, `(${keys.length} classes)`)
}

main()
