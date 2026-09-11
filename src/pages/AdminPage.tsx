import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { defaultPath, useAuth } from '../context/AuthContext'
import { canAccessAdminConsole } from '../lib/permissions'
import { useCampus } from '../context/CampusContext'
import { GlassPanel } from '../components/GlassPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { AdminCalendarBatchPanel } from '../components/admin/AdminCalendarBatchPanel'
import { AdminClassAssignPanel } from '../components/admin/AdminClassAssignPanel'
import { AdminDeadlinesPanel } from '../components/admin/AdminDeadlinesPanel'
import { AdminPapersDutyStatus } from '../components/admin/AdminPapersDutyStatus'
import { CsvYearImportPanel } from '../components/admin/CsvYearImportPanel'
import { isoDateLocal, SCHOOL_CALENDAR_YEARS } from '../data/calendarEvents'
import {
  academicYearDateRange,
  formatAcademicYearLabel,
} from '../data/academicYear'
import { buildSchoolClasses } from '../data/schoolClasses'
import { teachersForYear } from '../data/staffUsers'
import {
  classNameToId,
  latestTeacherWhitelistYear,
  teacherInitialFromUserId,
  teacherWhitelistYears,
} from '../data/teacherWhitelist'
import {
  assignClassInWhitelist,
  hydrateTeacherWhitelist,
  peekTeacherWhitelist,
  saveTeacherWhitelist,
} from '../data/whitelistStore'
import { whitelistToCsv, parseWhitelistCsv } from '../lib/yearCsv/schemas'
import { parseRosterCsv } from '../lib/yearCsv/schemas'
import { parseStreamingCsv } from '../lib/yearCsv/schemas'
import { parseCalendarCsv } from '../lib/yearCsv/schemas'
import { parseScoresCsv } from '../lib/yearCsv/schemas'
import { deadlinesToCsv, parseDeadlinesCsv } from '../lib/yearCsv/schemas'
import {
  assessmentDutyToCsv,
  parseAssessmentDutyCsv,
  deptDutyToCsv,
  parseDeptDutyCsv,
  timetablesToCsv,
  parseTimetableCsv,
} from '../lib/yearCsv/schemas'
import { applyYearCsvImport } from '../lib/adminYearImport'
import {
  hydrateAssessmentDuty,
  hydrateDeptDuty,
  peekAssessmentDuty,
  peekDeptDuty,
} from '../data/dutyStore'
import { invalidateAssessmentDuty, invalidateDeptDuty } from '../data/dutyStore'
import {
  hydrateTeacherTimetables,
  peekTeacherTimetables,
  publishSeedTimetables,
  saveTeacherTimetables,
} from '../data/timetableStore'
import { hasSeedTimetableYear } from '../data/teacherTimetable'
import { supabase } from '../lib/supabase'
import type { WhitelistTeacher } from '../data/teacherWhitelist'
import type { TimetableYearMap } from '../lib/yearCsv/schemas'

function listAdminYearStarts(): number[] {
  return [...new Set([...teacherWhitelistYears(), ...SCHOOL_CALENDAR_YEARS])].sort(
    (a, b) => b - a,
  )
}

function defaultDateForYear(startYear: number): string {
  const { from, to } = academicYearDateRange(startYear)
  const today = isoDateLocal()
  if (today >= from && today <= to) return today
  return from
}

type YearStatus = {
  whitelistCount: number
  rosterCount: number
  streamingCoverage: number | null
  calendarCount: number | null
  hasAssessment: boolean
  hasDept: boolean
  scoreCount: number | null
  deadlinesSaved: boolean
  timetableTeacherCount: number
}

type CheckTone = 'ready' | 'empty' | 'partial' | 'unknown'

type ChecklistItem = {
  id: string
  label: string
  detail: string
  tone: CheckTone
  href?: string
}

function toneFromCount(count: number | null | undefined, emptyIsUnknown = false): CheckTone {
  if (count == null) return emptyIsUnknown ? 'unknown' : 'empty'
  if (count <= 0) return 'empty'
  return 'ready'
}

function toneLabel(tone: CheckTone): string {
  if (tone === 'ready') return '已就緒'
  if (tone === 'partial') return '部分完成'
  if (tone === 'empty') return '尚未完成'
  return '載入中'
}

