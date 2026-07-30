import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { GRADE_LEVELS, gradeLabel } from '../data/teacherWhitelist'

export function AdminPage() {
  const { user } = useAuth()
  const {
    classes,
    teachers,
    students,
    assignClassToTeacher,
    gradeDeadlines,
    updateGradeDeadline,
  } = useCampus()

  if (user?.role !== 'admin') return <Navigate to="/progress" replace />

  const teacherCards = teachers.map((t) => {
    const owned = classes.filter(
      (c) => c.teacherId === t.id || t.classIds.includes(c.id),
    )
    return { teacher: t, owned }
  })

  return (
    <div className="page admin-page">
      <header className="page-header reveal-up">
        <h1>分派</h1>
        <p>將班級分配予教師；亦可為各年級統一設定截止日期。</p>
      </header>

      <div className="metric-row reveal-up delay-1">
        <GlassPanel className="metric">
          <p className="metric-label">教師人數</p>
          <p className="metric-value">{teachers.length}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">任教多班</p>
          <p className="metric-value">
            {teacherCards.filter((t) => t.owned.length > 1).length}
          </p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">班級總數</p>
          <p className="metric-value">{classes.length}</p>
        </GlassPanel>
      </div>

      <GlassPanel className="table-panel deadline-admin reveal-up delay-1">
        <h2>年級截止日期</h2>
        <p className="deadline-admin-lead">
          為每級統一設定閱讀報告與活動截止日期；教師進度頁會依其任教年級顯示提醒。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>年級</th>
                <th>閱讀報告截止</th>
                <th>活動名稱</th>
                <th>活動截止</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_LEVELS.map((grade) => {
                const row =
                  gradeDeadlines.find((d) => d.grade === grade) ?? {
                    grade,
                    readingDue: '',
                    activityTitle: '',
                    activityDue: '',
                  }
                return (
                  <tr key={grade}>
                    <td>{gradeLabel(grade)}</td>
                    <td>
                      <input
                        type="date"
                        className="deadline-input"
                        value={row.readingDue}
                        onChange={(e) =>
                          updateGradeDeadline(grade, {
                            readingDue: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="deadline-input text"
                        placeholder="例如：書展參觀"
                        value={row.activityTitle}
                        onChange={(e) =>
                          updateGradeDeadline(grade, {
                            activityTitle: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="deadline-input"
                        value={row.activityDue}
                        onChange={(e) =>
                          updateGradeDeadline(grade, {
                            activityDue: e.target.value,
                          })
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <div className="admin-layout reveal-up delay-2">
        <GlassPanel className="table-panel">
          <h2>班級分派</h2>
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
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td>{cls.name}</td>
                    <td>{cls.grade}</td>
                    <td>
                      {students.filter((s) => s.classId === cls.id).length}
                    </td>
                    <td>
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
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
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
                <p className="teacher-handle">@{t.username}</p>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
    </div>
  )
}
