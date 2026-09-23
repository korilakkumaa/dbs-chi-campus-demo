/**
 * 測考範圍 — layout + visual plan
 *
 * IA: 學期 → 卷別 →（可選）年級 → 單元／篇章
 *
 * Visual (why it felt crowded)
 * - One GlassPanel held filters + result + nested bordered accordions + row hairlines
 * - Three equal-weight filter rows competed with content
 * - Titles, unit heads, and meta shared similar size / contrast
 *
 * Visual rules for this pass
 * 1. Two zones: slim filter dock (controls) + reading sheet (content)
 * 2. Hierarchy by type & space, not nested boxes — drop accordion chrome borders
 * 3. Vertical rhythm: generous gaps between grade / unit; no per-row rules
 * 4. Type: 篇章 = primary; 單元 = quiet label; 教授學期 = whisper meta
 * 5. Motion: soft accordion / filter transitions only（presence, not noise）
 *
 * Fields: 單元、篇章名（primary）；教授學期（secondary, deduped on unit）
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GlassPanel } from '../components/GlassPanel'
import { AsyncStatus } from '../components/AsyncStatus'
import { CsvYearImportPanel } from '../components/admin/CsvYearImportPanel'
import { ScoresYearSelect } from '../components/ScoresYearSelect'
import { useAuth } from '../context/AuthContext'
import {
  defaultAcademicYearStart,
  formatAcademicYearLabel,
  listAcademicYearStarts,
} from '../data/academicYear'
import {
  hydrateExamScope,
  invalidateExamScope,
} from '../data/examScopeStore'
import {
  EXAM_SCOPE_GRADE_LABELS,
  EXAM_SCOPE_PAPER_LABELS,
  EXAM_SCOPE_SEMESTER_LABELS,
  getPaper1ExamScopeSections,
  type ExamScopeGrade,
  type ExamScopeGradeSection,
  type ExamScopePaper,
  type ExamScopeSemester,
} from '../data/paper1ExamScope'
import { useExamScope } from '../hooks/useExamScope'
import { applyYearCsvImport } from '../lib/adminYearImport'
import { examScopeToCsv, parseExamScopeCsv } from '../lib/yearCsv/schemas'

const SEMESTERS: ExamScopeSemester[] = ['first', 'second']
const PAPERS: ExamScopePaper[] = ['test', 'paper1', 'paper2']
const GRADES: Array<ExamScopeGrade | 'all'> = ['all', 'f4', 'f5', 'f6']

const PAPER_HINT: Record<ExamScopePaper, string> = {
  test: '階段性統測指定篇章',
  paper1: '卷一甲部（閱讀）指定篇章',
  paper2: '卷二（寫作）暫無篇章式範圍',
}

function parseYearParam(raw: string | null, fallback: number): number {
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : fallback
}

function formatTitle(title: string) {
  return `《${title}》`
}

function countTitles(section: ExamScopeGradeSection) {
  return section.units.reduce((n, u) => n + u.titles.length, 0)
}

function ScopeGradeBlock({
  section,
  defaultOpen,
}: {
  section: ExamScopeGradeSection
  defaultOpen: boolean
}) {
  const count = countTitles(section)
  return (
    <details className="exam-scope-grade" open={defaultOpen}>
      <summary className="exam-scope-grade-summary">
        <span className="exam-scope-grade-chevron" aria-hidden="true" />
        <span className="exam-scope-grade-name">{section.gradeLabel}</span>
        <span className="exam-scope-grade-meta">{count} 篇</span>
        {section.note ? (
          <span className="exam-scope-grade-note">{section.note}</span>
        ) : null}
      </summary>
      <div className="exam-scope-grade-body">
        {section.units.map((unit) => {
          const taughtTerms = [
            ...new Set(unit.titles.map((t) => t.firstTaughtFormTerm)),
          ]
          const sharedTaught =
            taughtTerms.length === 1 ? taughtTerms[0] : null
          return (
            <section key={unit.unit} className="exam-scope-unit">
              <header className="exam-scope-unit-head">
                <h3>{unit.unit}</h3>
                {sharedTaught ? (
                  <span className="exam-scope-taught">{sharedTaught}</span>
                ) : null}
              </header>
              <ul className="exam-scope-titles">
                {unit.titles.map((item) => (
                  <li key={item.title}>
                    <span className="exam-scope-title">
                      {formatTitle(item.title)}
                    </span>
                    {!sharedTaught ? (
                      <span className="exam-scope-taught">
                        {item.firstTaughtFormTerm}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </details>
  )
}

function SegControl<T extends string>({
  label,
  labelId,
  options,
  value,
  onChange,
  getLabel,
}: {
  label: string
  labelId: string
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  getLabel: (key: T) => string
}) {
  return (
    <div className="exam-scope-control">
      <span className="exam-scope-control-label" id={labelId}>
        {label}
      </span>
      <div
        className="exam-scope-seg"
        role="tablist"
        aria-labelledby={labelId}
      >
        {options.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            className={`exam-scope-seg-btn${value === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            {getLabel(key)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ScopePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultStart = defaultAcademicYearStart()
  const initialYear = parseYearParam(searchParams.get('year'), defaultStart)

  const [startYear, setStartYear] = useState(initialYear)
  const [semester, setSemester] = useState<ExamScopeSemester>('first')
  const [paper, setPaper] = useState<ExamScopePaper>('test')
  const [grade, setGrade] = useState<ExamScopeGrade | 'all'>('all')

  const { isAdmin, doc, loading, knownYears } = useExamScope(startYear, user)

  const yearParam = searchParams.get('year')
  useEffect(() => {
    const fromUrl = parseYearParam(yearParam, defaultStart)
    setStartYear((prev) => (fromUrl !== prev ? fromUrl : prev))
  }, [yearParam, defaultStart])

  const academicYears = listAcademicYearStarts()
  const yearOptions = useMemo(() => {
    const base = knownYears.length ? knownYears : [startYear]
    return [...new Set([...academicYears, ...base, startYear])].sort(
      (a, b) => b - a,
    )
  }, [academicYears, knownYears, startYear])

  const syncYearToUrl = (y: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('year', String(y))
    setSearchParams(next, { replace: true })
  }

  const onSelectYear = (y: number) => {
    setStartYear(y)
    syncYearToUrl(y)
  }

  const sections = useMemo(() => {
    const all = getPaper1ExamScopeSections(semester, paper, doc.rows)
    if (grade === 'all') return all
    return all.filter((s) => s.grade === grade)
  }, [semester, paper, grade, doc.rows])

  const totalTitles = sections.reduce((n, s) => n + countTitles(s), 0)
  const selectionLabel = `${EXAM_SCOPE_SEMESTER_LABELS[semester]} · ${EXAM_SCOPE_PAPER_LABELS[paper]}${paper === 'paper1' ? '（甲部）' : ''}`

  return (
    <div className="page exam-scope-page">
      <header className="page-header year-ov-header reveal-up">
        <div className="year-ov-header-text">
          <h1>測考範圍</h1>
          <p>高中指定篇章 · 依學期與卷別查閱</p>
        </div>
        <ScoresYearSelect
          id="scope-academic-year"
          startYear={startYear}
          defaultStart={defaultStart}
          yearOptions={yearOptions}
          onSelectYear={onSelectYear}
        />
      </header>

      {isAdmin && user ? (
        <div className="papers-csv-slot reveal-up delay-1">
          <CsvYearImportPanel
            kind="exam_scope"
            startYear={startYear}
            variant="page"
            statusText={`${doc.rows.length} 列篇章`}
            statusTone={doc.rows.length > 0 ? 'ready' : 'empty'}
            description={`下載範本或匯出 ${formatAcademicYearLabel(startYear)} 測考範圍，離線修改後上傳；成功寫入後會重新載入，其他老師即可看到更新。`}
            exportCsv={examScopeToCsv(doc)}
            onParseAndImport={async ({ text }) => {
              const base = await hydrateExamScope(startYear)
              const parsed = parseExamScopeCsv(text, startYear, base)
              if (!parsed.ok) {
                return {
                  ok: false,
                  issues: parsed.issues,
                  previewRows: parsed.previewRows,
                }
              }
              const result = await applyYearCsvImport({
                kind: 'exam_scope',
                startYear,
                userEmail: user.username,
                userId: user.id,
                examScope: parsed.data,
              })
              if (result.ok) {
                invalidateExamScope(startYear)
                window.location.reload()
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
      ) : null}

      {loading ? (
        <AsyncStatus variant="loading" message="載入測考範圍中…" />
      ) : (
      <div className="exam-scope-layout reveal-up delay-1">
        <GlassPanel className="exam-scope-dock" as="section">
          <div className="exam-scope-dock-row">
            <SegControl
              label="學期"
              labelId="exam-scope-sem-label"
              options={SEMESTERS}
              value={semester}
              onChange={setSemester}
              getLabel={(k) => EXAM_SCOPE_SEMESTER_LABELS[k]}
            />
            <SegControl
              label="卷別"
              labelId="exam-scope-paper-label"
              options={PAPERS}
              value={paper}
              onChange={setPaper}
              getLabel={(k) => EXAM_SCOPE_PAPER_LABELS[k]}
            />
          </div>
        </GlassPanel>

        <GlassPanel className="exam-scope-sheet" as="section">
          <header className="exam-scope-sheet-head">
            <div className="exam-scope-sheet-title-block">
              <h2 className="exam-scope-sheet-title">{selectionLabel}</h2>
              <p className="exam-scope-sheet-hint">{PAPER_HINT[paper]}</p>
            </div>
            {paper !== 'paper2' && sections.length > 0 ? (
              <p className="exam-scope-sheet-count">{totalTitles} 篇</p>
            ) : null}
          </header>

          <div className="exam-scope-grade-filter">
            <span className="exam-scope-control-label" id="exam-scope-grade-label">
              年級
            </span>
            <div
              className="exam-scope-chips"
              role="tablist"
              aria-labelledby="exam-scope-grade-label"
            >
              {GRADES.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={grade === key}
                  className={`exam-scope-chip${grade === key ? ' active' : ''}`}
                  onClick={() => setGrade(key)}
                >
                  {key === 'all' ? '全部' : EXAM_SCOPE_GRADE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="exam-scope-sheet-body" role="tabpanel">
            {paper === 'paper2' || sections.length === 0 ? (
              <AsyncStatus
                variant="empty"
                panel={false}
                message={
                  paper === 'paper2'
                    ? '卷二暫未提供篇章式考核範圍。'
                    : '此篩選條件下沒有篇章。'
                }
              />
            ) : (
              <div className="exam-scope-grades">
                {sections.map((section, index) => (
                  <ScopeGradeBlock
                    key={section.grade}
                    section={section}
                    defaultOpen={grade !== 'all' || index === 0}
                  />
                ))}
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
      )}
    </div>
  )
}
