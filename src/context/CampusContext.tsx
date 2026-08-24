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
  assembleCalendarEvents,
  canMutateCalendarEvent,
  defaultCalendarAudience,
  isSharedCalendarEvent,
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
import { academicYearStartFromIso, formatAcademicYearLabel } from '../data/academicYear'
import {
  CAMPUS_SCORES_ACADEMIC_YEAR_START,
} from '../data/campusScoresYear'
import { emptyGradeDeadlines } from '../data/gradeDeadlines'
import {
  buildSchoolClasses,
  mergeRemoteClasses,
} from '../data/schoolClasses'
import { teachersForYear } from '../data/staffUsers'
import {
  fetchCampusClassesFromSupabase,
  fetchCampusStudentsFromSupabase,
} from '../data/supabaseStudents'
import {
  calendarGradeAudienceMatchesUser,
  classIdsForSubjects,
  isCampusSubject,
  normalizeSelectedSubjects,
  subjectsForUser,
  type CampusSubject,
} from '../data/campusSubjects'
import {
  accessibleClassesForTeacherYear,
  gradeNumberFromClassName,
  latestTeacherWhitelistYear,
  rosterForChineseClass,
} from '../data/teacherWhitelist'
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
  /** Set when roster/scores cannot be loaded. */
  campusDataError: string | null
  accessibleClasses: SchoolClass[]
  /** Subject filter in the nav bar (中文 / EC / 中史 / PTH) — multi-select. */
  selectedSubjects: CampusSubject[]
  toggleSelectedSubject: (subject: CampusSubject) => void
  accessibleSubjects: CampusSubject[]
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
  /** All teachers linked to a class (homeroom + co-teachers). */
  getTeachersForClass: (classId: string) => User[]
  getTeacherNamesForClass: (classId: string) => string
  /** Academic year for 分數 pages (Supabase academic_year_start). */
  scoresAcademicYearStart: number
  setScoresAcademicYearStart: (startYear: number) => void
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
  /** All events visible to the signed-in user (continuous across school years). */
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
    /** Stamp events onto this academic year calendar (defaults from the date). */
    schoolYearStart?: number
  }) => number
}

const globalKey = '__campusCampusContext'
const CampusContext: Context<CampusContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<CampusContextValue | null>
    | undefined) ?? createContext<CampusContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = CampusContext

const SELECTED_SUBJECT_KEY = 'campus-cms-selected-subject'

