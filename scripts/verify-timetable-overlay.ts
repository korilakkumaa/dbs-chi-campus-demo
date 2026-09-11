import {
  seedTimetablesForYear,
  setTeacherTimetableOverlay,
  teacherTimetableEntry,
  weeklyTimetablesForYear,
} from '../src/data/teacherTimetable'
import { parseTimetableCsv, timetablesToCsv } from '../src/lib/yearCsv/schemas'
import { getGradeSlotGrid } from '../src/data/gradeChineseTimetable'

const seed = seedTimetablesForYear(2026)
const id = Object.keys(seed)[0]
if (!id) throw new Error('no 2026 seed teachers')

const csv = timetablesToCsv(seed)
const parsed = parseTimetableCsv(csv, 2026)
if (!parsed.ok) {
  console.error(parsed.issues.slice(0, 5))
  throw new Error('CSV roundtrip failed')
}
if (Object.keys(parsed.data).length !== Object.keys(seed).length) {
  throw new Error('teacher count mismatch after CSV roundtrip')
}

const edited = structuredClone(parsed.data)
const mon = edited[id].weekly[1]
const lesson = mon.find((p) => p.type === 'lesson')
if (!lesson || lesson.type !== 'lesson') throw new Error('expected a Monday lesson')
lesson.subject = 'EDITED-CHIN'
setTeacherTimetableOverlay(2026, edited)

const overlayLesson = teacherTimetableEntry(id, 2026)?.weekly[1].find(
  (p) => p.type === 'lesson',
)
if (!overlayLesson || overlayLesson.type !== 'lesson') {
  throw new Error('overlay lesson missing')
}
if (overlayLesson.subject !== 'EDITED-CHIN') {
  throw new Error(`overlay not applied: ${overlayLesson.subject}`)
}

const grid = getGradeSlotGrid(7, 2026)
if (!grid.length) throw new Error('class timetable grid empty')

console.log(
  JSON.stringify(
    {
      ok: true,
      teachers: Object.keys(weeklyTimetablesForYear(2026)).length,
      sampleTeacher: id,
      overlaySubject: overlayLesson.subject,
      classGridSlots: grid.length,
      csvRows: parsed.previewRows.length,
    },
    null,
    2,
  ),
)
