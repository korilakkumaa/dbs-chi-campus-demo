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
} from '../lib/yearCsv/schemas'
import { applyYearCsvImport } from '../lib/adminYearImport'
import {
  hydrateAssessmentDuty,
  hydrateDeptDuty,
  peekAssessmentDuty,
  peekDeptDuty,
} from '../data/dutyStore'
import { invalidateAssessmentDuty, invalidateDeptDuty } from '../data/dutyStore'
import { supabase } from '../lib/supabase'
import type { WhitelistTeacher } from '../data/teacherWhitelist'

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
  const [status, setStatus] = useState<YearStatus | null>(null)
  const [assignMessage, setAssignMessage] = useState<string | null>(null)

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

  return (
    <div className="page admin-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>新學年準備</h1>
          <p>
            {yearLabel}學年 · 以 CSV 範本更新白名單、名冊、分組、校曆與其他資料；檢查清單顯示目前狀態（
            {yearRange.from} 至 {yearRange.to}）。
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

      <div className="metric-row reveal-up delay-1">
        <GlassPanel className="metric">
          <p className="metric-label">教師人數</p>
          <p className="metric-value">{status?.whitelistCount ?? yearTeachers.length}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">名冊人數</p>
          <p className="metric-value">{status?.rosterCount ?? '—'}</p>
        </GlassPanel>
        <GlassPanel className="metric">
          <p className="metric-label">分組覆蓋</p>
          <p className="metric-value">
            {status?.streamingCoverage == null ? '—' : `${status.streamingCoverage}%`}
          </p>
        </GlassPanel>
      </div>

      <GlassPanel className="admin-year-checklist reveal-up delay-1">
        <h2>學年檢查清單</h2>
        <ul className="admin-checklist">
          <li>
            教師白名單：{status?.whitelistCount ?? 0} 人
          </li>
          <li>
            學生名單：{status?.rosterCount ?? 0} 人
          </li>
          <li>
            中文分組：
            {status?.streamingCoverage == null
              ? '尚無名冊'
              : `${status.streamingCoverage}% 已有 teaching_group`}
          </li>
          <li>
            校曆事件（資料庫）：{status?.calendarCount ?? '—'}
          </li>
          <li>
            出卷文件：{status?.hasAssessment ? '已有' : '未建立'}{' '}
            <Link to="/resources/papers">開啟出卷</Link>
          </li>
          <li>
            職責文件：{status?.hasDept ? '已有' : '未建立'}{' '}
            <Link to="/resources/duties">開啟職責</Link>
          </li>
          <li>
            學期成績列：{status?.scoreCount ?? '—'}
          </li>
          <li>
            截止日期：{status?.deadlinesSaved ? '已存檔' : '尚未寫入資料庫'}
          </li>
          <li className="admin-checklist-note">
            個人／班級時間表仍需本機執行 <code>npm run generate:timetables</code>
          </li>
        </ul>
      </GlassPanel>

      <CsvYearImportPanel
        kind="teacher_whitelist"
        startYear={startYear}
        exportCsv={whitelistToCsv(whitelist)}
        replaceModeDefault
        onParseAndImport={async ({ text }) => {
          const parsed = parseWhitelistCsv(text)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
        onParseAndImport={async ({ text }) => {
          const parsed = parseRosterCsv(text, startYear)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
        onParseAndImport={async ({ text }) => {
          const parsed = parseStreamingCsv(text, startYear)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
        onParseAndImport={async ({ text, replaceMode }) => {
          const parsed = parseCalendarCsv(text)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
        kind="semester_scores"
        startYear={startYear}
        onParseAndImport={async ({ text }) => {
          const parsed = parseScoresCsv(text, startYear)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
        kind="assessment_duty"
        startYear={startYear}
        exportCsv={
          peekAssessmentDuty(startYear)
            ? assessmentDutyToCsv(peekAssessmentDuty(startYear)!)
            : null
        }
        onParseAndImport={async ({ text }) => {
          const base = await hydrateAssessmentDuty(startYear)
          const parsed = parseAssessmentDutyCsv(text, startYear, base)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
          peekDeptDuty(startYear) ? deptDutyToCsv(peekDeptDuty(startYear)!) : null
        }
        onParseAndImport={async ({ text }) => {
          const base = await hydrateDeptDuty(startYear)
          const parsed = parseDeptDutyCsv(text, startYear, base)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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
        kind="grade_deadlines"
        startYear={startYear}
        exportCsv={deadlinesToCsv(gradeDeadlines)}
        onParseAndImport={async ({ text }) => {
          const parsed = parseDeadlinesCsv(text)
          if (!parsed.ok) {
            return { ok: false, issues: parsed.issues, previewRows: parsed.previewRows }
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

      {assignMessage && <p className="csv-year-import-msg">{assignMessage}</p>}

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
    </div>
  )
}
