/**
 * Supabase 成績／名冊資料的學年起點。
 * 分數-班級 strictly uses that year's teacher whitelist (if imported)
 * and that year's student name list. Do not mix 2024/25, 2025/26, 2026/27.
 */

/** 目前已匯入名冊／成績的學年（academic_year_start）。 */
export const SCORES_IMPORTED_ACADEMIC_YEARS = [2024, 2025, 2026] as const

/**
 * 2025/26 was imported with raw STID as students.student_no (table PK).
 * Other years prefix STID so the same person can exist in two year rows.
 */
export const SCORES_NATIVE_STUDENT_NO_YEAR = 2025

export function storedStudentNo(
  academicYearStart: number,
  officialNo: string,
): string {
  const stid = String(officialNo).trim()
  if (academicYearStart === SCORES_NATIVE_STUDENT_NO_YEAR) return stid
  return `y${academicYearStart}-${stid}`
}

export function officialStudentNo(stored: string): string {
  const m = stored.match(/^y\d{4}-(.+)$/)
  return m ? m[1] : stored
}

/** 分數頁預設學年（有資料的最新學年）。 */
export const CAMPUS_SCORES_ACADEMIC_YEAR_START =
  SCORES_IMPORTED_ACADEMIC_YEARS[SCORES_IMPORTED_ACADEMIC_YEARS.length - 1]

export function defaultScoresAcademicYearStart(): number {
  return CAMPUS_SCORES_ACADEMIC_YEAR_START
}

/** 分數頁可選學年：已匯入名冊／成績的學年（新至舊）。 */
export function listScoresAcademicYearStarts(): number[] {
  return [...SCORES_IMPORTED_ACADEMIC_YEARS].sort((a, b) => b - a)
}
