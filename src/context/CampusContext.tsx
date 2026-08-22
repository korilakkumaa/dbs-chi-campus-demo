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
import { academicYearStartFromIso, formatAcademicYearLabel } from '../data/academicYear'
import {
  defaultScoresAcademicYearStart,
} from '../data/campusScoresYear'
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
import {
  calendarGradeAudienceMatchesUser,
  classIdsForSubjects,
  isCampusSubject,
  isEcClassName,
  normalizeSelectedSubjects,
  subjectsForUser,
  type CampusSubject,
} from '../data/campusSubjects'
import {
  classNameToId,
  classIdsForTeacherInYear,
  formClassLettersForGrade,
  gradeLabel,
  gradeNumberFromClassName,
  hasTrailingAClass,
  rosterForChineseClass,
  teacherWhitelistForYear,
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
  /** Set when Supabase fetch fails; mock seed may still be shown. */
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
  getTeacherName: (teacherId: string | null) => string
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

function schoolYearStartFromIso(iso: string): number {
  return academicYearStartFromIso(iso)
}

function teachersFromWhitelist(startYear: number): User[] {
  return teacherWhitelistForYear(startYear).map((t) => ({
    id: `u-${t.initial.toLowerCase()}`,
    username: t.email,
    password: 'campus',
    name: `${t.name}老師`,
    role: 'teacher' as const,
    classIds: t.classes.map(classNameToId),
  }))
}

/** R / trailing A / EC rows not on the official admin class roll. */
function supplementalClassesFromSeed(
  prev: SchoolClass[],
  remoteIds: Set<string>,
  academicYearStart: number,
): SchoolClass[] {
  const byId = new Map(prev.map((c) => [c.id, c]))
  const names = new Set<string>()
  for (const grade of [7, 8, 9, 10, 11, 12]) {
    for (const letter of formClassLettersForGrade(grade, academicYearStart)) {
      if (letter === 'R' || (letter === 'A' && grade >= 10)) {
        names.add(`${grade}${letter}`)
      }
    }
  }
  for (const name of ['G7 EC', 'G8 EC', 'G9 EC', 'G10 EC']) {
    if (isEcClassName(name)) names.add(name)
  }
  return [...names]
    .filter((name) => !remoteIds.has(classNameToId(name)))
    .map((name) => {
      const id = classNameToId(name)
      const existing = byId.get(id)
      if (existing) return existing
      const gradeNum = gradeNumberFromClassName(name)
      return {
        id,
        name,
        grade: gradeNum != null ? gradeLabel(gradeNum) : '其他',
        teacherId: null,
      } satisfies SchoolClass
    })
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
  const [classes, setClasses] = useState<SchoolClass[]>(seedClasses)
  const [students, setStudents] = useState<Student[]>(seedStudents)
  const [campusDataLoading, setCampusDataLoading] = useState(supabaseConfigured)
  const [campusDataError, setCampusDataError] = useState<string | null>(null)
  const [scoresAcademicYearStart, setScoresAcademicYearStart] = useState(
    defaultScoresAcademicYearStart,
  )
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedSubjects, setSelectedSubjectsState] = useState<CampusSubject[]>(
    ['CHIN'],
  )
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

  const scoreTeachers = useMemo(
    () => teachersFromWhitelist(scoresAcademicYearStart),
    [scoresAcademicYearStart],
  )

  useEffect(() => {
    const demoYear = defaultScoresAcademicYearStart()
    if (!supabaseConfigured) {
      setCampusDataLoading(false)
      if (scoresAcademicYearStart === demoYear) {
        setStudents(seedStudents)
        setCampusDataError(null)
      } else {
        setStudents([])
        setCampusDataError(
          `本機示範資料僅含 ${formatAcademicYearLabel(demoYear)} 學年成績。`,
        )
      }
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
          setCampusDataError('無法從 Supabase 載入學生資料，暫用本機示範資料。')
          if (scoresAcademicYearStart === demoYear) {
            setStudents(seedStudents)
          } else {
            setStudents([])
          }
          setCampusDataLoading(false)
          return
        }
        if (remoteClasses.length > 0) {
          setClasses((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c]))
            const remoteIds = new Set(remoteClasses.map((c) => c.id))
            const merged = remoteClasses.map((c) => {
              const existing = byId.get(c.id)
              return {
                ...c,
                teacherId: existing?.teacherId ?? c.teacherId,
              }
            })
            const ecFromSeed = supplementalClassesFromSeed(
              prev,
              remoteIds,
              scoresAcademicYearStart,
            )
            return [...merged, ...ecFromSeed]
          })
        }
        if (remoteStudents.length > 0) {
          setStudents(remoteStudents)
          setCampusDataError(null)
        } else {
          setStudents([])
          setCampusDataError(
            `Supabase 尚無 ${formatAcademicYearLabel(scoresAcademicYearStart)} 學年成績，請先匯入該學年入分檔。`,
          )
        }
      } catch (err) {
        if (!cancelled) {
          setCampusDataError(
            err instanceof Error ? err.message : 'Supabase 載入失敗',
          )
          if (scoresAcademicYearStart === demoYear) {
            setStudents(seedStudents)
          } else {
            setStudents([])
          }
        }
      } finally {
        if (!cancelled) setCampusDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scoresAcademicYearStart])

  useEffect(() => {
    setClasses((prev) => {
      const id11A = classNameToId('11A')
      const has11A = prev.some((c) => c.id === id11A)
      if (hasTrailingAClass(11, scoresAcademicYearStart)) {
        if (has11A) return prev
        return [
          ...prev,
          {
            id: id11A,
            name: '11A',
            grade: gradeLabel(11),
            teacherId: null,
          },
        ]
      }
      if (!has11A) return prev
      return prev.filter((c) => c.id !== id11A)
    })
  }, [scoresAcademicYearStart])

  const accessibleClasses = useMemo(() => {
    if (!user) return []
    if (user.role === 'admin') return classes
    const yearClassIds = new Set(
      classIdsForTeacherInYear(user.id, scoresAcademicYearStart),
    )
    return classes.filter((c) => yearClassIds.has(c.id))
  }, [user, classes, scoresAcademicYearStart])

  const accessibleSubjects = useMemo(
    () => subjectsForUser(user, accessibleClasses, classes, scoresAcademicYearStart),
    [user, accessibleClasses, classes, scoresAcademicYearStart],
  )

  const accessibleIdKey = accessibleClasses.map((c) => c.id).join('|')
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
      accessibleClasses,
      classes,
      scoresAcademicYearStart,
    )
    setSelectedClassIds(ids)
  }, [
    selectedSubjects,
    user,
    accessibleClasses,
    classes,
    selectionReady,
    accessibleIdKey,
    scoresAcademicYearStart,
  ])

  useEffect(() => {
    if (!user || !selectionReady) return
    saveSelectedSubjects(user.id, selectedSubjects)
  }, [user, selectionReady, selectedSubjects])

  useEffect(() => {
    saveCalendarEvents(allCalendarEvents)
  }, [allCalendarEvents])

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
        : accessibleClasses
    const grades = new Set<number>()
    for (const cls of scope) {
      const n = gradeNumberFromClassName(cls.name)
      if (n != null) grades.add(n)
    }
    return [...grades].sort((a, b) => a - b)
  }, [classes, selectedClassIds, accessibleClasses])

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
      accessibleClasses,
      allClasses: classes,
      selectedSubjects,
      scoresAcademicYearStart,
    }),
    [accessibleClasses, classes, selectedSubjects, scoresAcademicYearStart],
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
    const fromWhitelist = scoreTeachers.filter((t) =>
      t.classIds.includes(classId),
    )
    if (fromWhitelist.length > 0) return fromWhitelist

    const cls = classes.find((c) => c.id === classId)
    const seen = new Set<string>()
    const list: User[] = []
    if (cls?.teacherId) {
      const primary =
        scoreTeachers.find((t) => t.id === cls.teacherId) ??
        teachers.find((t) => t.id === cls.teacherId)
      if (primary) {
        seen.add(primary.id)
        list.push(primary)
      }
    }
    for (const t of scoreTeachers) {
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
            accessibleClasses,
            classes,
            scoresAcademicYearStart,
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
      getTeacherName: (teacherId) =>
        teachers.find((t) => t.id === teacherId)?.name ?? '未分派',
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
          schoolYearStart: schoolYearStartFromIso(date),
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
          schoolYearStart: schoolYearStartFromIso(d),
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
      user,
      campusDataLoading,
      campusDataError,
      scoresAcademicYearStart,
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
