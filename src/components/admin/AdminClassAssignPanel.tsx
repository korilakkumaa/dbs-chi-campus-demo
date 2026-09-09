import { GlassPanel } from '../GlassPanel'
import { formatAcademicYearLabel } from '../../data/academicYear'
import type { SchoolClass, Student, User } from '../../types'

type TeacherCard = {
  teacher: User
  owned: SchoolClass[]
}

type Props = {
  yearClasses: SchoolClass[]
  yearTeachers: User[]
  teacherCards: TeacherCard[]
  students: Student[]
  canAssignClasses: boolean
  scoresAcademicYearStart: number
  assignClassToTeacher: (classId: string, teacherId: string | null) => void
}

export function AdminClassAssignPanel({
  yearClasses,
  yearTeachers,
  teacherCards,
  students,
  canAssignClasses,
  scoresAcademicYearStart,
  assignClassToTeacher,
}: Props) {
  return (
    <div className="admin-layout reveal-up delay-2">
      <GlassPanel className="table-panel">
        <h2>班級分派</h2>
        {!canAssignClasses && (
          <p className="deadline-admin-lead">
            此學年任教班別依白名單顯示；班級教師下拉僅在成績學年（
            {formatAcademicYearLabel(scoresAcademicYearStart)}）可改。
          </p>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>班級</th>
                <th>年級</th>
                <th>學生人數</th>
                <th>教師</th>
              </tr>
            </thead>
            <tbody>
              {yearClasses.map((cls) => {
                const rosterCount = canAssignClasses
                  ? students.filter((s) => s.classId === cls.id).length
                  : null
                const teacherName =
                  yearTeachers.find((t) => t.id === cls.teacherId)?.name ??
                  '未分派'
                return (
                  <tr key={cls.id}>
                    <td>{cls.name}</td>
                    <td>{cls.grade}</td>
                    <td>{rosterCount == null ? '—' : rosterCount}</td>
                    <td>
                      {canAssignClasses ? (
                        <select
                          className="assign-select"
                          value={cls.teacherId ?? ''}
                          onChange={(e) =>
                            assignClassToTeacher(
                              cls.id,
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">未分派</option>
                          {yearTeachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        teacherName
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <GlassPanel className="teacher-roll">
        <h2>教師名單</h2>
        <ul className="teacher-list">
          {teacherCards.map(({ teacher: t, owned }) => (
            <li key={t.id}>
              <div className="teacher-card-head">
                <p className="teacher-name">{t.name}</p>
                <p className="teacher-meta">{owned.length} 班</p>
              </div>
              {owned.length === 0 ? (
                <p className="teacher-classes">尚未分派班級</p>
              ) : (
                <div className="teacher-class-buttons">
                  {owned.map((c) => (
                    <span key={c.id} className="class-btn selected static">
                      <span>{c.name}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="teacher-handle">{t.username}</p>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  )
}
