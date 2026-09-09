import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import {
  buildSeedCalendarEvents,
  expandIsoDateRange,
  newCalendarEventId,
} from '../data/calendarEvents'
import {
  applyRemoteRowToOverlay,
  applyRemotePersonalRow,
  applyRemotePersonalRows,
  assembleCalendarEvents,
  canMutateCalendarEvent,
  defaultCalendarAudience,
  loadSharedOverlay,
  overlayFromRemoteRows,
  persistCalendarState,
  saveSharedOverlay,
} from '../data/calendarStore'
import {
  fetchSharedCalendarRows,
  pushSharedOverlayToRemote,
  subscribeSharedCalendar,
  tombstoneSharedCalendarEvent,
  upsertSharedCalendarEvent,
} from '../data/supabaseCalendar'
import { academicYearStartFromIso } from '../data/academicYear'
import { calendarGradeAudienceMatchesUser } from '../data/campusSubjects'
import type {
  CalendarAudience,
  CalendarEvent,
  CalendarEventKind,
  SchoolClass,
  User,
} from '../types'
import { useAuth } from './AuthContext'
import { useRoster } from './RosterContext'

export interface CalendarCampusContextValue {
  /** All events visible to the signed-in user (continuous across school years). */
  calendarEvents: CalendarEvent[]
  addCalendarEvent: (input: {
    date: string
    title: string
    kind: CalendarEventKind
    audience?: CalendarAudience
    lesson?: CalendarEvent['lesson']
    time?: CalendarEvent['time']
  }) => string | undefined
  /** Create several events in one update (avoids stale-state clobbering). */
  addCalendarEvents: (
    inputs: Array<{
      date: string
      title: string
      kind: CalendarEventKind
      audience?: CalendarAudience
      lesson?: CalendarEvent['lesson']
      time?: CalendarEvent['time']
    }>,
  ) => string[]
  updateCalendarEvent: (
    id: string,
    patch: Partial<
      Pick<CalendarEvent, 'date' | 'title' | 'kind' | 'lesson' | 'time'>
    >,
  ) => void
  deleteCalendarEvent: (id: string) => void
  deleteCalendarEvents: (ids: string[]) => number
  addCalendarEventsBatch: (input: {
    date: string
    /** Inclusive end date; when set, creates one event per day in the range. */
    dateEnd?: string
    title: string
    kind: CalendarEventKind
    audience: Exclude<CalendarAudience, { type: 'personal' }>
    /** When true, skip Sat/Sun in a date range. */
    weekdaysOnly?: boolean
    /** Stamp events onto this academic year calendar (defaults from the date). */
    schoolYearStart?: number
    /** Optional HH:MM start/end — synced to ICS and Google Calendar. */
    time?: CalendarEvent['time']
  }) => number
}

const globalKey = '__campusCalendarCampusContext'
const CalendarCampusContext: Context<CalendarCampusContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<CalendarCampusContextValue | null>
    | undefined) ?? createContext<CalendarCampusContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = CalendarCampusContext

function eventVisibleToUser(
  event: CalendarEvent,
  user: User,
  ctx: {
    accessibleClasses: SchoolClass[]
    allClasses: SchoolClass[]
    scoresAcademicYearStart: number
  },
): boolean {
  if (user.role === 'admin') return true
  const { audience } = event
  if (audience.type === 'personal') return audience.ownerId === user.id
  if (audience.type === 'all') return true
  if (audience.type === 'teachers') return audience.teacherIds.includes(user.id)
  if (audience.type === 'grades') {
    return calendarGradeAudienceMatchesUser(audience, user, ctx)
  }
  return false
}

