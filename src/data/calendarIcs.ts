import type { CalendarEvent, CalendarEventKind } from '../types'

export const EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  holiday: '學校／公共假期',
  'non-school-day': '非正常上課日',
  'school-day': '正常上課日',
  event: '校曆活動',
  timetable: '調課日',
  progress: '進度表任務',
  department: '科組活動',
  assessment: '科組測考',
}

/** Resolved HH:MM start/end for an event (explicit time or lesson slot). */
export function resolveEventTime(
  event: CalendarEvent,
): { start: string; end: string } | null {
  if (event.time?.start && event.time?.end) {
    return { start: event.time.start, end: event.time.end }
  }
  if (event.lesson?.start && event.lesson?.end) {
    return { start: event.lesson.start, end: event.lesson.end }
  }
  return null
}

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

export function eventSummary(event: CalendarEvent): string {
  const trimmed = event.title.trim()
  if (trimmed) return trimmed
  return EVENT_KIND_LABELS[event.kind] ?? event.kind
}

export function eventToVevent(event: CalendarEvent, domain = 'campus-cms'): string {
  const uid = `${event.id}@${domain}`
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
    const endDate = addDaysIso(event.date, 1).replace(/-/g, '')
    lines.push(
      `DTSTART;VALUE=DATE:${dateCompact}`,
      `DTEND;VALUE=DATE:${endDate}`,
    )
  }

  if (event.lesson?.group) {
    lines.push(`LOCATION:${escapeIcs(event.lesson.group)}`)
  }

  lines.push(`SUMMARY:${summary}`, 'END:VEVENT')
  return lines.join('\r\n')
}

export function buildIcsCalendar(
  events: CalendarEvent[],
  calendarName: string,
  domain = 'campus-cms',
): string {
  const body = events.map((e) => eventToVevent(e, domain)).join('\r\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus CMS//Calendar//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Hong_Kong',
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

export function feedUrlFromToken(supabaseUrl: string, token: string): string {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/functions/v1/calendar-feed?token=${encodeURIComponent(token)}`
}

export function webcalUrlFromFeedUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https:\/\//i, 'webcal://')
}
