import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { CAMPUS_SCORES_ACADEMIC_YEAR_START } from '../data/campusScoresYear'
import { emptyGradeDeadlines } from '../data/gradeDeadlines'
import {
  fetchGradeDeadlinesYear,
  upsertGradeDeadlinesYear,
} from '../data/supabaseGradeDeadlines'
import type { GradeDeadline } from '../types'
import { useAuth } from './AuthContext'

export interface ScoresCampusContextValue {
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
}

interface ScoresCampusState {
  scoresAcademicYearStart: number
  setScoresAcademicYearStart: (startYear: number) => void
  gradeDeadlines: GradeDeadline[]
  updateGradeDeadline: ScoresCampusContextValue['updateGradeDeadline']
  submitGradeDeadlines: ScoresCampusContextValue['submitGradeDeadlines']
}

const stateGlobalKey = '__campusScoresCampusStateContext'
const ScoresCampusStateContext: Context<ScoresCampusState | null> =
  ((globalThis as Record<string, unknown>)[stateGlobalKey] as
    | Context<ScoresCampusState | null>
    | undefined) ?? createContext<ScoresCampusState | null>(null)
;(globalThis as Record<string, unknown>)[stateGlobalKey] = ScoresCampusStateContext

const valueGlobalKey = '__campusScoresCampusContext'
const ScoresCampusContext: Context<ScoresCampusContextValue | null> =
  ((globalThis as Record<string, unknown>)[valueGlobalKey] as
    | Context<ScoresCampusContextValue | null>
    | undefined) ?? createContext<ScoresCampusContextValue | null>(null)
;(globalThis as Record<string, unknown>)[valueGlobalKey] = ScoresCampusContext

function useScoresCampusState(): ScoresCampusState {
  const ctx = useContext(ScoresCampusStateContext)
  if (!ctx) {
    throw new Error(
      'useScoresCampusYear must be used within ScoresCampusProvider',
    )
  }
  return ctx
}

/** Owns academic year + grade deadline state. Nest Roster inside this. */
export function ScoresCampusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [scoresAcademicYearStart, setScoresAcademicYearStart] = useState<number>(
    CAMPUS_SCORES_ACADEMIC_YEAR_START,
  )
  const [gradeDeadlines, setGradeDeadlines] = useState<GradeDeadline[]>(
    emptyGradeDeadlines,
  )

  useEffect(() => {
    let cancelled = false
    void fetchGradeDeadlinesYear(scoresAcademicYearStart).then((remote) => {
      if (cancelled) return
      setGradeDeadlines(remote?.deadlines ?? emptyGradeDeadlines())
    })
    return () => {
      cancelled = true
    }
  }, [scoresAcademicYearStart])

  const state = useMemo<ScoresCampusState>(
    () => ({
      scoresAcademicYearStart,
      setScoresAcademicYearStart,
      gradeDeadlines,
      updateGradeDeadline: (grade, patch) => {
        setGradeDeadlines((prev) =>
          prev.map((d) => (d.grade === grade ? { ...d, ...patch } : d)),
        )
      },
      submitGradeDeadlines: (rows) => {
        setGradeDeadlines((prev) => {
          const next = prev.map((d) => {
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
          })
          void upsertGradeDeadlinesYear(
            scoresAcademicYearStart,
            next,
            user?.id ?? 'admin',
          )
          return next
        })
      },
    }),
    [scoresAcademicYearStart, gradeDeadlines, user?.id],
  )

  // Provisional until ScoresCampusValueProvider runs inside Roster.
  const provisional = useMemo<ScoresCampusContextValue>(
    () => ({
      ...state,
      relevantDeadlines: [],
      taughtGradeNumbers: [],
    }),
    [state],
  )

  return (
    <ScoresCampusStateContext.Provider value={state}>
      <ScoresCampusContext.Provider value={provisional}>
        {children}
      </ScoresCampusContext.Provider>
    </ScoresCampusStateContext.Provider>
  )
}

/**
 * Re-provides full ScoresCampusContext after Roster can supply taught grades.
 * Nest inside RosterProvider (Scores state must already be above Roster).
 */
export function ScoresCampusValueProvider({
  taughtGradeNumbers,
  relevantDeadlines,
  children,
}: {
  taughtGradeNumbers: number[]
  relevantDeadlines: GradeDeadline[]
  children: ReactNode
}) {
  const state = useScoresCampusState()
  const value = useMemo<ScoresCampusContextValue>(
    () => ({
      ...state,
      taughtGradeNumbers,
      relevantDeadlines,
    }),
    [state, taughtGradeNumbers, relevantDeadlines],
  )

  return (
    <ScoresCampusContext.Provider value={value}>
      {children}
    </ScoresCampusContext.Provider>
  )
}

export function useScoresCampus() {
  const ctx = useContext(ScoresCampusContext)
  if (!ctx) {
    throw new Error('useScoresCampus must be used within ScoresCampusProvider')
  }
  return ctx
}

/** Year + deadline mutations; safe to call from Roster (before derived grades). */
export function useScoresCampusYear() {
  return useScoresCampusState()
}
