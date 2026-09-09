import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GlassPanel } from '../GlassPanel'
import { formatAcademicYearLabel } from '../../data/academicYear'
import {
  assessmentDutyYearStatus,
  discoverAssessmentDutyYears,
  peekAssessmentDuty,
} from '../../data/dutyStore'
import { papersDutyPath } from '../../data/papersDutyLinks'

export function AdminPapersDutyStatus({ startYear }: { startYear: number }) {
  const yearLabel = formatAcademicYearLabel(startYear)
  const [dutyKnownYears, setDutyKnownYears] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    void discoverAssessmentDutyYears().then((years) => {
      if (!cancelled) setDutyKnownYears(years)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const papersStatus = useMemo(() => {
    const status = assessmentDutyYearStatus(startYear)
    const peek = peekAssessmentDuty(startYear)
    const known =
      status.known || dutyKnownYears.includes(startYear) || Boolean(peek)
    return {
      known,
      hasSeed: status.hasSeed,
      label: peek?.label ?? formatAcademicYearLabel(startYear),
      teacherCount: peek?.teachers.length ?? 0,
    }
  }, [startYear, dutyKnownYears])

  return (
    <GlassPanel className="table-panel admin-papers-panel reveal-up delay-1">
      <div className="table-panel-head">
        <h2>出卷分工</h2>
        <div className="deadline-admin-actions">
          {papersStatus.known ? (
            <>
              <Link
                className="deadline-select-all-btn"
                to={papersDutyPath({ year: startYear })}
              >
                前往出卷
              </Link>
              <Link
                className="deadline-submit-btn"
                to={papersDutyPath({ year: startYear, edit: true })}
              >
                編輯出卷
              </Link>
            </>
          ) : (
            <Link
              className="deadline-submit-btn"
              to={papersDutyPath({ year: startYear, edit: true })}
            >
              建立／編輯出卷
            </Link>
          )}
        </div>
      </div>
      <p className="deadline-admin-lead">
        出卷矩陣與 EC 附錄在「出卷」頁編輯並寫入 Supabase；此處提供管理入口。種子檔僅作尚未儲存時的後備，遠端資料優先。
      </p>
      <dl className="admin-papers-status">
        <div>
          <dt>學年</dt>
          <dd>{yearLabel}</dd>
        </div>
        <div>
          <dt>狀態</dt>
          <dd>
            {papersStatus.known
              ? papersStatus.hasSeed
                ? '已有資料（含種子或遠端）'
                : '已有資料'
              : '尚未建立'}
          </dd>
        </div>
        <div>
          <dt>教師筆數</dt>
          <dd>{papersStatus.known ? papersStatus.teacherCount : '—'}</dd>
        </div>
      </dl>
    </GlassPanel>
  )
}
