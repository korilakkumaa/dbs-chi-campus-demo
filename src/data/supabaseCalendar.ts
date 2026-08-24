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
