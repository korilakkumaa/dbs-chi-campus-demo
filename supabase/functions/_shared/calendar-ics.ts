import type { CalendarEvent } from './calendar-events.ts'
import { eventSummary, resolveEventTime } from './calendar-events.ts'

export type GoogleEventDateTime = {
  date?: string | null
  dateTime?: string | null
  timeZone?: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Google PATCH merges nested fields — clear the unused date/dateTime key explicitly. */
export function googleEventSchedule(event: CalendarEvent): {
  start: GoogleEventDateTime
  end: GoogleEventDateTime
} {
  const slot = resolveEventTime(event)
  if (slot) {
    return {
      start: {
        dateTime: `${event.date}T${slot.start}:00`,
        timeZone: 'Asia/Hong_Kong',
        date: null,
      },
      end: {
        dateTime: `${event.date}T${slot.end}:00`,
        timeZone: 'Asia/Hong_Kong',
        date: null,
      },
    }
  }
  return {
    start: { date: event.date, dateTime: null },
    end: { date: addDaysIso(event.date, 1), dateTime: null },
  }
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function icsStamp(date = new Date()): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  )
}

function icsStampFromIso(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return icsStamp()
  return icsStamp(date)
}

function hmToIcs(hm: string): string {
  const [h, m] = hm.split(':')
  return `${pad2(Number(h))}${pad2(Number(m))}00`
}

function sequenceFromUpdatedAt(updatedAt?: string): number {
  if (!updatedAt) return 0
  const ms = new Date(updatedAt).getTime()
  if (Number.isNaN(ms)) return 0
  return Math.floor(ms / 1000) % 1_000_000
}

export function eventToVevent(
  event: CalendarEvent,
  options?: { updatedAt?: string },
): string {
  const uid = `${event.id}@campus-cms`
  const summary = escapeIcs(eventSummary(event))
  const stamp = icsStamp()
  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`]

  if (options?.updatedAt) {
    lines.push(`LAST-MODIFIED:${icsStampFromIso(options.updatedAt)}`)
    lines.push(`SEQUENCE:${sequenceFromUpdatedAt(options.updatedAt)}`)
  }

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

export function buildIcsCalendar(
  events: Array<{ event: CalendarEvent; updatedAt?: string }>,
  calendarName: string,
): string {
  const body = events
    .map(({ event, updatedAt }) => eventToVevent(event, { updatedAt }))
    .join('\r\n')
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
