import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { formatAcademicYearLabel } from '../data/academicYear'
import {
  addClassesFromRoster,
  buildSchoolClasses,
  mergeRemoteClasses,
} from '../data/schoolClasses'
import { teachersForYear } from '../data/staffUsers'
import {
  fetchCampusClassesFromSupabase,
  fetchCampusStudentsFromSupabase,
} from '../data/supabaseStudents'
import {
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
import type { SchoolClass, Student, User } from '../types'
import { useAuth } from './AuthContext'
import {
  ScoresCampusValueProvider,
  useScoresCampusYear,
} from './ScoresCampusContext'

export interface RosterContextValue {
  classes: SchoolClass[]
  students: Student[]
  teachers: User[]
  /** True while loading roster/scores from Supabase (when configured). */
  campusDataLoading: boolean
  /** Set when roster/scores cannot be loaded. */
  campusDataError: string | null
  accessibleClasses: SchoolClass[]
  /**
   * Timetable / calendar / nav: classes for the current teaching year.
   * Not part of the legacy useCampus() surface; for Calendar + scores derived.
   */
  teachingAccessibleClasses: SchoolClass[]
  teachingYearStart: number
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
}

const globalKey = '__campusRosterContext'
const RosterContext: Context<RosterContextValue | null> =
  ((globalThis as Record<string, unknown>)[globalKey] as
    | Context<RosterContextValue | null>
    | undefined) ?? createContext<RosterContextValue | null>(null)
;(globalThis as Record<string, unknown>)[globalKey] = RosterContext

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

export function RosterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    scoresAcademicYearStart,
    gradeDeadlines,
  } = useScoresCampusYear()

  const [classes, setClasses] = useState<SchoolClass[]>(() =>
    buildSchoolClasses(scoresAcademicYearStart),
  )
  const [students, setStudents] = useState<Student[]>([])
  const [campusDataLoading, setCampusDataLoading] = useState(supabaseConfigured)
  const [campusDataError, setCampusDataError] = useState<string | null>(null)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [selectedSubjects, setSelectedSubjectsState] = useState<CampusSubject[]>(
    ['CHIN'],
  )
  const [searchQuery, setSearchQuery] = useState('')
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
    setStudents([])
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
        const nameById = new Map(remoteClasses.map((c) => [c.id, c.name]))
        setClasses(
          addClassesFromRoster(
            mergeRemoteClasses(
              buildSchoolClasses(scoresAcademicYearStart),
              remoteClasses,
            ),
            scoresAcademicYearStart,
            remoteStudents,
            nameById,
          ),
        )
        if (remoteStudents.length > 0) {
          setStudents(remoteStudents)
          setCampusDataError(null)
        } else {
          setStudents([])
          setCampusDataError(
            `尚未匯入 ${formatAcademicYearLabel(scoresAcademicYearStart)} 學年名冊。`,
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

  const getTeachersForClass = (classId: string): User[] => {
    const fromWhitelist = teachers.filter((t) => t.classIds.includes(classId))
    if (fromWhitelist.length > 0) return fromWhitelist

    const cls = classes.find((c) => c.id === classId)
    if (!cls?.teacherId) return []
    const primary = teachers.find((t) => t.id === cls.teacherId)
    return primary ? [primary] : []
  }

  const value = useMemo<RosterContextValue>(
    () => ({
      classes,
      students,
      teachers,
      campusDataLoading,
      campusDataError,
      accessibleClasses,
      teachingAccessibleClasses,
      teachingYearStart,
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
    }),
    [
      classes,
      students,
      teachers,
      campusDataLoading,
      campusDataError,
      accessibleClasses,
      teachingAccessibleClasses,
      teachingYearStart,
      selectedSubjects,
      accessibleSubjects,
      selectedClassIds,
      searchQuery,
      filteredStudents,
      selectedStudents,
      accessibleStudents,
      user,
    ],
  )

  return (
    <RosterContext.Provider value={value}>
      <ScoresCampusValueProvider
        taughtGradeNumbers={taughtGradeNumbers}
        relevantDeadlines={relevantDeadlines}
      >
        {children}
      </ScoresCampusValueProvider>
    </RosterContext.Provider>
  )
}

export function useRoster() {
  const ctx = useContext(RosterContext)
  if (!ctx) throw new Error('useRoster must be used within RosterProvider')
  return ctx
}
