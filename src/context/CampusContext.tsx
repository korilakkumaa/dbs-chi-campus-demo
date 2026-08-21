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
  expandIsoDateRange,
  loadCalendarEvents,
  newCalendarEventId,
  saveCalendarEvents,
} from '../data/calendarEvents'
import {
  classes as seedClasses,
  seedGradeDeadlines,
  students as seedStudents,
  users as seedUsers,
} from '../data/mockData'
import {
  fetchCampusClassesFromSupabase,
  fetchCampusStudentsFromSupabase,
} from '../data/supabaseStudents'
import { gradeNumberFromClassName } from '../data/teacherWhitelist'
import { supabaseConfigured } from '../lib/supabase'
import type {
  CalendarAudience,
  CalendarEvent,
  CalendarEventKind,
  GradeDeadline,
  SchoolClass,
  Student,
  User,
} from '../types'
import { useAuth } from './AuthContext'

interface CampusContextValue {
  classes: SchoolClass[]
  students: Student[]
  teachers: User[]
  /** True while loading roster/scores from Supabase (when configured). */
  campusDataLoading: boolean
  /** Set when Supabase fetch fails; mock seed may still be shown. */
  campusDataError: string | null
  accessibleClasses: SchoolClass[]
  selectedClassIds: string[]
  toggleClass: (classId: string) => void
  selectClasses: (classIds: string[]) => void
  selectAllAccessible: () => void
  clearSelection: () => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  filteredStudents: Student[]
  selectedStudents: Student[]
  /** All students in classes the signed-in user can access (ignores class picker). */
  accessibleStudents: Student[]
  assignClassToTeacher: (classId: string, teacherId: string | null) => void
  getClassName: (classId: string) => string
  getTeacherName: (teacherId: string | null) => string
  /** All teachers linked to a class (homeroom + co-teachers). */
  getTeachersForClass: (classId: string) => User[]
  getTeacherNamesForClass: (classId: string) => string
  gradeDeadlines: GradeDeadline[]
  updateGradeDeadline: (
    grade: number,
    patch: Partial<Omit<GradeDeadline, 'grade'>>,
  ) => void
  /** Publish current deadline drafts so teachers see them. */
  submitGradeDeadlines: (
    rows: Array<Omit<GradeDeadline, 'submitted'> & { submitted?: boolean }>,
  ) => void
  /** Deadlines for grades covered by currently selected classes. */
  relevantDeadlines: GradeDeadline[]
  taughtGradeNumbers: number[]
  /** Events visible to the signed-in user. */
  calendarEvents: CalendarEvent[]
  addCalendarEvent: (input: {
    date: string
    title: string
    kind: CalendarEventKind
    audience?: CalendarAudience
    lesson?: CalendarEvent['lesson']
  }) => string | undefined
  updateCalendarEvent: (
    id: string,
    patch: Partial<Pick<CalendarEvent, 'date' | 'title' | 'kind' | 'lesson'>>,
  ) => void
  deleteCalendarEvent: (id: string) => void
  addCalendarEventsBatch: (input: {
    date: string
    /** Inclusive end date; when set, creates one event per day in the range. */
    dateEnd?: string
    title: string
    kind: CalendarEventKind
    audience: Exclude<CalendarAudience, { type: 'personal' }>
    /** When true, skip Sat/Sun in a date range. */
    weekdaysOnly?: boolean
  }) => number
}

const globalKey = '__campusCampusContext'
const CampusContext: Context<CampusContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<CampusContextValue | null>
    | undefined) ?? createContext<CampusContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = CampusContext

const SELECTED_CLASSES_KEY = 'campus-cms-selected-classes'

function loadSelectedClassIds(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(SELECTED_CLASSES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string[]>
    const ids = parsed[userId]
    return Array.isArray(ids) ? ids : null
  } catch {
    return null
  }
}

function saveSelectedClassIds(userId: string, ids: string[]) {
  try {
    const raw = localStorage.getItem(SELECTED_CLASSES_KEY)
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, string[]>)
      : {}
    parsed[userId] = ids
    localStorage.setItem(SELECTED_CLASSES_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore quota / private mode */
  }
}

function eventVisibleToUser(
  event: CalendarEvent,
  user: User,
  taughtGrades: number[],
): boolean {
  if (user.role === 'admin') return true
  const { audience } = event
  if (audience.type === 'personal') return audience.ownerId === user.id
  if (audience.type === 'all') return true
  if (audience.type === 'teachers') return audience.teacherIds.includes(user.id)
  if (audience.type === 'grades') {
    return audience.grades.some((g) => taughtGrades.includes(g))
  }
  return false
}

