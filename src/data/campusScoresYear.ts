/**
 * Supabase 成績／名冊資料的學年起點（2025/26 = Sep 2025 – Aug 2026）。
 * 下學期入分檔檔名雖為 2026 年 1 月，仍屬此學年；不可與 2026/27 時間表／2627 白名單混用。
 */
import { listAcademicYearStarts } from './academicYear'

/** 目前已匯入 Supabase 的成績學年（academic_year_start）。 */
export const SCORES_IMPORTED_ACADEMIC_YEARS = [2025] as const

/** 分數頁預設學年（有資料的最新學年）。 */
export const CAMPUS_SCORES_ACADEMIC_YEAR_START =
  SCORES_IMPORTED_ACADEMIC_YEARS[SCORES_IMPORTED_ACADEMIC_YEARS.length - 1]

export function defaultScoresAcademicYearStart(): number {
  return CAMPUS_SCORES_ACADEMIC_YEAR_START
}

/** 分數頁可選學年（與校曆相同範圍）。 */
export function listScoresAcademicYearStarts(): number[] {
  return listAcademicYearStarts()
}
