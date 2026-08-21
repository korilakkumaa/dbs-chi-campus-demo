import { useMemo, useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import {
  GRADE_LEVELS,
  gradeLabel,
} from '../data/teacherWhitelist'
import {
  LESSON_SLOTS,
  academicYearLabelForGradeTimetable,
  classDisplayLabel,
  getGradeSlotGrid,
  listCommonFreeSlots,
  listGradeClassTeacherPairs,
  listGradeCommonFreeTeachers,
  type GradeLevel,
  type GradeSlotCell,
} from '../data/gradeChineseTimetable'
import {
  weekdayLabel,
  type SchoolWeekday,
} from '../data/teacherTimetable'

const WEEKDAYS: SchoolWeekday[] = [1, 2, 3, 4, 5]

function cellKey(day: SchoolWeekday, start: string) {
  return `${day}-${start}`
}

function SlotCell({ cell }: { cell: GradeSlotCell }) {
  if (cell.isCommonFree) {
    return (
      <div
        className="class-tt-cell free"
        title="任教本級中文的老師均為空堂（EC 老師可不出席）"
      >
        <span className="class-tt-cell-free">共同空堂</span>
      </div>
    )
  }

  if (cell.lessons.length === 0) {
    return <div className="class-tt-cell empty" aria-hidden />
  }

  return (
    <div className="class-tt-cell busy">
      <ul className="class-tt-lessons">
        {cell.lessons.map((lesson) => (
          <li
            key={`${lesson.teacherId}-${lesson.group}-${lesson.subject}-${lesson.room}`}
            className="class-tt-lesson"
          >
            <span className="class-tt-lesson-classes">
              {lesson.classes.map(classDisplayLabel).join(' · ')}
            </span>
            <span className="class-tt-lesson-meta">
              {lesson.subject}
              {lesson.room ? ` · ${lesson.room}` : ''}
              {` · ${lesson.teacherInitial}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ClassTimetablePage() {
  const [grade, setGrade] = useState<GradeLevel>(7)
  const yearLabel = academicYearLabelForGradeTimetable()

  const pairs = useMemo(() => listGradeClassTeacherPairs(grade), [grade])
  const commonFreeTeachers = useMemo(
    () => listGradeCommonFreeTeachers(grade),
    [grade],
  )
  const grid = useMemo(() => getGradeSlotGrid(grade), [grade])
  const commonFreeCount = useMemo(
    () => listCommonFreeSlots(grade).length,
    [grade],
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
      <header className="page-header reveal-up">
        <h1>班級時間表</h1>
        <p>
          {yearLabel} 學年 · 依年級檢視中文課時分佈；共同空堂為任教本級中文的老師均為空堂之時段（EC
          老師可不出席）。
        </p>
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
          <p className="class-tt-summary-line">
            <span className="class-tt-summary-label">本級班別</span>
            <span className="class-tt-summary-classes">
              {pairs.length > 0
                ? pairs.map((p) => classDisplayLabel(p.classCode)).join(' · ')
                : '尚未匯入'}
            </span>
          </p>
          <p className="class-tt-summary-line">
            <span className="class-tt-summary-label">任教老師</span>
            <span className="class-tt-summary-classes">
              {pairs.length > 0
                ? pairs.map((p) => p.teacherInitial ?? '—').join(' · ')
                : '尚未匯入'}
            </span>
          </p>
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
                  <th scope="col" className="class-tt-corner">
                    節次
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col">
                      {weekdayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LESSON_SLOTS.map((slot) => (
                  <tr key={slot.start}>
                    <th scope="row" className="class-tt-time-col">
                      <span className="class-tt-time-start">{slot.start}</span>
                      <span className="class-tt-time-end">{slot.end}</span>
                    </th>
                    {WEEKDAYS.map((day) => {
                      const cell = cellMap.get(cellKey(day, slot.start))
                      return (
                        <td
                          key={day}
                          className={
                            cell?.isCommonFree
                              ? 'class-tt-td free'
                              : 'class-tt-td busy'
                          }
                        >
                          {cell ? <SlotCell cell={cell} /> : null}
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
