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
import { useMemo, useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { AsyncStatus } from '../components/AsyncStatus'
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

const SEMESTERS: ExamScopeSemester[] = ['first', 'second']
const PAPERS: ExamScopePaper[] = ['test', 'paper1', 'paper2']
const GRADES: Array<ExamScopeGrade | 'all'> = ['all', 'f4', 'f5', 'f6']

const PAPER_HINT: Record<ExamScopePaper, string> = {
  test: '階段性統測指定篇章',
  paper1: '卷一甲部（閱讀）指定篇章',
  paper2: '卷二（寫作）暫無篇章式範圍',
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
  const [semester, setSemester] = useState<ExamScopeSemester>('first')
  const [paper, setPaper] = useState<ExamScopePaper>('test')
  const [grade, setGrade] = useState<ExamScopeGrade | 'all'>('all')

  const sections = useMemo(() => {
    const all = getPaper1ExamScopeSections(semester, paper)
    if (grade === 'all') return all
    return all.filter((s) => s.grade === grade)
  }, [semester, paper, grade])

  const totalTitles = sections.reduce((n, s) => n + countTitles(s), 0)
  const selectionLabel = `${EXAM_SCOPE_SEMESTER_LABELS[semester]} · ${EXAM_SCOPE_PAPER_LABELS[paper]}${paper === 'paper1' ? '（甲部）' : ''}`

  return (
    <div className="page exam-scope-page">
      <header className="page-header reveal-up">
        <h1>測考範圍</h1>
        <p>高中指定篇章 · 依學期與卷別查閱</p>
      </header>

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
    </div>
  )
}
