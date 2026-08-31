import type { CalendarAudience, CalendarEvent, CalendarEventKind } from '../types'
import { supabase } from '../lib/supabase'
import type { SharedCalendarOverlay } from './calendarStore'

const TABLE = 'campus_calendar_events'

export type SharedCalendarRow = {
  event: CalendarEvent
  deleted: boolean
  updatedAt: string
}

type DbRow = {
  id: string
  date: string
  title: string
  kind: CalendarEventKind
  school_year_start: number | null
  created_by: string
  audience: CalendarAudience
  lesson: CalendarEvent['lesson'] | null
  event_time: CalendarEvent['time'] | null
  deleted: boolean
  updated_at: string
}

const KINDS = new Set<CalendarEventKind>([
  'holiday',
  'event',
  'timetable',
  'progress',
  'department',
  'assessment',
  'school-day',
  'non-school-day',
])

function isKind(value: string): value is CalendarEventKind {
  return KINDS.has(value as CalendarEventKind)
}

function parseAudience(raw: unknown): CalendarAudience {
  if (!raw || typeof raw !== 'object') return { type: 'all' }
  const audience = raw as CalendarAudience
  if (audience.type === 'personal' && audience.ownerId) return audience
  if (audience.type === 'all') return audience
  if (audience.type === 'teachers' && Array.isArray(audience.teacherIds)) {
    return audience
  }
  if (audience.type === 'grades' && Array.isArray(audience.grades)) {
    return audience
  }
  return { type: 'all' }
}

function rowToShared(row: DbRow): SharedCalendarRow | null {
  if (!isKind(row.kind) || !row.id || !row.date) return null
  return {
    deleted: Boolean(row.deleted),
    updatedAt: row.updated_at,
    event: {
      id: row.id,
      date: row.date,
      title: row.title ?? '',
      kind: row.kind,
      createdBy: row.created_by ?? '',
      audience: parseAudience(row.audience),
      ...(row.school_year_start != null
        ? { schoolYearStart: row.school_year_start }
        : {}),
      ...(row.lesson ? { lesson: row.lesson } : {}),
      ...(row.event_time ? { time: row.event_time } : {}),
    },
  }
}

function eventToRow(
  event: CalendarEvent,
  deleted: boolean,
): Record<string, unknown> {
  return {
    id: event.id,
    date: event.date,
    title: event.title,
    kind: event.kind,
    school_year_start: event.schoolYearStart ?? null,
    created_by: event.createdBy,
    audience: event.audience,
    lesson: event.lesson ?? null,
    event_time: event.time ?? null,
    deleted,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchSharedCalendarRows(): Promise<
  SharedCalendarRow[] | null
> {
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('*')
  if (error) {
    console.warn('campus calendar fetch failed', error.message)
    return null
  }
  const rows: SharedCalendarRow[] = []
  for (const raw of data ?? []) {
    const parsed = rowToShared(raw as DbRow)
    if (parsed) rows.push(parsed)
  }
  return rows
}

export async function upsertSharedCalendarEvent(
  event: CalendarEvent,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).upsert(eventToRow(event, false), {
    onConflict: 'id',
  })
  if (error) {
    console.warn('campus calendar upsert failed', error.message)
    return false
  }
  return true
}

export async function tombstoneSharedCalendarEvent(
  event: CalendarEvent,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(TABLE).upsert(eventToRow(event, true), {
    onConflict: 'id',
  })
  if (error) {
    console.warn('campus calendar delete failed', error.message)
    return false
  }
  return true
}

export async function pushSharedOverlayToRemote(
  overlay: SharedCalendarOverlay,
  seed: CalendarEvent[],
): Promise<void> {
  if (!supabase) return
  const seedById = new Map(seed.map((event) => [event.id, event]))
  for (const event of Object.values(overlay.byId)) {
    await upsertSharedCalendarEvent(event)
  }
  for (const id of overlay.deletedIds) {
    const event = overlay.byId[id] ?? seedById.get(id)
    if (event) await tombstoneSharedCalendarEvent(event)
  }
}

export function subscribeSharedCalendar(
  onChange: (row: SharedCalendarRow) => void,
): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client
    .channel('campus-calendar-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        const raw = (payload.new ?? payload.old) as DbRow | undefined
        if (!raw) return
        const parsed = rowToShared(raw)
        if (parsed) onChange(parsed)
      },
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function ensureCalendarFeedToken(
  userId: string,
): Promise<{ token: string | null; error?: string }> {
  if (!supabase) return { token: null, error: 'Supabase 未設定' }
  const { data: existing, error: readError } = await supabase
    .from('calendar_feed_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) {
    console.warn('calendar feed token read failed', readError.message)
    return { token: null, error: readError.message }
  }
  if (existing?.token) return { token: existing.token as string }

  const token = randomToken()
  const { error } = await supabase.from('calendar_feed_tokens').upsert(
    { user_id: userId, token },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.warn('calendar feed token upsert failed', error.message)
    return { token: null, error: error.message }
  }
  return { token }
}

export async function rotateCalendarFeedToken(
  userId: string,
): Promise<{ token: string | null; error?: string }> {
  if (!supabase) return { token: null, error: 'Supabase 未設定' }
  const token = randomToken()
  const { error } = await supabase.from('calendar_feed_tokens').upsert(
    { user_id: userId, token },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.warn('calendar feed token rotate failed', error.message)
    return { token: null, error: error.message }
  }
  return { token }
}

export type GoogleCalendarSyncState = {
  enabled: boolean
  calendarId: string
}

export async function fetchGoogleCalendarSyncState(
  userId: string,
): Promise<GoogleCalendarSyncState | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('google_calendar_sync')
    .select('enabled, calendar_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    enabled: Boolean(data.enabled),
    calendarId: (data.calendar_id as string) || 'primary',
  }
}

export async function setGoogleCalendarSyncEnabled(
  userId: string,
  enabled: boolean,
  calendarId = 'primary',
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('google_calendar_sync').upsert(
    {
      user_id: userId,
      enabled,
      calendar_id: calendarId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.warn('google calendar sync save failed', error.message)
    return false
  }
  return true
}

export async function fetchGoogleEventMap(
  userId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!supabase) return map
  const { data, error } = await supabase
    .from('google_calendar_event_map')
    .select('campus_event_id, google_event_id')
    .eq('user_id', userId)
  if (error) return map
  for (const row of data ?? []) {
    map.set(row.campus_event_id as string, row.google_event_id as string)
  }
  return map
}

export async function upsertGoogleEventMap(
  userId: string,
  campusEventId: string,
  googleEventId: string,
): Promise<void> {
  if (!supabase) return
  await supabase.from('google_calendar_event_map').upsert(
    {
      user_id: userId,
      campus_event_id: campusEventId,
      google_event_id: googleEventId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,campus_event_id' },
  )
}

export async function deleteGoogleEventMapEntry(
  userId: string,
  campusEventId: string,
): Promise<void> {
  if (!supabase) return
  await supabase
    .from('google_calendar_event_map')
    .delete()
    .eq('user_id', userId)
    .eq('campus_event_id', campusEventId)
}
