import bundle from './calendar-bundle.json' with { type: 'json' }

export type CalendarEvent = {
  id: string
  date: string
  title: string
  kind: string
  createdBy: string
  audience: {
    type: string
    ownerId?: string
    teacherIds?: string[]
    grades?: number[]
    subjects?: string[]
  }
  schoolYearStart?: number
  time?: { start: string; end: string }
  lesson?: {
    group: string
    subject: string
    start: string
    end: string
    room?: string
  }
}

type WhitelistEntry = {
  userId: string
  initial: string
  classes: string[]
}

const KIND_LABELS: Record<string, string> = {
  holiday: '學校／公共假期',
  'non-school-day': '非正常上課日',
  'school-day': '正常上課日',
  event: '校曆活動',
  timetable: '調課日',
  progress: '進度表任務',
  department: '科組活動',
  assessment: '科組測考',
}

const CAMPUS_SUBJECTS = ['CHIN', 'EC', 'CHIS', 'PTH'] as const

export function eventSummary(event: CalendarEvent): string {
  const trimmed = event.title.trim()
  if (trimmed) return trimmed
  return KIND_LABELS[event.kind] ?? event.kind
}

export function normalizeHm(hm: string): string {
  const parts = hm.trim().split(':')
  if (parts.length < 2) return hm.trim()
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return hm.trim()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function resolveEventTime(
  event: CalendarEvent,
): { start: string; end: string } | null {
  if (event.time?.start && event.time?.end) {
    return {
      start: normalizeHm(event.time.start),
      end: normalizeHm(event.time.end),
    }
  }
  if (event.lesson?.start && event.lesson?.end) {
    return {
      start: normalizeHm(event.lesson.start),
      end: normalizeHm(event.lesson.end),
    }
  }
  return null
}

function gradeFromClassName(name: string): number | null {
  const g = name.match(/^G(\d+)/i)
  if (g) return Number(g[1])
  const j = name.match(/^(\d+)/)
  if (j) return Number(j[1])
  return null
}

function subjectsFromClasses(classes: string[]): string[] {
  const subjects = new Set<string>()
  for (const cls of classes) {
    if (/EC/i.test(cls)) subjects.add('EC')
    else subjects.add('CHIN')
  }
  if (subjects.size === 0) subjects.add('CHIN')
  return [...subjects]
}

export function teacherContext(userId: string, role: string) {
  const year = bundle.latestWhitelistYear as number
  const whitelist =
    (bundle.whitelistByYear as Record<number, WhitelistEntry[]>)[year] ?? []
  const entry = whitelist.find((t) => t.userId === userId)
  const grades = new Set<number>()
  for (const cls of entry?.classes ?? []) {
    const g = gradeFromClassName(cls)
    if (g != null) grades.add(g)
  }
  return {
    role,
    userId,
    grades: [...grades],
    subjects: subjectsFromClasses(entry?.classes ?? []),
    name: entry?.initial ?? userId,
  }
}

export function eventVisibleToTeacher(
  event: CalendarEvent,
  ctx: ReturnType<typeof teacherContext>,
): boolean {
  if (ctx.role === 'admin') return true
  const aud = event.audience
  if (aud.type === 'personal') return aud.ownerId === ctx.userId
  if (aud.type === 'all') return true
  if (aud.type === 'teachers') {
    return Array.isArray(aud.teacherIds) && aud.teacherIds.includes(ctx.userId)
  }
  if (aud.type === 'grades') {
    const grades = aud.grades ?? []
    if (!grades.some((g) => ctx.grades.includes(g))) return false
    const eventSubjects =
      aud.subjects?.length && aud.subjects.length > 0
        ? aud.subjects
        : [...CAMPUS_SUBJECTS]
    return eventSubjects.some((s) => ctx.subjects.includes(s))
  }
  return false
}

export function mergeSeedWithOverlay(
  seed: CalendarEvent[],
  rows: Array<{ event: CalendarEvent; deleted: boolean }>,
): CalendarEvent[] {
  const deleted = new Set<string>()
  const byId = new Map<string, CalendarEvent>()
  for (const row of rows) {
    if (row.deleted) deleted.add(row.event.id)
    else byId.set(row.event.id, row.event)
  }
  for (const event of seed) {
    if (deleted.has(event.id)) continue
    byId.set(event.id, byId.get(event.id) ?? event)
  }
  return [...byId.values()]
}

export function dbRowToOverlayRow(raw: Record<string, unknown>): {
  event: CalendarEvent
  deleted: boolean
} {
  return {
    event: {
      id: raw.id as string,
      date: raw.date as string,
      title: (raw.title as string) ?? '',
      kind: raw.kind as string,
      createdBy: (raw.created_by as string) ?? '',
      audience: raw.audience as CalendarEvent['audience'],
      ...(raw.school_year_start != null
        ? { schoolYearStart: raw.school_year_start as number }
        : {}),
      ...(raw.lesson ? { lesson: raw.lesson as CalendarEvent['lesson'] } : {}),
      ...(raw.event_time
        ? { time: raw.event_time as CalendarEvent['time'] }
        : {}),
    },
    deleted: Boolean(raw.deleted),
  }
}

export function visibleEventsForUser(
  userId: string,
  overlayRows: Array<{ event: CalendarEvent; deleted: boolean }>,
): CalendarEvent[] {
  const role = userId === 'u-admin' ? 'admin' : 'teacher'
  const ctx = teacherContext(userId, role)
  const merged = mergeSeedWithOverlay(
    bundle.seed as CalendarEvent[],
    overlayRows,
  )
  return merged
    .filter((event) => eventVisibleToTeacher(event, ctx))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        eventSummary(a).localeCompare(eventSummary(b), 'zh-Hant'),
    )
}

export function seedEvents(): CalendarEvent[] {
  return bundle.seed as CalendarEvent[]
}
