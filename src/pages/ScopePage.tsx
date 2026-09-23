/**
 * 測考範圍 — information architecture
 *
 * User question:「某學期、某卷別，各級考哪些篇章？」
 * Path: 學期 → 卷別 →（可選）年級 → 單元／篇章列表
 *
 * Display fields
 * - Primary: 單元、篇章名
 * - Secondary: 教授學期（何時教過，輔助判斷新／舊篇）
 * - Hidden here: 分數分配、review_count、cohort 學年欄（出卷／後台用，非查範圍主線）
 *
 * Layout: one filter bar + one result panel（避免上／下學期雙欄同時展開造成掃讀負擔）
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
  paper2: '卷二（寫作）— 暫無篇章式範圍',
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
    <details className="exam-scope-grade-details" open={defaultOpen}>
      <summary className="exam-scope-grade-summary">
        <span className="exam-scope-grade-chevron" aria-hidden="true" />
        <h2>{section.gradeLabel}</h2>
        <span className="exam-scope-grade-meta">{count} 篇</span>
        {section.note ? (
          <span className="exam-scope-grade-note">{section.note}</span>
        ) : null}
      </summary>
      <div className="exam-scope-grade-body">
        {section.units.map((unit) => (
          <div key={unit.unit} className="exam-scope-unit">
            <h3>{unit.unit}</h3>
            <ul className="exam-scope-title-list">
              {unit.titles.map((item) => (
                <li key={item.title}>
                  <span className="exam-scope-title">
                    {formatTitle(item.title)}
                  </span>
                  <span className="exam-scope-taught">
                    {item.firstTaughtFormTerm}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
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
        <p>查閱高中指定篇章：先選學期與卷別，再按年級展開列表。</p>
      </header>

      <GlassPanel className="exam-scope-panel reveal-up delay-1">
        <div className="exam-scope-filters">
          <div className="exam-scope-filter-row">
            <span className="exam-scope-filter-label" id="exam-scope-sem-label">
              學期
            </span>
            <div
              className="exam-scope-seg"
              role="tablist"
              aria-labelledby="exam-scope-sem-label"
            >
              {SEMESTERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={semester === key}
                  className={`exam-scope-seg-btn${semester === key ? ' active' : ''}`}
                  onClick={() => setSemester(key)}
                >
                  {EXAM_SCOPE_SEMESTER_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="exam-scope-filter-row">
            <span className="exam-scope-filter-label" id="exam-scope-paper-label">
              卷別
            </span>
            <div
              className="exam-scope-seg"
              role="tablist"
              aria-labelledby="exam-scope-paper-label"
            >
              {PAPERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={paper === key}
                  className={`exam-scope-seg-btn${paper === key ? ' active' : ''}`}
                  onClick={() => setPaper(key)}
                >
                  {EXAM_SCOPE_PAPER_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="exam-scope-filter-row">
            <span className="exam-scope-filter-label" id="exam-scope-grade-label">
              年級
            </span>
            <div
              className="exam-scope-seg exam-scope-seg-grades"
              role="tablist"
              aria-labelledby="exam-scope-grade-label"
            >
              {GRADES.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={grade === key}
                  className={`exam-scope-seg-btn${grade === key ? ' active' : ''}`}
                  onClick={() => setGrade(key)}
                >
                  {key === 'all' ? '全部' : EXAM_SCOPE_GRADE_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="exam-scope-result-head">
          <p className="exam-scope-selection-label">{selectionLabel}</p>
          <p className="exam-scope-selection-hint">{PAPER_HINT[paper]}</p>
          {paper !== 'paper2' && sections.length > 0 ? (
            <p className="exam-scope-result-count">共 {totalTitles} 篇</p>
          ) : null}
        </div>

        <div className="exam-scope-result" role="tabpanel">
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
            <div className="exam-scope-grade-list">
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
  )
}
