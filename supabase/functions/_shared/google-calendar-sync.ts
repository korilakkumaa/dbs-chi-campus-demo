import type { CalendarEvent } from './calendar-events.ts'
import { eventSummary, resolveEventTime } from './calendar-events.ts'

type GoogleEventBody = {
  summary: string
  description?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string; timeZone?: string }
  location?: string
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function eventToGoogleBody(event: CalendarEvent): GoogleEventBody {
  const summary = eventSummary(event)
  const slot = resolveEventTime(event)
  const body: GoogleEventBody = {
    summary,
    start: slot
      ? { dateTime: `${event.date}T${slot.start}:00`, timeZone: 'Asia/Hong_Kong' }
      : { date: event.date },
    end: slot
      ? { dateTime: `${event.date}T${slot.end}:00`, timeZone: 'Asia/Hong_Kong' }
      : { date: addDaysIso(event.date, 1) },
  }

  if (event.lesson?.group) {
    body.location = event.lesson.group
    const parts = [event.lesson.subject, event.lesson.group].filter(Boolean)
    if (parts.length) body.description = parts.join(' · ')
  }

  return body
}

async function googleFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

export type GoogleSyncResult = {
  ok: boolean
  synced: number
  removed: number
  error?: string
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string } | { error: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    return { error: body || res.statusText }
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) return { error: 'No access_token in response' }
  return { accessToken: json.access_token }
}

export async function syncEventsToGoogleCalendar(input: {
  accessToken: string
  calendarId: string
  events: CalendarEvent[]
  eventMap: Map<string, string>
  onMapUpsert: (campusEventId: string, googleEventId: string) => Promise<void>
  onMapDelete: (campusEventId: string) => Promise<void>
}): Promise<GoogleSyncResult> {
  const {
    accessToken,
    calendarId,
    events,
    eventMap,
    onMapUpsert,
    onMapDelete,
  } = input
  const visibleIds = new Set(events.map((e) => e.id))
  let synced = 0
  let removed = 0

  for (const event of events) {
    const body = eventToGoogleBody(event)
    const googleId = eventMap.get(event.id)
    const encodedCal = encodeURIComponent(calendarId)

    if (googleId) {
      const res = await googleFetch(
        accessToken,
        `/calendars/${encodedCal}/events/${encodeURIComponent(googleId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      )
      if (res.ok) {
        synced += 1
        continue
      }
      if (res.status !== 404) {
        const err = await res.text()
        return { ok: false, synced, removed, error: err || res.statusText }
      }
      eventMap.delete(event.id)
    }

    const res = await googleFetch(
      accessToken,
      `/calendars/${encodedCal}/events`,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, synced, removed, error: err || res.statusText }
    }
    const created = (await res.json()) as { id?: string }
    if (created.id) {
      eventMap.set(event.id, created.id)
      await onMapUpsert(event.id, created.id)
      synced += 1
    }
  }

  for (const [campusId, googleId] of eventMap.entries()) {
    if (visibleIds.has(campusId)) continue
    const res = await googleFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
      { method: 'DELETE' },
    )
    if (res.ok || res.status === 404 || res.status === 410) {
      await onMapDelete(campusId)
      removed += 1
    }
  }

  return { ok: true, synced, removed }
}
