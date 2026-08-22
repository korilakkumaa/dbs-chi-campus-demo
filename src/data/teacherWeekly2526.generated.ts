/** Auto-generated from YLN 2025/26 CLS personal timetable PDF. Do not edit by hand. */
import type { DayPeriod, SchoolWeekday } from './teacherTimetable'

const YEAR = {
  label: '2025/26',
  validFrom: '2025-09-01',
  validTo: '2026-08-31',
  teachingUntil: '2026-07-15',
} as const

function L(
  start: string,
  end: string,
  subject: string,
  group: string,
  room: string,
): DayPeriod {
  return { type: 'lesson', start, end, subject, group, room }
}
function F(start: string, end: string): DayPeriod {
  return { type: 'free', start, end }
}
function B(start: string, end: string, label: string): DayPeriod {
  return { type: 'break', start, end, label }
}

const MORNING: DayPeriod = {
  type: 'break',
  start: '08:10',
  end: '08:30',
  label: '早會',
}
const DISMISSAL: DayPeriod = {
  type: 'break',
  start: '15:30',
  end: '16:00',
  label: '放學',
}

function day(...middle: DayPeriod[]): DayPeriod[] {
  return [MORNING, ...middle, DISMISSAL]
}

const YLN_WEEKLY: Record<SchoolWeekday, DayPeriod[]> = {
  1: day(
    L('08:30', '09:15', 'CHIN-PM3', 'G11M, G11P', 'SR6'),
    L('09:15', '10:00', 'CHIN-PM3', 'G11M, G11P', 'SR6'),
    B('10:00', '10:20', '小息'),
    F('10:20', '11:05'),
    L('11:05', '11:50', 'CHIS', 'G7L', '07L'),
    F('11:50', '12:35'),
    B('12:35', '14:00', '午膳'),
    L('14:00', '14:45', 'CHIN', 'G7P', '07P'),
    L('14:45', '15:30', 'CHIN', 'G7P', '07P'),
  ),
  2: day(
    L('08:30', '09:15', 'CHIN', 'G7P', '07P'),
    F('09:15', '10:00'),
    B('10:00', '10:20', '小息'),
    L('10:20', '11:05', 'CHIS', 'G7L', '07L'),
    F('11:05', '11:50'),
    F('11:50', '12:35'),
    B('12:35', '14:00', '午膳'),
    L('14:00', '14:45', 'CHIN', 'G7A', '07A'),
    L('14:45', '15:30', 'CHIN', 'G7A', '07A'),
  ),
  3: day(
    L('08:30', '09:15', 'CHIN-PM3', 'G11M, G11P', 'SR6'),
    F('09:15', '10:00'),
    B('10:00', '10:20', '小息'),
    L('10:20', '11:05', 'CHIS', 'G7P', '07P'),
    F('11:05', '11:50'),
    F('11:50', '12:35'),
    B('12:35', '14:00', '午膳'),
    L('14:00', '14:45', 'CHIN', 'G7A', '07A'),
    L('14:45', '15:30', 'CHIN', 'G7A', '07A'),
  ),
  4: day(
    L('08:30', '09:15', 'CHIS', 'G7S', '07S'),
    F('09:15', '10:00'),
    B('10:00', '10:20', '小息'),
    L('10:20', '11:05', 'CHIN', 'G7P', '07P'),
    F('11:05', '11:50'),
    L('11:50', '12:35', 'CHIN-PM3', 'G11M, G11P', 'SR6'),
    B('12:35', '14:00', '午膳'),
    F('14:00', '14:45'),
    F('14:45', '15:30'),
  ),
  5: day(
    L('08:30', '09:15', 'CHIN', 'G7P', '07P'),
    F('09:15', '10:00'),
    B('10:00', '10:20', '小息'),
    L('10:20', '11:05', 'CHIS', 'G7S', '07S'),
    F('11:05', '11:50'),
    F('11:50', '12:35'),
    B('12:35', '14:00', '午膳'),
    L('14:00', '14:45', 'CHIS', 'G7P', '07P'),
    L('14:45', '15:30', 'CHIN', 'G7A', '07A'),
  ),
}

export const TEACHER_WEEKLY_2526: Record<
  string,
  { academicYear: typeof YEAR; weekly: Record<SchoolWeekday, DayPeriod[]> }
> = {
  'u-yln': { academicYear: { ...YEAR }, weekly: YLN_WEEKLY },
}