function loadSelectedSubjects(userId: string): CampusSubject[] | null {
  try {
    const raw = localStorage.getItem(SELECTED_SUBJECT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<
      string,
      CampusSubject | CampusSubject[]
    >
    const value = parsed[userId]
    if (Array.isArray(value)) {
      const subjects = value.filter(isCampusSubject)
      return subjects.length > 0 ? normalizeSelectedSubjects(subjects) : null
    }
    if (isCampusSubject(value)) return [value]
    return null
  } catch {
    return null
  }
}

function saveSelectedSubjects(userId: string, subjects: CampusSubject[]) {
  try {
    const raw = localStorage.getItem(SELECTED_SUBJECT_KEY)
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, CampusSubject | CampusSubject[]>)
      : {}
    parsed[userId] = normalizeSelectedSubjects(subjects)
    localStorage.setItem(SELECTED_SUBJECT_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore quota / private mode */
  }
}

function eventVisibleToUser(
  event: CalendarEvent,
  user: User,
  ctx: {
    accessibleClasses: SchoolClass[]
    allClasses: SchoolClass[]
    selectedSubjects: CampusSubject[]
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

export function CampusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [classes, setClasses] = useState<SchoolClass[]>(() =>
    buildSchoolClasses(CAMPUS_SCORES_ACADEMIC_YEAR_START),
  )
  const [students, setStudents] = useState<Student[]>([])
  const [campusDataLoading, setCampusDataLoading] = useState(supabaseConfigured)
  const [campusDataError, setCampusDataError] = useState<string | null>(null)
  const [scoresAcademicYearStart, setScoresAcademicYearStart] = useState<number>(
    CAMPUS_SCORES_ACADEMIC_YEAR_START,
  )
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedSubjects, setSelectedSubjectsState] = useState<CampusSubject[]>(
    ['CHIN'],
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeDeadlines, setGradeDeadlines] = useState<GradeDeadline[]>(
    emptyGradeDeadlines,
  )
  const [allCalendarEvents, setAllCalendarEvents] = useState<CalendarEvent[]>(
    () => assembleCalendarEvents(user?.id),
  )
  const [selectionReady, setSelectionReady] = useState(false)

  const teachingYearStart =
    user?.role === 'teacher'
      ? latestTeacherWhitelistYear()
      : scoresAcademicYearStart

  const teachers = useMemo(
    () => teachersForYear(scoresAcademicYearStart),
    [scoresAcademicYearStart],
  )

  useEffect(() => {
    setClasses(buildSchoolClasses(scoresAcademicYearStart))
    if (!supabaseConfigured) {
      setCampusDataLoading(false)
      setStudents([])
      setCampusDataError('尚未連線資料庫，無法載入學生成績。')
      return
    }
    let cancelled = false
    setCampusDataLoading(true)
    setCampusDataError(null)
    ;(async () => {
      try {
        const [remoteClasses, remoteStudents] = await Promise.all([
          fetchCampusClassesFromSupabase(),
          fetchCampusStudentsFromSupabase(scoresAcademicYearStart),
        ])
        if (cancelled) return
        if (remoteClasses == null || remoteStudents == null) {
          setStudents([])
          setCampusDataError('無法從資料庫載入學生資料。')
          setCampusDataLoading(false)
          return
        }
        setClasses(
          mergeRemoteClasses(
            buildSchoolClasses(scoresAcademicYearStart),
            remoteClasses,
          ),
        )
        if (remoteStudents.length > 0) {
          setStudents(remoteStudents)
          setCampusDataError(null)
        } else {
          setStudents([])
          setCampusDataError(
            `尚未匯入 ${formatAcademicYearLabel(scoresAcademicYearStart)} 學年成績。`,
          )
        }
      } catch (err) {
        if (!cancelled) {
          setStudents([])
          setCampusDataError(
            err instanceof Error ? err.message : '資料庫載入失敗',
          )
        }
      } finally {
        if (!cancelled) setCampusDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scoresAcademicYearStart])

  /** Score pages: classes this teacher taught in the selected scores year. */
  const accessibleClasses = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return classes
    return accessibleClassesForTeacherYear(
      user,
      classes,
      scoresAcademicYearStart,
    )
  }, [user, classes, scoresAcademicYearStart])

  /**
   * Timetable / calendar / nav subjects: current teaching year (latest whitelist).
   * Must not be mixed with 分數 year — 2025/26 scores ≠ 2026/27 assignments.
   */
  const teachingAccessibleClasses = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return classes
    return accessibleClassesForTeacherYear(user, classes, teachingYearStart)
  }, [user, classes, teachingYearStart])

  const accessibleSubjects = useMemo(
    () =>
      subjectsForUser(
        user,
        teachingAccessibleClasses,
        classes,
        teachingYearStart,
      ),
    [user, teachingAccessibleClasses, classes, teachingYearStart],
  )

  const accessibleIdKey = teachingAccessibleClasses.map((c) => c.id).join('|')
  const accessibleSubjectsKey = accessibleSubjects.join('|')

  useEffect(() => {
    if (!user) {
      setSelectedClassIds([])
      setSelectedSubjectsState(['CHIN'])
      setSelectionReady(false)
      return
    }
    const saved = loadSelectedSubjects(user.id)
    const pick =
      saved?.filter((s) => accessibleSubjects.includes(s)) ??
      (accessibleSubjects.length > 0 ? [accessibleSubjects[0]] : ['CHIN'])
    setSelectedSubjectsState(
      pick.length > 0 ? normalizeSelectedSubjects(pick) : ['CHIN'],
    )
    setSelectionReady(true)
    // Only re-hydrate when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subject list handled below
  }, [user?.id])

  useEffect(() => {
    if (!user || !selectionReady) return
    const valid = selectedSubjects.filter((s) => accessibleSubjects.includes(s))
    if (valid.length === 0 && accessibleSubjects.length > 0) {
      setSelectedSubjectsState([accessibleSubjects[0]])
      return
    }
    if (
      valid.length !== selectedSubjects.length ||
      valid.some((s, i) => s !== selectedSubjects[i])
    ) {
      setSelectedSubjectsState(normalizeSelectedSubjects(valid))
    }
  }, [
    accessibleSubjectsKey,
    user?.id,
    selectionReady,
    accessibleSubjects,
    selectedSubjects,
  ])

  useEffect(() => {
    if (!user || !selectionReady) return
    const ids = classIdsForSubjects(
      selectedSubjects,
      user,
      teachingAccessibleClasses,
      classes,
      teachingYearStart,
    )
    setSelectedClassIds(ids)
  }, [
    selectedSubjects,
    user,
    teachingAccessibleClasses,
    classes,
    selectionReady,
    accessibleIdKey,
    teachingYearStart,
  ])

  useEffect(() => {
    if (!user || !selectionReady) return
    saveSelectedSubjects(user.id, selectedSubjects)
  }, [user, selectionReady, selectedSubjects])

  useEffect(() => {
    setAllCalendarEvents(assembleCalendarEvents(user?.id))
    let cancelled = false
    ;(async () => {
      const remote = await fetchSharedCalendarRows()
      if (cancelled || remote == null) return
      if (remote.length > 0) {
        saveSharedOverlay(overlayFromRemoteRows(remote))
      } else {
        await pushSharedOverlayToRemote(
          loadSharedOverlay(),
          buildSeedCalendarEvents(),
        )
      }
      if (!cancelled) setAllCalendarEvents(assembleCalendarEvents(user?.id))
    })()
    const unsubscribe = subscribeSharedCalendar((row) => {
      applyRemoteRowToOverlay(row)
      setAllCalendarEvents(assembleCalendarEvents(user?.id))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user?.id])

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedClassIds.includes(s.classId)),
    [students, selectedClassIds],
  )

  const accessibleStudents = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return students

    const byId = new Map<string, Student>()
    for (const cls of accessibleClasses) {
      for (const s of rosterForChineseClass(
        cls.id,
        cls.name,
        students,
        scoresAcademicYearStart,
      )) {
        byId.set(s.id, s)
      }
    }
    return [...byId.values()]
  }, [user, students, accessibleClasses, scoresAcademicYearStart])

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
        : teachingAccessibleClasses
    const grades = new Set<number>()
    for (const cls of scope) {
      const n = gradeNumberFromClassName(cls.name)
      if (n != null) grades.add(n)
    }
    return [...grades].sort((a, b) => a - b)
  }, [classes, selectedClassIds, teachingAccessibleClasses])

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

  const calendarVisibilityCtx = useMemo(
    () => ({
      accessibleClasses: teachingAccessibleClasses,
      allClasses: classes,
      selectedSubjects,
      scoresAcademicYearStart: teachingYearStart,
    }),
    [teachingAccessibleClasses, classes, selectedSubjects, teachingYearStart],
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

  const getTeachersForClass = (classId: string): User[] => {
    const fromWhitelist = teachers.filter((t) => t.classIds.includes(classId))
    if (fromWhitelist.length > 0) return fromWhitelist

    const cls = classes.find((c) => c.id === classId)
    if (!cls?.teacherId) return []
    const primary = teachers.find((t) => t.id === cls.teacherId)
    return primary ? [primary] : []
  }

  const value = useMemo<CampusContextValue>(
    () => ({
      classes,
      students,
      teachers,
      campusDataLoading,
      campusDataError,
      accessibleClasses,
      selectedSubjects,
      toggleSelectedSubject: (subject: CampusSubject) => {
        setSelectedSubjectsState((prev) => {
          const set = new Set(prev)
          if (set.has(subject)) {
            if (set.size <= 1) return prev
            set.delete(subject)
          } else {
            set.add(subject)
          }
          return normalizeSelectedSubjects(set)
        })
      },
      accessibleSubjects,
      selectedClassIds,
      toggleClass: (classId) => {
        setSelectedClassIds((prev) =>
          prev.includes(classId)
            ? prev.filter((id) => id !== classId)
            : [...prev, classId],
        )
      },
      selectClasses: (classIds) => setSelectedClassIds(classIds),
      selectAllAccessible: () => {
        if (!user) return
        setSelectedClassIds(
          classIdsForSubjects(
            selectedSubjects,
            user,
            teachingAccessibleClasses,
            classes,
            teachingYearStart,
          ),
        )
      },
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
      getTeachersForClass,
      getTeacherNamesForClass: (classId) => {
        const names = getTeachersForClass(classId).map((t) => t.name)
        return names.length > 0 ? names.join('、') : '未分派'
      },
      scoresAcademicYearStart,
      setScoresAcademicYearStart,
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
          schoolYearStart: academicYearStartFromIso(date),
          createdBy: user.id,
          audience: audience ?? defaultCalendarAudience(user, lesson),
          ...(lesson ? { lesson } : {}),
        }
        const next = [...allCalendarEvents, event]
        setAllCalendarEvents(next)
        persistCalendarState(next, user.id, user.role)
        if (isSharedCalendarEvent(event)) {
          void upsertSharedCalendarEvent(event)
        }
        return event.id
      },
      updateCalendarEvent: (id, patch) => {
        const current = allCalendarEvents.find((e) => e.id === id)
        if (!current || !canMutateCalendarEvent(user, current)) return
        const updated: CalendarEvent = {
          ...current,
          ...patch,
          title: patch.title != null ? patch.title.trim() : current.title,
        }
        const next = allCalendarEvents.map((e) => (e.id === id ? updated : e))
        setAllCalendarEvents(next)
        persistCalendarState(next, user?.id, user?.role)
        if (isSharedCalendarEvent(updated)) {
          void upsertSharedCalendarEvent(updated)
        }
      },
      deleteCalendarEvent: (id) => {
        const current = allCalendarEvents.find((e) => e.id === id)
        if (!current || !canMutateCalendarEvent(user, current)) return
        const next = allCalendarEvents.filter((e) => e.id !== id)
        setAllCalendarEvents(next)
        persistCalendarState(next, user?.id, user?.role)
        if (isSharedCalendarEvent(current)) {
          void tombstoneSharedCalendarEvent(current)
        }
      },
      addCalendarEventsBatch: ({
        date,
        dateEnd,
        title,
        kind,
        audience,
        weekdaysOnly,
        schoolYearStart,
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
          schoolYearStart: schoolYearStart ?? academicYearStartFromIso(d),
          createdBy: user.id,
          audience,
        }))
        const next = [...allCalendarEvents, ...created]
        setAllCalendarEvents(next)
        persistCalendarState(next, user.id, user.role)
        for (const event of created) {
          if (isSharedCalendarEvent(event)) {
            void upsertSharedCalendarEvent(event)
          }
        }
        return created.length
      },
    }),
    [
      classes,
      students,
      teachers,
      accessibleClasses,
      teachingAccessibleClasses,
      selectedSubjects,
      accessibleSubjects,
      selectedClassIds,
      searchQuery,
      filteredStudents,
      selectedStudents,
      accessibleStudents,
      gradeDeadlines,
      relevantDeadlines,
      taughtGradeNumbers,
      calendarEvents,
      allCalendarEvents,
      user,
      campusDataLoading,
      campusDataError,
      scoresAcademicYearStart,
      teachingYearStart,
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
