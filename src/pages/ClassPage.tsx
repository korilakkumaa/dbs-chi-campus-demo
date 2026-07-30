import { useNavigate } from 'react-router-dom'
import { average } from '../data/mockData'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'

export function ClassPage() {
  const navigate = useNavigate()
  const {
    selectedClassIds,
    accessibleClasses,
    students,
    getClassName,
    getTeacherNamesForClass,
  } = useCampus()

  const active =
    selectedClassIds.length > 0
      ? accessibleClasses.filter((c) => selectedClassIds.includes(c.id))
      : accessibleClasses

  const openStudent = (studentId: string) => {
    navigate(`/class/individual?student=${encodeURIComponent(studentId)}`)
  }

  return (
    <div className="page class-page">
      <header className="page-header reveal-up">
        <h1>班級</h1>
        <p>並排檢視已選班級的概況。點擊成長條可開啟個人檔案。</p>
      </header>

      <div className="class-grid">
        {active.map((cls, i) => {
          const roster = students.filter((s) => s.classId === cls.id)
          const avgP = average(roster.map((s) => s.progress))
          const avgR = average(roster.map((s) => s.readingScore))
          const avgA = average(roster.map((s) => s.correctRate))
          return (
            <GlassPanel
              key={cls.id}
              className={`class-snapshot reveal-up delay-${Math.min(i + 1, 3)}`}
            >
              <div className="snapshot-head">
                <h2>{cls.name}</h2>
                <p>{cls.grade}</p>
              </div>
              <p className="snapshot-teacher">
                {getTeacherNamesForClass(cls.id)}
              </p>
              <dl className="snapshot-stats">
                <div>
                  <dt>人數</dt>
                  <dd>{roster.length}</dd>
                </div>
                <div>
                  <dt>進度</dt>
                  <dd>{avgP}%</dd>
                </div>
                <div>
                  <dt>閱讀</dt>
                  <dd>{avgR}%</dd>
                </div>
                <div>
                  <dt>答對率</dt>
                  <dd>{avgA}%</dd>
                </div>
              </dl>
              <div className="spark-row">
                {roster.slice(0, 12).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="spark"
                    style={{ height: `${Math.max(18, s.progress * 0.7)}%` }}
                    data-tip={`${s.name}：${s.progress}%`}
                    aria-label={`開啟 ${s.name} 的個人檔案，進度 ${s.progress}%`}
                    onClick={() => openStudent(s.id)}
                  />
                ))}
              </div>
              <p className="snapshot-foot">
                顯示{getClassName(cls.id)}的成長長條 · 點擊開啟個人頁
              </p>
            </GlassPanel>
          )
        })}
        {active.length === 0 && (
          <GlassPanel className="empty-panel">
            <p>請於上方選擇一個或多個班級以查看概況。</p>
          </GlassPanel>
        )}
      </div>
    </div>
  )
}