export function CampusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [classes, setClasses] = useState<SchoolClass[]>(seedClasses)
  const [students, setStudents] = useState<Student[]>(seedStudents)
  const [campusDataLoading, setCampusDataLoading] = useState(supabaseConfigured)
  const [campusDataError, setCampusDataError] = useState<string | null>(null)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeDeadlines, setGradeDeadlines] =
    useState<GradeDeadline[]>(seedGradeDeadlines)
  const [allCalendarEvents, setAllCalendarEvents] = useState<CalendarEvent[]>(
    () => loadCalendarEvents(),
  )
  const [selectionReady, setSelectionReady] = useState(false)

  const teachers = useMemo(
    () => seedUsers.filter((u) => u.role === 'teacher'),
    [],
  )

  useEffect(() => {
    if (!supabaseConfigured) {
      setCampusDataLoading(false)
      return
    }
    let cancelled = false
    setCampusDataLoading(true)
    setCampusDataError(null)
    ;(async () => {
      try {
        const [remoteClasses, remoteStudents] = await Promise.all([
          fetchCampusClassesFromSupabase(),
          fetchCampusStudentsFromSupabase(),
        ])
        if (cancelled) return
        if (remoteClasses == null || remoteStudents == null) {
          setCampusDataError('無法從 Supabase 載入學生資料，暫用本機示範資料。')
          setCampusDataLoading(false)
          return
        }
        if (remoteClasses.length > 0) {
          setClasses((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]))
            return remoteClasses.map((c) => {
              const existing = byId.get(c.id)
              return {
                ...c,
                teacherId: existing?.teacherId ?? c.teacherId,
              }
            })
          })
        }
        if (remoteStudents.length > 0) {
          setStudents(remoteStudents)
        } else {
          setCampusDataError('Supabase 尚無 2025/26 學生資料，請先匯入入分檔。')
        }
      } catch (err) {
        if (!cancelled) {
          setCampusDataError(
            err instanceof Error ? err.message : 'Supabase 載入失敗',
          )
        }
      } finally {
        if (!cancelled) setCampusDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const accessibleClasses = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return classes
    return classes.filter(
      (c) => c.teacherId === user.id || user.classIds.includes(c.id),
    )
  }, [user, classes])

  const accessibleIdKey = accessibleClasses.map((c) => c.id).join('|')

  useEffect(() => {
    if (!user) {
      setSelectedClassIds([])
      setSelectionReady(false)
      return
    }
    const accessibleIds = accessibleClasses.map((c) => c.id)
    const saved = loadSelectedClassIds(user.id)
    if (saved === null) {
      setSelectedClassIds(accessibleIds)
    } else if (saved.length === 0) {
      setSelectedClassIds([])
    } else {
      const valid = saved.filter((id) => accessibleIds.includes(id))
      setSelectedClassIds(valid.length > 0 ? valid : accessibleIds)
    }
    setSelectionReady(true)
    // Only re-hydrate when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessible list handled below
  }, [user?.id])

  useEffect(() => {
    if (!user || !selectionReady) return
    const accessibleIds = new Set(accessibleClasses.map((c) => c.id))
    setSelectedClassIds((prev) => {
      const next = prev.filter((id) => accessibleIds.has(id))
      if (prev.length > 0 && next.length === 0 && accessibleClasses.length > 0) {
        return accessibleClasses.map((c) => c.id)
      }
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return prev
      }
      return next
    })
  }, [accessibleIdKey, user?.id, selectionReady, accessibleClasses])

  useEffect(() => {
    if (!user || !selectionReady) return
    saveSelectedClassIds(user.id, selectedClassIds)
  }, [user, selectionReady, selectedClassIds])

  useEffect(() => {
    saveCalendarEvents(allCalendarEvents)
  }, [allCalendarEvents])

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedClassIds.includes(s.classId)),
    [students, selectedClassIds],
  )

  const accessibleStudents = useMemo(() => {
    const ids = new Set(accessibleClasses.map((c) => c.id))
    return students.filter((s) => ids.has(s.classId))
  }, [students, accessibleClasses])

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return selectedStudents
    const compact = q.replace(/\s/g, '')
    // Search across all classes the teacher can access, not only currently selected ones.
    return accessibleStudents.filter((s) => {
      const className = classes.find((c) => c.id === s.classId)?.name ?? ''
      return (
        s.name.toLowerCase().includes(q) ||
        className.toLowerCase().includes(q) ||
        String(s.classNumber).includes(q) ||
        `${className}${s.classNumber}`.toLowerCase().includes(compact)
      )
    })
  }, [accessibleStudents, selectedStudents, searchQuery, classes])

  const taughtGradeNumbers = useMemo(() => {
    const scope =
      selectedClassIds.length > 0
        ? classes.filter((c) => selectedClassIds.includes(c.id))
        : accessibleClasses
    const grades = new Set<number>()
    for (const cls of scope) {
      const n = gradeNumberFromClassName(cls.name)
      if (n != null) grades.add(n)
    }
    return [...grades].sort((a, b) => a - b)
  }, [classes, selectedClassIds, accessibleClasses])

  /** Grades for calendar visibility — all accessible classes, not picker. */
  const visibilityGradeNumbers = useMemo(() => {
    const grades = new Set<number>()
    for (const cls of accessibleClasses) {
      const n = gradeNumberFromClassName(cls.name)
      if (n != null) grades.add(n)
    }
    return [...grades]
  }, [accessibleClasses])

  const relevantDeadlines = useMemo(
    () =>
      gradeDeadlines.filter(
        (d) =>
          d.submitted &&
          taughtGradeNumbers.includes(d.grade) &&
          Boolean(d.activityDue && d.activityTitle.trim()),
      ),
    [gradeDeadlines, taughtGradeNumbers],
  )

  const calendarEvents = useMemo(() => {
    if (!user) return []
    return allCalendarEvents
      .filter((e) => eventVisibleToUser(e, user, visibilityGradeNumbers))
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'zh-Hant'))
  }, [allCalendarEvents, user, visibilityGradeNumbers])

  const getTeachersForClass = (classId: string): User[] => {
    const cls = classes.find((c) => c.id === classId)
    const seen = new Set<string>()
    const list: User[] = []
    if (cls?.teacherId) {
      const primary = teachers.find((t) => t.id === cls.teacherId)
      if (primary) {
        seen.add(primary.id)
        list.push(primary)
      }
    }
    for (const t of teachers) {
      if (seen.has(t.id)) continue
      if (t.classIds.includes(classId)) {
        seen.add(t.id)
        list.push(t)
      }
    }
    return list
  }

  const value = useMemo<CampusContextValue>(
    () => ({
      classes,
      students,
      teachers,
      campusDataLoading,
      campusDataError,
      accessibleClasses,
      selectedClassIds,
      toggleClass: (classId) => {
        setSelectedClassIds((prev) =>
          prev.includes(classId)
            ? prev.filter((id) => id !== classId)
            : [...prev, classId],
        )
      },
      selectClasses: (classIds) => setSelectedClassIds(classIds),
      selectAllAccessible: () =>
        setSelectedClassIds(accessibleClasses.map((c) => c.id)),
      clearSelection: () => setSelectedClassIds([]),
      searchQuery,
      setSearchQuery,
      filteredStudents,
      selectedStudents,
      accessibleStudents,
      assignClassToTeacher: (classId, teacherId) => {
        setClasses((prev) =>
          prev.map((c) => (c.id === classId ? { ...c, teacherId } : c)),
        )
      },
      getClassName: (classId) =>
        classes.find((c) => c.id === classId)?.name ?? classId,
      getTeacherName: (teacherId) =>
        teachers.find((t) => t.id === teacherId)?.name ?? '未分派',
      getTeachersForClass,
      getTeacherNamesForClass: (classId) => {
        const names = getTeachersForClass(classId).map((t) => t.name)
        return names.length > 0 ? names.join('、') : '未分派'
      },
      gradeDeadlines,
      updateGradeDeadline: (grade, patch) => {
        setGradeDeadlines((prev) =>
          prev.map((d) => (d.grade === grade ? { ...d, ...patch } : d)),
        )
      },
      submitGradeDeadlines: (rows) => {
        setGradeDeadlines((prev) =>
          prev.map((d) => {
            const row = rows.find((r) => r.grade === d.grade)
            if (!row) return d
            const hasContent = Boolean(
              row.activityDue && row.activityTitle.trim(),
            )
            return {
              grade: d.grade,
              readingDue: '',
              activityTitle: row.activityTitle,
              activityDue: row.activityDue,
              submitted: row.submitted ?? hasContent,
            }
          }),
        )
      },
      relevantDeadlines,
      taughtGradeNumbers,
      calendarEvents,
      addCalendarEvent: ({ date, title, kind, audience, lesson }) => {
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
          createdBy: user.id,
          audience:
            audience ??
            ({ type: 'personal', ownerId: user.id } satisfies CalendarAudience),
          ...(lesson ? { lesson } : {}),
        }
        setAllCalendarEvents((prev) => [...prev, event])
        return event.id
      },
      updateCalendarEvent: (id, patch) => {
        setAllCalendarEvents((prev) =>
          prev.map((e) => {
            if (e.id !== id) return e
            return {
              ...e,
              ...patch,
              title: patch.title != null ? patch.title.trim() : e.title,
            }
          }),
        )
      },
      deleteCalendarEvent: (id) => {
        setAllCalendarEvents((prev) => prev.filter((e) => e.id !== id))
      },
      addCalendarEventsBatch: ({
        date,
        dateEnd,
        title,
        kind,
        audience,
        weekdaysOnly,
      }) => {
        if (!user) return 0
        const trimmed = title.trim()
        if (!trimmed || !date) return 0
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
          createdBy: user.id,
          audience,
        }))
        setAllCalendarEvents((prev) => [...prev, ...created])
        return created.length
      },
    }),
    [
      classes,
      students,
      teachers,
      accessibleClasses,
      selectedClassIds,
      searchQuery,
      filteredStudents,
      selectedStudents,
      accessibleStudents,
      gradeDeadlines,
      relevantDeadlines,
      taughtGradeNumbers,
      calendarEvents,
      user,
      campusDataLoading,
      campusDataError,
    ],
  )

  return (
    <CampusContext.Provider value={value}>{children}</CampusContext.Provider>
  )
}

export function useCampus() {
  const ctx = useContext(CampusContext)
  if (!ctx) throw new Error('useCampus must be used within CampusProvider')
  return ctx
}
