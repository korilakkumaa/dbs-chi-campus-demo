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
  classes as seedClasses,
  seedGradeDeadlines,
  students as seedStudents,
  users as seedUsers,
} from '../data/mockData'
import { gradeNumberFromClassName } from '../data/teacherWhitelist'
import type { GradeDeadline, SchoolClass, Student, User } from '../types'
import { useAuth } from './AuthContext'

interface CampusContextValue {
  classes: SchoolClass[]
  students: Student[]
  teachers: User[]
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

export function CampusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [classes, setClasses] = useState<SchoolClass[]>(seedClasses)
  const [students] = useState<Student[]>(seedStudents)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeDeadlines, setGradeDeadlines] =
    useState<GradeDeadline[]>(seedGradeDeadlines)
  const [selectionReady, setSelectionReady] = useState(false)

  const teachers = useMemo(
    () => seedUsers.filter((u) => u.role === 'teacher'),
    [],
  )

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
      gradeDeadlines,
      relevantDeadlines,
      taughtGradeNumbers,
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