export function AdminPage() {
  const { user } = useAuth()
  const {
    students,
    gradeDeadlines,
    updateGradeDeadline,
    submitGradeDeadlines,
    addCalendarEventsBatch,
    scoresAcademicYearStart,
  } = useCampus()

  const yearOptions = useMemo(() => listAdminYearStarts(), [])
  const defaultStart = useMemo(() => latestTeacherWhitelistYear(), [])
  const [startYear, setStartYear] = useState(defaultStart)
  const [whitelist, setWhitelist] = useState<WhitelistTeacher[]>(() =>
    peekTeacherWhitelist(defaultStart),
  )
  const [timetables, setTimetables] = useState<TimetableYearMap>(() =>
    peekTeacherTimetables(defaultStart),
  )
  const [status, setStatus] = useState<YearStatus | null>(null)
  const [assignMessage, setAssignMessage] = useState<string | null>(null)
  const [timetableMessage, setTimetableMessage] = useState<string | null>(null)

  const yearRange = useMemo(
    () => academicYearDateRange(startYear),
    [startYear],
  )
  const yearLabel = formatAcademicYearLabel(startYear)
  const yearTeachers = useMemo(() => teachersForYear(startYear), [startYear, whitelist])
  const yearClasses = useMemo(() => {
    const catalog = buildSchoolClasses(startYear)
    const teacherByClass = new Map<string, string>()
    for (const t of whitelist) {
      for (const name of t.classes) {
        teacherByClass.set(classNameToId(name), `u-${t.initial.toLowerCase()}`)
      }
    }
    return catalog.map((cls) => ({
      ...cls,
      teacherId: teacherByClass.get(cls.id) ?? cls.teacherId,
    }))
  }, [startYear, whitelist])

  const refreshStatus = useCallback(async () => {
    const teachers = await hydrateTeacherWhitelist(startYear)
    setWhitelist(teachers)
    const yearTimetables = await hydrateTeacherTimetables(startYear)
    setTimetables(yearTimetables)
    const assessment = await hydrateAssessmentDuty(startYear)
    const dept = await hydrateDeptDuty(startYear)

    let rosterCount = 0
    let streamingWith = 0
    let scoreCount: number | null = null
    let calendarCount: number | null = null
    let deadlinesSaved = false

    if (supabase) {
      const { count: rc } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('academic_year_start', startYear)
      rosterCount = rc ?? 0

      const { count: sc } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('academic_year_start', startYear)
        .not('teaching_group', 'is', null)
      streamingWith = sc ?? 0

      const { count: scores } = await supabase
        .from('semester_records')
        .select('*', { count: 'exact', head: true })
        .eq('academic_year_start', startYear)
      scoreCount = scores ?? 0

      const { count: cal } = await supabase
        .from('campus_calendar_events')
        .select('*', { count: 'exact', head: true })
        .eq('school_year_start', startYear)
        .eq('deleted', false)
      calendarCount = cal ?? 0

      const { data: dl } = await supabase
        .from('grade_deadlines_years')
        .select('start_year')
        .eq('start_year', startYear)
        .maybeSingle()
      deadlinesSaved = Boolean(dl)
    }

    setStatus({
      whitelistCount: teachers.length,
      rosterCount,
      streamingCoverage:
        rosterCount > 0 ? Math.round((streamingWith / rosterCount) * 100) : null,
      calendarCount,
      hasAssessment: Boolean(assessment),
      hasDept: Boolean(dept),
      scoreCount,
      deadlinesSaved,
      timetableTeacherCount: Object.keys(yearTimetables).length,
    })
  }, [startYear])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  if (!canAccessAdminConsole(user)) {
    return <Navigate to={defaultPath(user?.role)} replace />
  }

  const teacherCards = yearTeachers.map((t) => {
    const owned = yearClasses.filter(
      (c) => c.teacherId === t.id || t.classIds.includes(c.id),
    )
    return { teacher: t, owned }
  })

  const importUser = {
    email: user!.username,
    id: user!.id,
  }

  const whitelistCount = status?.whitelistCount ?? yearTeachers.length
  const rosterCount = status?.rosterCount ?? 0
  const streamingTone: CheckTone =
    status?.streamingCoverage == null
      ? rosterCount > 0
        ? 'empty'
        : 'unknown'
      : status.streamingCoverage >= 90
        ? 'ready'
        : status.streamingCoverage > 0
          ? 'partial'
          : 'empty'

  const checklist: ChecklistItem[] = [
    {
      id: 'whitelist',
      label: '教師白名單',
      detail: `${whitelistCount} 人`,
      tone: toneFromCount(whitelistCount),
    },
    {
      id: 'roster',
      label: '學生名單',
      detail: `${rosterCount} 人`,
      tone: toneFromCount(status?.rosterCount, !supabase),
    },
    {
      id: 'streaming',
      label: '中文分組',
      detail:
        status?.streamingCoverage == null
          ? rosterCount > 0
            ? '尚無分組'
            : '尚無名冊'
          : `${status.streamingCoverage}% 已有 teaching_group`,
      tone: streamingTone,
    },
    {
      id: 'calendar',
      label: '校曆事件',
      detail:
        status?.calendarCount == null
          ? '—'
          : `${status.calendarCount} 筆`,
      tone: toneFromCount(status?.calendarCount, !supabase),
    },
    {
      id: 'assessment',
      label: '出卷文件',
      detail: status?.hasAssessment ? '已有資料' : '未建立',
      tone: status?.hasAssessment ? 'ready' : 'empty',
      href: '/resources/papers',
    },
    {
      id: 'dept',
      label: '職責文件',
      detail: status?.hasDept ? '已有資料' : '未建立',
      tone: status?.hasDept ? 'ready' : 'empty',
      href: '/resources/duties',
    },
    {
      id: 'scores',
      label: '學期成績',
      detail:
        status?.scoreCount == null ? '—' : `${status.scoreCount} 列`,
      tone: toneFromCount(status?.scoreCount, !supabase),
    },
    {
      id: 'deadlines',
      label: '截止日期',
      detail: status?.deadlinesSaved ? '已存檔' : '尚未寫入資料庫',
      tone: status?.deadlinesSaved ? 'ready' : 'empty',
    },
    {
      id: 'timetable',
      label: '時間表（個人／班級）',
      detail:
        (status?.timetableTeacherCount ?? Object.keys(timetables).length) > 0
          ? `${status?.timetableTeacherCount ?? Object.keys(timetables).length} 位教師 · 班級時間表由此衍生`
          : '尚未匯入',
      tone:
        (status?.timetableTeacherCount ?? Object.keys(timetables).length) > 0
          ? 'ready'
          : 'empty',
      href: '/timetable',
    },
  ]

  const readyCount = checklist.filter((item) => item.tone === 'ready').length
  const progressPct = Math.round((readyCount / checklist.length) * 100)

  const csvStatus = {
    teacher_whitelist: {
      text: `${whitelistCount} 人`,
      tone: toneFromCount(whitelistCount) as CheckTone,
    },
    student_roster: {
      text: `${rosterCount} 人`,
      tone: toneFromCount(status?.rosterCount, !supabase) as CheckTone,
    },
    chinese_streaming: {
      text:
        status?.streamingCoverage == null
          ? '—'
          : `${status.streamingCoverage}%`,
      tone: streamingTone,
    },
    school_calendar: {
      text:
        status?.calendarCount == null
          ? '—'
          : `${status.calendarCount} 筆`,
      tone: toneFromCount(status?.calendarCount, !supabase) as CheckTone,
    },
    semester_scores: {
      text:
        status?.scoreCount == null ? '—' : `${status.scoreCount} 列`,
      tone: toneFromCount(status?.scoreCount, !supabase) as CheckTone,
    },
    assessment_duty: {
      text: status?.hasAssessment ? '已有' : '未建立',
      tone: (status?.hasAssessment ? 'ready' : 'empty') as CheckTone,
    },
    dept_duty: {
      text: status?.hasDept ? '已有' : '未建立',
      tone: (status?.hasDept ? 'ready' : 'empty') as CheckTone,
    },
    grade_deadlines: {
      text: status?.deadlinesSaved ? '已存檔' : '未存檔',
      tone: (status?.deadlinesSaved ? 'ready' : 'empty') as CheckTone,
    },
    teacher_timetable: {
      text:
        (status?.timetableTeacherCount ?? Object.keys(timetables).length) > 0
          ? `${status?.timetableTeacherCount ?? Object.keys(timetables).length} 人`
          : '尚未匯入',
      tone: toneFromCount(
        status?.timetableTeacherCount ?? Object.keys(timetables).length,
      ) as CheckTone,
    },
  }

  return (
    <div className="page admin-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>新學年準備</h1>
          <p>
            {yearLabel}學年（{yearRange.from}–{yearRange.to}
            ）。依檢查清單完成匯入，或使用下方進階工具。
          </p>
        </div>
        <ScoresYearSelect
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={setStartYear}
          id="admin-academic-year"
        />
      </header>

      <GlassPanel className="table-panel admin-year-checklist reveal-up delay-1">
        <div className="table-panel-head admin-year-checklist-head">
          <div>
            <h2>學年檢查清單</h2>
            <p className="deadline-admin-lead admin-year-checklist-lead">
              {readyCount} / {checklist.length} 項就緒 · {progressPct}%
            </p>
          </div>
          <div
            className="admin-year-progress"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`準備進度 ${progressPct}%`}
          >
            <div
              className="admin-year-progress-bar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <ul className="admin-checklist">
          {checklist.map((item) => (
            <li
              key={item.id}
              className={`admin-checklist-item admin-checklist-item--${item.tone}`}
            >
              <span className="admin-checklist-mark" aria-hidden>
                {item.tone === 'ready' ? '✓' : item.tone === 'partial' ? '·' : '–'}
              </span>
              <div className="admin-checklist-body">
                <span className="admin-checklist-label">{item.label}</span>
                <span className="admin-checklist-detail">{item.detail}</span>
              </div>
              <span className="admin-checklist-tone">{toneLabel(item.tone)}</span>
              {item.href ? (
                <Link className="admin-checklist-link" to={item.href}>
                  開啟
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="admin-checklist-note">
          個人與班級時間表同源：管理員在下方 CSV 匯入或「發布本機種子」後，其他老師重新整理即可看到更新。
        </p>
      </GlassPanel>

      <GlassPanel className="table-panel admin-year-csv-panel reveal-up delay-1">
        <div className="table-panel-head">
          <h2>CSV 匯入</h2>
        </div>
        <p className="deadline-admin-lead">
          展開項目以下載範本、匯出或上傳。狀態與上方清單同步。
        </p>
        <div className="admin-year-csv-list">
          <CsvYearImportPanel
            kind="teacher_whitelist"
            startYear={startYear}
            exportCsv={whitelistToCsv(whitelist)}
            replaceModeDefault
            statusText={csvStatus.teacher_whitelist.text}
            statusTone={csvStatus.teacher_whitelist.tone}
            onParseAndImport={async ({ text }) => {
              const parsed = parseWhitelistCsv(text)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'teacher_whitelist',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                whitelist: parsed.data,
              })
              if (result.ok) {
                await saveTeacherWhitelist(startYear, parsed.data, importUser.id)
                await refreshStatus()
              }
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="student_roster"
            startYear={startYear}
            statusText={csvStatus.student_roster.text}
            statusTone={csvStatus.student_roster.tone}
            onParseAndImport={async ({ text }) => {
              const parsed = parseRosterCsv(text, startYear)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'student_roster',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                roster: parsed.data,
              })
              if (result.ok) await refreshStatus()
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="chinese_streaming"
            startYear={startYear}
            statusText={csvStatus.chinese_streaming.text}
            statusTone={csvStatus.chinese_streaming.tone}
            onParseAndImport={async ({ text }) => {
              const parsed = parseStreamingCsv(text, startYear)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'chinese_streaming',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                streaming: parsed.data,
              })
              if (result.ok) await refreshStatus()
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="school_calendar"
            startYear={startYear}
            replaceModeDefault
            statusText={csvStatus.school_calendar.text}
            statusTone={csvStatus.school_calendar.tone}
            onParseAndImport={async ({ text, replaceMode }) => {
              const parsed = parseCalendarCsv(text)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'school_calendar',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                replaceMode,
                calendar: parsed.data,
              })
              if (result.ok) await refreshStatus()
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="assessment_duty"
            startYear={startYear}
            exportCsv={
              peekAssessmentDuty(startYear)
                ? assessmentDutyToCsv(peekAssessmentDuty(startYear)!)
                : null
            }
            statusText={csvStatus.assessment_duty.text}
            statusTone={csvStatus.assessment_duty.tone}
            onParseAndImport={async ({ text }) => {
              const base = await hydrateAssessmentDuty(startYear)
              const parsed = parseAssessmentDutyCsv(text, startYear, base)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'assessment_duty',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                assessment: parsed.data,
              })
              if (result.ok) {
                invalidateAssessmentDuty(startYear)
                await refreshStatus()
              }
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="dept_duty"
            startYear={startYear}
            exportCsv={
              peekDeptDuty(startYear)
                ? deptDutyToCsv(peekDeptDuty(startYear)!)
                : null
            }
            statusText={csvStatus.dept_duty.text}
            statusTone={csvStatus.dept_duty.tone}
            onParseAndImport={async ({ text }) => {
              const base = await hydrateDeptDuty(startYear)
              const parsed = parseDeptDutyCsv(text, startYear, base)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'dept_duty',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                dept: parsed.data,
              })
              if (result.ok) {
                invalidateDeptDuty(startYear)
                await refreshStatus()
              }
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="semester_scores"
            startYear={startYear}
            statusText={csvStatus.semester_scores.text}
            statusTone={csvStatus.semester_scores.tone}
            onParseAndImport={async ({ text }) => {
              const parsed = parseScoresCsv(text, startYear)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'semester_scores',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                scores: parsed.data,
              })
              if (result.ok) await refreshStatus()
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="grade_deadlines"
            startYear={startYear}
            exportCsv={deadlinesToCsv(gradeDeadlines)}
            statusText={csvStatus.grade_deadlines.text}
            statusTone={csvStatus.grade_deadlines.tone}
            onParseAndImport={async ({ text }) => {
              const parsed = parseDeadlinesCsv(text)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'grade_deadlines',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                deadlines: parsed.data,
              })
              if (result.ok) {
                submitGradeDeadlines(parsed.data)
                await refreshStatus()
              }
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />

          <CsvYearImportPanel
            kind="teacher_timetable"
            startYear={startYear}
            exportCsv={
              Object.keys(timetables).length > 0
                ? timetablesToCsv(timetables)
                : null
            }
            replaceModeDefault
            statusText={csvStatus.teacher_timetable.text}
            statusTone={csvStatus.teacher_timetable.tone}
            description="匯出／上傳個人週課表。班級時間表（時間表→班級）會自動跟個人課表同步。亦可先「發布本機種子」再離線編輯。"
            onParseAndImport={async ({ text }) => {
              const parsed = parseTimetableCsv(text, startYear)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'teacher_timetable',
                startYear,
                userEmail: importUser.email,
                userId: importUser.id,
                timetables: parsed.data,
              })
              if (result.ok) {
                await saveTeacherTimetables(startYear, parsed.data, importUser.id)
                setTimetableMessage(
                  `已寫入 ${Object.keys(parsed.data).length} 位教師時間表（班級頁同步）`,
                )
                await refreshStatus()
              }
              return {
                ok: result.ok,
                issues: parsed.issues,
                previewRows: parsed.previewRows,
                upserted: result.upserted,
                message: result.error,
              }
            }}
          />
        </div>
        {hasSeedTimetableYear(startYear) ? (
          <div className="admin-year-csv-list" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="deadline-select-all-btn"
              onClick={() => {
                setTimetableMessage(null)
                void publishSeedTimetables(startYear, importUser.id).then(
                  (result) => {
                    if (!result.ok) {
                      setTimetableMessage(result.error ?? '發布種子失敗')
                      return
                    }
                    setTimetableMessage(
                      `已將本機種子發布至雲端（${result.teacherCount} 位教師）；其他老師重新整理後可見。`,
                    )
                    void refreshStatus()
                  },
                )
              }}
            >
              發布本機時間表種子至雲端
            </button>
            {timetableMessage ? (
              <p className="csv-year-import-msg" role="status">
                {timetableMessage}
              </p>
            ) : null}
          </div>
        ) : timetableMessage ? (
          <p className="csv-year-import-msg" role="status">
            {timetableMessage}
          </p>
        ) : null}
      </GlassPanel>

      <section className="admin-year-section reveal-up delay-2">
        <div className="admin-year-section-head">
          <h2>進階工具</h2>
          <p>出卷入口、批次校曆、截止日期編輯與班級分派。</p>
        </div>

        <AdminPapersDutyStatus startYear={startYear} />
        <AdminCalendarBatchPanel
          startYear={startYear}
          yearLabel={yearLabel}
          yearRange={yearRange}
          yearTeachers={yearTeachers}
          defaultDate={defaultDateForYear(startYear)}
          addCalendarEventsBatch={addCalendarEventsBatch}
        />

        <AdminDeadlinesPanel
          gradeDeadlines={gradeDeadlines}
          updateGradeDeadline={updateGradeDeadline}
          submitGradeDeadlines={submitGradeDeadlines}
        />

        {assignMessage && (
          <p className="csv-year-import-msg" role="status">
            {assignMessage}
          </p>
        )}

        <AdminClassAssignPanel
          yearClasses={yearClasses}
          yearTeachers={yearTeachers}
          teacherCards={teacherCards}
          students={startYear === scoresAcademicYearStart ? students : []}
          canAssignClasses
          scoresAcademicYearStart={scoresAcademicYearStart}
          assignClassToTeacher={(classId, teacherId) => {
            const cls = yearClasses.find((c) => c.id === classId)
            if (!cls) return
            const initial = teacherId
              ? teacherInitialFromUserId(teacherId)
              : null
            void assignClassInWhitelist(
              startYear,
              cls.name,
              initial,
              importUser.id,
            ).then((result) => {
              if (!result.ok) {
                setAssignMessage(result.error ?? '分派失敗')
                return
              }
              setWhitelist(result.teachers)
              setAssignMessage(`已更新 ${cls.name} 任教教師（已寫入白名單）`)
              void refreshStatus()
            })
          }}
        />
      </section>
    </div>
  )
}
