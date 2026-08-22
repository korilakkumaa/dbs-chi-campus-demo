import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  defaultScoresAcademicYearStart,
  listScoresAcademicYearStarts,
} from '../data/campusScoresYear'
import { useCampus } from '../context/CampusContext'

function parseStartYearParam(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return null
  return Math.trunc(n)
}

/** Sync `?year=` on /class routes with CampusContext score fetch. */
export function useScoresAcademicYear() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    scoresAcademicYearStart,
    setScoresAcademicYearStart,
    campusDataLoading,
    campusDataError,
  } = useCampus()

  const yearOptions = useMemo(() => listScoresAcademicYearStarts(), [])
  const defaultStart = useMemo(() => defaultScoresAcademicYearStart(), [])

  useEffect(() => {
    const param = parseStartYearParam(searchParams.get('year'))
    const next =
      param != null && yearOptions.includes(param) ? param : defaultStart
    if (next !== scoresAcademicYearStart) {
      setScoresAcademicYearStart(next)
    }
  }, [
    searchParams,
    yearOptions,
    defaultStart,
    scoresAcademicYearStart,
    setScoresAcademicYearStart,
  ])

  const onSelectYear = (next: number) => {
    setScoresAcademicYearStart(next)
    if (next === defaultStart) {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('year')
          return p
        },
        { replace: true },
      )
    } else {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('year', String(next))
          return p
        },
        { replace: true },
      )
    }
  }

  return {
    startYear: scoresAcademicYearStart,
    onSelectYear,
    yearOptions,
    defaultStart,
    campusDataLoading,
    campusDataError,
  }
}

/** Append `?year=` when navigating within 分數 routes. */
export function withScoresYearQuery(
  path: string,
  startYear: number,
  defaultStart: number,
): string {
  if (startYear === defaultStart) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}year=${startYear}`
}
