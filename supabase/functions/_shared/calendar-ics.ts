/**
 * Edge ICS wrapper — shared pure helpers come from the generated core
 * (`calendar-ics.core.generated.ts`, sourced from `src/data/calendarIcs.ts`).
 * This file only adds feed-specific extras: LAST-MODIFIED, SEQUENCE, REFRESH-INTERVAL.
 */
import type { CalendarEvent } from './calendar-events.ts'
import {
  escapeIcs,
  eventToVevent as eventToVeventCore,
  googleEventSchedule,
} from './calendar-ics.core.generated.ts'

export { googleEventSchedule }
export type { GoogleEventDateTime } from './calendar-ics.core.generated.ts'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
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
  const base = eventToVeventCore(event as Parameters<typeof eventToVeventCore>[0])
  if (!options?.updatedAt) return base
  const extra = [
    `LAST-MODIFIED:${icsStampFromIso(options.updatedAt)}`,
    `SEQUENCE:${sequenceFromUpdatedAt(options.updatedAt)}`,
  ].join('\r\n')
  return base.replace(/(DTSTAMP:[^\r\n]+)/, `$1\r\n${extra}`)
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