export function CalendarCampusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    classes,
    teachingAccessibleClasses,
    teachingYearStart,
  } = useRoster()

  const [allCalendarEvents, setAllCalendarEvents] = useState<CalendarEvent[]>(
    () => assembleCalendarEvents(user?.id),
  )

  useEffect(() => {
    setAllCalendarEvents(assembleCalendarEvents(user?.id))
    let cancelled = false
    ;(async () => {
      const remote = await fetchSharedCalendarRows()
      if (cancelled || remote == null || !user) return
      if (remote.length > 0) {
        const sharedRows = remote.filter(
          (row) => row.event.audience.type !== 'personal',
        )
        saveSharedOverlay(overlayFromRemoteRows(sharedRows))
        applyRemotePersonalRows(user.id, remote)
      } else {
        await pushSharedOverlayToRemote(
          loadSharedOverlay(),
          buildSeedCalendarEvents(),
        )
        const personal = assembleCalendarEvents(user.id).filter(
          (event) => event.audience.type === 'personal',
        )
        for (const event of personal) {
          await upsertSharedCalendarEvent(event)
        }
      }
      if (!cancelled) setAllCalendarEvents(assembleCalendarEvents(user?.id))
    })()
    const unsubscribe = subscribeSharedCalendar((row) => {
      if (row.event.audience.type === 'personal') {
        if (user?.id) applyRemotePersonalRow(user.id, row)
      } else {
        applyRemoteRowToOverlay(row)
      }
      setAllCalendarEvents(assembleCalendarEvents(user?.id))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user?.id])

  const calendarVisibilityCtx = useMemo(
    () => ({
      accessibleClasses: teachingAccessibleClasses,
      allClasses: classes,
      scoresAcademicYearStart: teachingYearStart,
    }),
    [teachingAccessibleClasses, classes, teachingYearStart],
  )

  const calendarEvents = useMemo(() => {
    if (!user) return []
    return allCalendarEvents
      .filter((e) => eventVisibleToUser(e, user, calendarVisibilityCtx))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.title.localeCompare(b.title, 'zh-Hant'),
      )
  }, [allCalendarEvents, user, calendarVisibilityCtx])

  const value = useMemo<CalendarCampusContextValue>(
    () => ({
      calendarEvents,
      addCalendarEvent: ({ date, title, kind, audience, lesson, time }) => {
        if (!user) return undefined
        const trimmed = title.trim()
        if (!date) return undefined
        // Lesson-tagged events may start with an empty body for the teacher to fill in.
        if (!trimmed && !lesson) return undefined
        const event: CalendarEvent = {
          id: newCalendarEventId(),
          date,
          title: trimmed,
          kind,
          schoolYearStart: academicYearStartFromIso(date),
          createdBy: user.id,
          audience: audience ?? defaultCalendarAudience(user, lesson),
          ...(lesson ? { lesson } : {}),
          ...(time ? { time } : {}),
        }
        const next = [...allCalendarEvents, event]
        setAllCalendarEvents(next)
        persistCalendarState(next, user.id, user.role)
        void upsertSharedCalendarEvent(event)
        return event.id
      },
      addCalendarEvents: (inputs) => {
        if (!user || inputs.length === 0) return []
        const created: CalendarEvent[] = []
        for (const input of inputs) {
          const trimmed = input.title.trim()
          if (!input.date) continue
          if (!trimmed && !input.lesson) continue
          created.push({
            id: newCalendarEventId(),
            date: input.date,
            title: trimmed,
            kind: input.kind,
            schoolYearStart: academicYearStartFromIso(input.date),
            createdBy: user.id,
            audience:
              input.audience ??
              defaultCalendarAudience(user, input.lesson),
            ...(input.lesson ? { lesson: input.lesson } : {}),
            ...(input.time ? { time: input.time } : {}),
          })
        }
        if (created.length === 0) return []
        const next = [...allCalendarEvents, ...created]
        setAllCalendarEvents(next)
        persistCalendarState(next, user.id, user.role)
        void Promise.all(
          created.map((event) => upsertSharedCalendarEvent(event)),
        ).then((results) => {
          if (results.some((ok) => !ok)) {
            console.warn(
              'campus calendar multi upsert: some events failed to reach Supabase',
            )
          }
        })
        return created.map((event) => event.id)
      },
      updateCalendarEvent: (id, patch) => {
        const current = allCalendarEvents.find((e) => e.id === id)
        if (!current || !canMutateCalendarEvent(user, current)) return
        const updated: CalendarEvent = {
          ...current,
          ...patch,
          title: patch.title != null ? patch.title.trim() : current.title,
        }
        if ('time' in patch && patch.time === undefined) {
          delete updated.time
        }
        const next = allCalendarEvents.map((e) => (e.id === id ? updated : e))
        setAllCalendarEvents(next)
        persistCalendarState(next, user?.id, user?.role)
        void upsertSharedCalendarEvent(updated)
      },
      deleteCalendarEvent: (id) => {
        const current = allCalendarEvents.find((e) => e.id === id)
        if (!current || !canMutateCalendarEvent(user, current)) return
        const next = allCalendarEvents.filter((e) => e.id !== id)
        setAllCalendarEvents(next)
        persistCalendarState(next, user?.id, user?.role)
        void tombstoneSharedCalendarEvent(current)
      },
      deleteCalendarEvents: (ids) => {
        if (!user || ids.length === 0) return 0
        const idSet = new Set(ids)
        const removing = allCalendarEvents.filter(
          (event) =>
            idSet.has(event.id) && canMutateCalendarEvent(user, event),
        )
        if (removing.length === 0) return 0
        const removeIds = new Set(removing.map((event) => event.id))
        const next = allCalendarEvents.filter((event) => !removeIds.has(event.id))
        setAllCalendarEvents(next)
        persistCalendarState(next, user.id, user.role)
        for (const event of removing) {
          void tombstoneSharedCalendarEvent(event)
        }
        return removing.length
      },
      addCalendarEventsBatch: ({
        date,
        dateEnd,
        title,
        kind,
        audience,
        weekdaysOnly,
        schoolYearStart,
        time,
      }) => {
        if (!user) return 0
        const trimmed = title.trim()
        const allowEmptyStatus =
          kind === 'holiday' ||
          kind === 'non-school-day' ||
          kind === 'school-day'
        if ((!trimmed && !allowEmptyStatus) || !date) return 0
        let dates = expandIsoDateRange(date, dateEnd ?? date)
        if (weekdaysOnly) {
          dates = dates.filter((iso) => {
            const [y, m, d] = iso.split('-').map(Number)
            const dow = new Date(y, m - 1, d).getDay()
            return dow >= 1 && dow <= 5
          })
        }
        if (dates.length === 0) return 0
        const created: CalendarEvent[] = dates.map((d) => ({
          id: newCalendarEventId(),
          date: d,
          title: trimmed,
          kind,
          schoolYearStart: schoolYearStart ?? academicYearStartFromIso(d),
          createdBy: user.id,
          audience,
          ...(time ? { time } : {}),
        }))
        const next = [...allCalendarEvents, ...created]
        setAllCalendarEvents(next)
        persistCalendarState(next, user.id, user.role)
        void Promise.all(
          created.map((event) => upsertSharedCalendarEvent(event)),
        ).then((results) => {
          if (results.some((ok) => !ok)) {
            console.warn(
              'campus calendar batch upsert: some events failed to reach Supabase',
            )
          }
        })
        return created.length
      },
    }),
    [calendarEvents, allCalendarEvents, user],
  )

  return (
    <CalendarCampusContext.Provider value={value}>
      {children}
    </CalendarCampusContext.Provider>
  )
}

export function useCalendarCampus() {
  const ctx = useContext(CalendarCampusContext)
  if (!ctx) {
    throw new Error(
      'useCalendarCampus must be used within CalendarCampusProvider',
    )
  }
  return ctx
}
