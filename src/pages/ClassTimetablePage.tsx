import { useMemo, useState, type CSSProperties } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import {
  GRADE_LEVELS,
  gradeLabel,
} from '../data/teacherWhitelist'
import {
  LESSON_SLOTS,
  academicYearLabelForGradeTimetable,
  classDisplayLabel,
  getGradeSlotGrid,
  lessonCellClassLabel,
  listCommonFreeSlots,
  listGradeClassTeacherPairs,
  listGradeCommonFreeTeachers,
  type GradeLevel,
  type GradeSlotCell,
} from '../data/gradeChineseTimetable'
import {
  DEFAULT_TIMETABLE_ACADEMIC_YEAR_START,
  lessonHighlight,
  listTimetableAcademicYearStarts,
  weekdayLabel,
  type SchoolWeekday,
} from '../data/teacherTimetable'

const WEEKDAYS: SchoolWeekday[] = [1, 2, 3, 4, 5]

function cellKey(day: SchoolWeekday, start: string) {
  return `${day}-${start}`
}

function LessonCard({
  lesson,
  grade,
}: {
  lesson: GradeSlotCell['lessons'][number]
  grade: GradeLevel
}) {
  const subject = lesson.subject.trim().toUpperCase()
  const group =
    subject === 'EC'
      ? `G${grade} EC`
      : subject === 'CHIN-R'
        ? `G${grade}R`
        : (lesson.classes[0] ?? lesson.group)
  const hl = lessonHighlight(group, lesson.subject)
  return (
    <li
      className="class-tt-lesson"
      style={
        {
          '--tt-accent': hl.accent,
          '--tt-soft': hl.soft,
          '--tt-text': hl.text,
        } as CSSProperties
      }
    >
      <span className="class-tt-lesson-classes">
        {lessonCellClassLabel(lesson, grade)}
      </span>
      <span className="class-tt-lesson-meta">
        <span className="class-tt-lesson-subject">{lesson.subject}</span>
        {lesson.room ? (
          <span className="class-tt-lesson-room">{lesson.room}</span>
        ) : null}
        <span className="class-tt-lesson-teacher">{lesson.teacherInitial}</span>
      </span>
    </li>
  )
}

function GridCell({
  cell,
  grade,
}: {
  cell: GradeSlotCell | undefined
  grade: GradeLevel
}) {
  if (!cell) return null

  if (cell.isCommonFree) {
    return (
      <span
        className="class-tt-cell-free"
        title="任教本級中文的老師均為空堂（EC 老師可不出席）"
      >
        共同空堂
      </span>
    )
  }

  if (cell.lessons.length === 0) {
    return <span className="class-tt-cell-empty" aria-hidden>—</span>
  }

  return (
    <ul className="class-tt-lessons">
      {cell.lessons.map((lesson) => (
        <LessonCard
          key={`${lesson.teacherId}-${lesson.group}-${lesson.subject}-${lesson.room}`}
          lesson={lesson}
          grade={grade}
        />
      ))}
    </ul>
  )
}

export function ClassTimetablePage() {
  const yearOptions = useMemo(() => listTimetableAcademicYearStarts(), [])
  const defaultStart = DEFAULT_TIMETABLE_ACADEMIC_YEAR_START
  const [startYear, setStartYear] = useState(defaultStart)
  const [grade, setGrade] = useState<GradeLevel>(7)
  const yearLabel = academicYearLabelForGradeTimetable(startYear)

  const pairs = useMemo(
    () => listGradeClassTeacherPairs(grade, startYear),
    [grade, startYear],
  )
  const commonFreeTeachers = useMemo(
    () => listGradeCommonFreeTeachers(grade, startYear),
    [grade, startYear],
  )
  const grid = useMemo(
    () => getGradeSlotGrid(grade, startYear),
    [grade, startYear],
  )
  const commonFreeCount = useMemo(
    () => listCommonFreeSlots(grade, startYear).length,
    [grade, startYear],
  )

  const cellMap = useMemo(() => {
    const map = new Map<string, GradeSlotCell>()
    for (const cell of grid) {
      map.set(cellKey(cell.day, cell.start), cell)
    }
    return map
  }, [grid])

  return (
    <div className="page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>班級時間表</h1>
          <p>
            {yearLabel} 學年 · 依年級檢視中文課時分佈；共同空堂為任教本級中文的老師均為空堂之時段（EC
            老師可不出席）。
          </p>
        </div>
        <ScoresYearSelect
          id="class-timetable-academic-year"
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={setStartYear}
        />
      </header>

      <GlassPanel className="class-tt reveal-up delay-1">
        <div className="class-tt-grades" role="tablist" aria-label="年級">
          {GRADE_LEVELS.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={grade === g}
              className={`class-tt-grade${grade === g ? ' active' : ''}`}
              onClick={() => setGrade(g)}
            >
              {gradeLabel(g)}
            </button>
          ))}
        </div>

        <div className="class-tt-summary">
          <div className="class-tt-summary-block">
            <p className="class-tt-summary-heading">本級班別 · 任教老師</p>
            {pairs.length > 0 ? (
              <ul className="class-tt-roster">
                {pairs.map((p) => (
                  <li key={p.classCode} className="class-tt-roster-chip">
                    <span className="class-tt-roster-class">
                      {classDisplayLabel(p.classCode)}
                    </span>
                    <span className="class-tt-roster-teacher">
                      {p.teacherInitial ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="class-tt-summary-empty">尚未匯入</p>
            )}
          </div>
          <p className="class-tt-summary-line">
            <span className="class-tt-summary-label">共同空堂</span>
            <span className="class-tt-summary-count">
              每週 {commonFreeCount} 節（
              {commonFreeTeachers.map((t) => t.initial).join(' · ') || '—'}
              均為空堂；不含 EC）
            </span>
          </p>
        </div>

        <section
          className="class-tt-section"
          aria-label={`${gradeLabel(grade)} 中文課時分佈`}
        >
          <h2 className="class-tt-section-title">中文課時分佈</h2>
          <div className="class-tt-grid-wrap">
            <table className="class-tt-grid">
              <thead>
                <tr>
                  <th scope="col" className="class-tt-period-head">
                    節次
                  </th>
                  <th scope="col" className="class-tt-time-head">
                    時間
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col" className="class-tt-day-head">
                      {weekdayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LESSON_SLOTS.map((slot, periodIndex) => (
                  <tr key={slot.start}>
                    <th scope="row" className="class-tt-period-col">
                      {periodIndex + 1}
                    </th>
                    <th scope="row" className="class-tt-time-col">
                      <span className="class-tt-time-start">{slot.start}</span>
                      <span className="class-tt-time-end">{slot.end}</span>
                    </th>
                    {WEEKDAYS.map((day) => {
                      const cell = cellMap.get(cellKey(day, slot.start))
                      const tone = cell?.isCommonFree
                        ? 'free'
                        : cell && cell.lessons.length > 0
                          ? 'busy'
                          : 'empty'
                      return (
                        <td key={day} className={`class-tt-td ${tone}`}>
                          <GridCell cell={cell} grade={grade} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </GlassPanel>
    </div>
  )
}
