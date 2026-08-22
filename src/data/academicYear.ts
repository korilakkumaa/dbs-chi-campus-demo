/** Academic year helpers. A year labeled 2025/26 runs Sep 2025 – Aug 2026. */

export type AcademicYear = {
  /** First calendar year (e.g. 2025 for 2025/26). */
  startYear: number
  label: string
}

export function formatAcademicYearLabel(startYear: number): string {
  return `${startYear}/${String(startYear + 1).slice(-2)}`
}

/**
 * Academic year in force for `date`.
 * Switches on 1 September: on/after 1 Sep YYYY → YYYY/(YYYY+1).
 */
export function academicYearStartYear(date = new Date()): number {
  return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
}

/** Academic year start year for an ISO date (YYYY-MM-DD). */
export function academicYearStartFromIso(iso: string): number {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return academicYearStartYear()
  }
  const [y, m, d] = parts
  return academicYearStartYear(new Date(y, m - 1, d))
}

/** Default academic year for `date` (pure calendar rule, no floor). */
export function defaultAcademicYearStart(date = new Date()): number {
  return academicYearStartYear(date)
}

export function toAcademicYear(startYear: number): AcademicYear {
  return {
    startYear,
    label: formatAcademicYearLabel(startYear),
  }
}

/**
 * Selectable years: current academic year first, then nearby years.
 */
export function listAcademicYearStarts(date = new Date()): number[] {
  const current = academicYearStartYear(date)
  const years: number[] = []
  for (let y = current + 1; y >= current - 4; y--) years.push(y)
  return years
}

/** Sep … Aug month list for an academic year. */
export function academicYearMonths(
  startYear: number,
): { year: number; monthIndex: number; label: string }[] {
  const labels = [
    '九月',
    '十月',
    '十一月',
    '十二月',
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
  ]
  return labels.map((label, i) => {
    const monthIndex = (8 + i) % 12
    const year = i < 4 ? startYear : startYear + 1
    return { year, monthIndex, label }
  })
}

export function academicYearDateRange(startYear: number): {
  from: string
  to: string
} {
  return {
    from: `${startYear}-09-01`,
    to: `${startYear + 1}-08-31`,
  }
}

export function isoInAcademicYear(iso: string, startYear: number): boolean {
  const { from, to } = academicYearDateRange(startYear)
  return iso >= from && iso <= to
}
