import type { CalendarAudience, CalendarEventKind, SchoolClass } from '../types'
import { supabase } from '../lib/supabase'
import {
  formatCalendarNotifyDates,
  resolveCalendarNotifyRecipients,
} from './calendarNotifyRecipients'

export type SystemNotificationType = 'calendar_event'

export type SystemNotification = {
  id: string
  recipientId: string
  type: SystemNotificationType
  title: string
  body: string
  payload: Record<string, unknown>
  createdBy: string
  readAt: string | null
  createdAt: string
}

type DbRow = {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string
  payload: Record<string, unknown> | null
  created_by: string
  read_at: string | null
  created_at: string
}

const TABLE = 'system_notifications'
const TYPES = new Set<SystemNotificationType>(['calendar_event'])

function newNotificationId(): string {
  return `sn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function rowToNotification(row: DbRow): SystemNotification | null {
  if (!TYPES.has(row.type as SystemNotificationType)) return null
  if (!row.id || !row.recipient_id) return null
  return {
    id: row.id,
    recipientId: row.recipient_id,
    type: row.type as SystemNotificationType,
    title: row.title ?? '',
    body: row.body ?? '',
    payload:
      row.payload && typeof row.payload === 'object' ? row.payload : {},
    createdBy: row.created_by ?? '',
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function fetchNotificationsForRecipient(
  recipientId: string,
  limit = 40,
): Promise<SystemNotification[]> {
  if (!supabase || !recipientId) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('system notifications fetch failed', error.message)
    return []
  }
  const out: SystemNotification[] = []
  for (const raw of data ?? []) {
    const parsed = rowToNotification(raw as DbRow)
    if (parsed) out.push(parsed)
  }
  return out
}

export async function markNotificationRead(id: string): Promise<boolean> {
  if (!supabase || !id) return false
  const { error } = await supabase
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) {
    console.warn('system notifications mark read failed', error.message)
    return false
  }
  return true
}

export async function markAllNotificationsRead(
  recipientId: string,
): Promise<boolean> {
  if (!supabase || !recipientId) return false
  const { error } = await supabase
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipientId)
    .is('read_at', null)
  if (error) {
    console.warn('system notifications mark all read failed', error.message)
    return false
  }
  return true
}

export function subscribeNotificationsForRecipient(
  recipientId: string,
  onChange: (row: SystemNotification) => void,
): () => void {
  if (!supabase || !recipientId) return () => {}
  const client = supabase
  const channel = client
    .channel(`system-notifications-${recipientId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLE,
        filter: `recipient_id=eq.${recipientId}`,
      },
      (payload) => {
        const raw = (payload.new ?? payload.old) as DbRow | undefined
        if (!raw) return
        const parsed = rowToNotification(raw)
        if (parsed) onChange(parsed)
      },
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}

export type CalendarEventNotifyInput = {
  title: string
  dates: string[]
  kind: CalendarEventKind
  audience: CalendarAudience
  eventIds: string[]
  createdBy: string
  schoolYearStart: number
  allClasses: SchoolClass[]
}

/**
 * Insert one in-app notification per relevant teacher for a new shared calendar event.
 * Skips personal events, empty titles, and the creator.
 */
export async function notifyTeachersOfCalendarEvent(
  input: CalendarEventNotifyInput,
): Promise<number> {
  if (!supabase) return 0
  const title = input.title.trim()
  if (!title) return 0
  if (input.audience.type === 'personal') return 0

  const dates = [...new Set(input.dates.filter(Boolean))].sort()
  if (dates.length === 0) return 0

  const recipients = resolveCalendarNotifyRecipients(
    input.audience,
    input.schoolYearStart,
    input.allClasses,
  ).filter((id) => id && id !== input.createdBy)

  if (recipients.length === 0) return 0

  const body = formatCalendarNotifyDates(dates)
  const createdAt = new Date().toISOString()
  const rows = recipients.map((recipientId) => ({
    id: newNotificationId(),
    recipient_id: recipientId,
    type: 'calendar_event' as const,
    title,
    body,
    payload: {
      kind: input.kind,
      dates,
      eventIds: input.eventIds,
      audienceType: input.audience.type,
    },
    created_by: input.createdBy,
    read_at: null,
    created_at: createdAt,
  }))

  const { error } = await supabase.from(TABLE).insert(rows)
  if (error) {
    console.warn('system notifications insert failed', error.message)
    return 0
  }
  return rows.length
}
