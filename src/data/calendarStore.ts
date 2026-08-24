import type { CalendarAudience, CalendarEvent, Role, User } from '../types'
import { buildSeedCalendarEvents } from './calendarEvents'

const SHARED_OVERLAY_KEY = 'campus-calendar-shared-overlay-v1'
const PERSONAL_KEY = 'campus-calendar-personal-v1'
const LEGACY_DUMP_KEY = 'campus-calendar-events-v8'

export type SharedCalendarOverlay = {
  byId: Record<string, CalendarEvent>
  deletedIds: string[]
}

export function isSharedCalendarEvent(event: CalendarEvent): boolean {
  return event.audience.type !== 'personal'
}

export function canMutateCalendarEvent(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  event: CalendarEvent,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return (
    event.audience.type === 'personal' && event.audience.ownerId === user.id
  )
}

export function defaultCalendarAudience(
  user: Pick<User, 'id' | 'role'>,
  lesson?: CalendarEvent['lesson'],
): CalendarAudience {
  if (user.role === 'admin' && !lesson) return { type: 'all' }
  return { type: 'personal', ownerId: user.id }
}

function emptyOverlay(): SharedCalendarOverlay {
  return { byId: {}, deletedIds: [] }
}

export function loadSharedOverlay(): SharedCalendarOverlay {
  try {
    const raw = localStorage.getItem(SHARED_OVERLAY_KEY)
    if (!raw) return emptyOverlay()
    const parsed = JSON.parse(raw) as SharedCalendarOverlay
    if (!parsed || typeof parsed !== 'object') return emptyOverlay()
    return {
      byId: parsed.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
    }
  } catch {
    return emptyOverlay()
  }
}

export function saveSharedOverlay(overlay: SharedCalendarOverlay) {
  try {
    localStorage.setItem(SHARED_OVERLAY_KEY, JSON.stringify(overlay))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadPersonalEvents(userId: string | undefined): CalendarEvent[] {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(PERSONAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, CalendarEvent[]>
    const list = parsed[userId]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function savePersonalEvents(userId: string, events: CalendarEvent[]) {
  try {
    const raw = localStorage.getItem(PERSONAL_KEY)
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, CalendarEvent[]>)
      : {}
    parsed[userId] = events
    localStorage.setItem(PERSONAL_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore quota / private mode */
  }
}

export function mergeSeedWithOverlay(
  seed: CalendarEvent[],
  overlay: SharedCalendarOverlay,
): CalendarEvent[] {
  const deleted = new Set(overlay.deletedIds)
  const byId = new Map<string, CalendarEvent>()
  for (const event of seed) {
    if (deleted.has(event.id)) continue
    byId.set(event.id, event)
  }
  for (const event of Object.values(overlay.byId)) {
    if (deleted.has(event.id)) continue
    byId.set(event.id, event)
  }
  return [...byId.values()]
}

export function overlayFromSharedEvents(
  events: CalendarEvent[],
  seed: CalendarEvent[],
): SharedCalendarOverlay {
  const seedById = new Map(seed.map((event) => [event.id, event]))
  const shared = events.filter(isSharedCalendarEvent)
  const present = new Set(shared.map((event) => event.id))
  const deletedIds = seed
    .map((event) => event.id)
    .filter((id) => !present.has(id))
  const byId: Record<string, CalendarEvent> = {}
  for (const event of shared) {
    const original = seedById.get(event.id)
    if (!original) {
      byId[event.id] = event
      continue
    }
    if (
      original.title !== event.title ||
      original.kind !== event.kind ||
      original.date !== event.date ||
      JSON.stringify(original.audience) !== JSON.stringify(event.audience) ||
      JSON.stringify(original.lesson ?? null) !==
        JSON.stringify(event.lesson ?? null)
    ) {
      byId[event.id] = event
    }
  }
  return { byId, deletedIds }
}

export function persistCalendarState(
  events: CalendarEvent[],
  userId: string | undefined,
  role: Role | undefined,
) {
  const seed = buildSeedCalendarEvents()
  saveSharedOverlay(overlayFromSharedEvents(events, seed))
  if (!userId) return
  const personal = events.filter(
    (event) =>
      event.audience.type === 'personal' &&
      (role === 'admin' || event.audience.ownerId === userId),
  )
  savePersonalEvents(userId, personal)
}

export function assembleCalendarEvents(userId?: string): CalendarEvent[] {
  migrateLegacyDumpIfNeeded()
  const seed = buildSeedCalendarEvents()
  const shared = mergeSeedWithOverlay(seed, loadSharedOverlay())
  const personal = loadPersonalEvents(userId)
  const ids = new Set(shared.map((event) => event.id))
  return [...shared, ...personal.filter((event) => !ids.has(event.id))]
}

export function applyRemoteRowToOverlay(row: {
  event: CalendarEvent
  deleted: boolean
}) {
  const overlay = loadSharedOverlay()
  if (row.deleted) {
    if (!overlay.deletedIds.includes(row.event.id)) {
      overlay.deletedIds.push(row.event.id)
    }
    delete overlay.byId[row.event.id]
  } else {
    overlay.byId[row.event.id] = row.event
    overlay.deletedIds = overlay.deletedIds.filter((id) => id !== row.event.id)
  }
  saveSharedOverlay(overlay)
}

export function overlayFromRemoteRows(
  rows: Array<{ event: CalendarEvent; deleted: boolean }>,
): SharedCalendarOverlay {
  const byId: Record<string, CalendarEvent> = {}
  const deletedIds: string[] = []
  for (const row of rows) {
    if (row.deleted) deletedIds.push(row.event.id)
    else byId[row.event.id] = row.event
  }
  return { byId, deletedIds }
}

function migrateLegacyDumpIfNeeded() {
  try {
    if (localStorage.getItem(SHARED_OVERLAY_KEY)) return
    const raw = localStorage.getItem(LEGACY_DUMP_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as CalendarEvent[]
    if (!Array.isArray(parsed)) return
    const seed = buildSeedCalendarEvents()
    const overlay = overlayFromSharedEvents(parsed, seed)
    const savedIds = new Set(parsed.map((event) => event.id))
    for (const event of seed) {
      if (!savedIds.has(event.id) && !overlay.deletedIds.includes(event.id)) {
        overlay.deletedIds.push(event.id)
      }
    }
    saveSharedOverlay(overlay)

    const personalByUser: Record<string, CalendarEvent[]> = {}
    for (const event of parsed) {
      if (event.audience.type !== 'personal') continue
      const ownerId = event.audience.ownerId
      const list = personalByUser[ownerId] ?? []
      list.push(event)
      personalByUser[ownerId] = list
    }
    if (Object.keys(personalByUser).length > 0) {
      const existing = localStorage.getItem(PERSONAL_KEY)
      const merged = existing
        ? (JSON.parse(existing) as Record<string, CalendarEvent[]>)
        : {}
      localStorage.setItem(
        PERSONAL_KEY,
        JSON.stringify({ ...merged, ...personalByUser }),
      )
    }
  } catch {
    /* ignore corrupt legacy dump */
  }
}
