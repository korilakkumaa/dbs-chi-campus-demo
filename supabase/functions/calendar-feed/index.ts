import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import bundle from '../_shared/calendar-bundle.json' with { type: 'json' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type CalendarEvent = {
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

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function icsStamp(date = new Date()): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  )
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function hmToIcs(hm: string): string {
  const [h, m] = hm.split(':')
  return `${pad2(Number(h))}${pad2(Number(m))}00`
}

function eventSummary(event: CalendarEvent): string {
  const trimmed = event.title.trim()
  if (trimmed) return trimmed
  return KIND_LABELS[event.kind] ?? event.kind
}

function resolveEventTime(event: CalendarEvent) {
  if (event.time?.start && event.time?.end) return event.time
  if (event.lesson?.start && event.lesson?.end) {
    return { start: event.lesson.start, end: event.lesson.end }
  }
  return null
}

function eventToVevent(event: CalendarEvent): string {
  const uid = `${event.id}@campus-cms`
  const summary = escapeIcs(eventSummary(event))
  const stamp = icsStamp()
  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`]
  const slot = resolveEventTime(event)
  const dateCompact = event.date.replace(/-/g, '')

  if (slot) {
    lines.push(
      `DTSTART;TZID=Asia/Hong_Kong:${dateCompact}T${hmToIcs(slot.start)}`,
      `DTEND;TZID=Asia/Hong_Kong:${dateCompact}T${hmToIcs(slot.end)}`,
    )
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${dateCompact}`,
      `DTEND;VALUE=DATE:${addDaysIso(event.date, 1).replace(/-/g, '')}`,
    )
  }

  if (event.lesson?.group) {
    lines.push(`LOCATION:${escapeIcs(event.lesson.group)}`)
  }

  lines.push(`SUMMARY:${summary}`, 'END:VEVENT')
  return lines.join('\r\n')
}

function buildIcs(events: CalendarEvent[], calendarName: string): string {
  const body = events.map(eventToVevent).join('\r\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus CMS//Calendar//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Hong_Kong',
    'REFRESH-INTERVAL;VALUE=DURATION:PT3H',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Hong_Kong',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:HKT',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    body,
    'END:VCALENDAR',
  ].join('\r\n')
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

function teacherContext(userId: string, role: string) {
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

function eventVisibleToTeacher(
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

function mergeSeedWithOverlay(
  seed: CalendarEvent[],
  rows: Array<{ event: CalendarEvent; deleted: boolean }>,
): CalendarEvent[] {
  const deleted = new Set<string>()
  const byId = new Map<string, CalendarEvent>()
  for (const row of rows) {
    if (row.deleted) deleted.add(row.event.id)
    else byId.set(row.event.id, row.event)
  }
  for (const event of seed as CalendarEvent[]) {
    if (deleted.has(event.id)) continue
    byId.set(event.id, byId.get(event.id) ?? event)
  }
  return [...byId.values()]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')?.trim()
    if (!token) {
      return new Response('Missing token', { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response('Server misconfigured', {
        status: 500,
        headers: corsHeaders,
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: tokenRow, error: tokenError } = await admin
      .from('calendar_feed_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenRow?.user_id) {
      return new Response('Invalid token', { status: 403, headers: corsHeaders })
    }

    const userId = tokenRow.user_id as string
    const role = userId === 'u-admin' ? 'admin' : 'teacher'
    const ctx = teacherContext(userId, role)

    const { data: dbRows, error: dbError } = await admin
      .from('campus_calendar_events')
      .select('*')

    if (dbError) {
      return new Response(dbError.message, { status: 500, headers: corsHeaders })
    }

    const overlayRows = (dbRows ?? []).map((raw) => ({
      event: {
        id: raw.id,
        date: raw.date,
        title: raw.title ?? '',
        kind: raw.kind,
        createdBy: raw.created_by ?? '',
        audience: raw.audience,
        ...(raw.school_year_start != null
          ? { schoolYearStart: raw.school_year_start }
          : {}),
        ...(raw.lesson ? { lesson: raw.lesson } : {}),
        ...(raw.event_time ? { time: raw.event_time } : {}),
      } as CalendarEvent,
      deleted: Boolean(raw.deleted),
    }))

    const merged = mergeSeedWithOverlay(
      bundle.seed as CalendarEvent[],
      overlayRows,
    )
    const visible = merged
      .filter((event) => eventVisibleToTeacher(event, ctx))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          eventSummary(a).localeCompare(eventSummary(b), 'zh-Hant'),
      )

    const calendarName =
      ctx.role === 'admin'
        ? 'Campus CMS 校曆'
        : `Campus CMS · ${ctx.name}`
    const ics = buildIcs(visible, calendarName)

    return new Response(ics, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(message, { status: 500, headers: corsHeaders })
  }
})
