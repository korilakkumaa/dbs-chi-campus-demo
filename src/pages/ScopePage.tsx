import { useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { AsyncStatus } from '../components/AsyncStatus'
import {
  EXAM_SCOPE_PAPER_LABELS,
  EXAM_SCOPE_SEMESTER_LABELS,
  getPaper1ExamScopeSections,
  type ExamScopeGradeSection,
  type ExamScopePaper,
  type ExamScopeSemester,
} from '../data/paper1ExamScope'

const PAPERS: ExamScopePaper[] = ['test', 'paper1', 'paper2']
const SEMESTERS: ExamScopeSemester[] = ['first', 'second']

function formatTitle(title: string) {
  return `《${title}》`
}

function ScopeSections({ sections }: { sections: ExamScopeGradeSection[] }) {
  if (!sections.length) {
    return (
      <AsyncStatus
        variant="empty"
        panel={false}
        message="此卷別暫未提供考核範圍。"
      />
    )
  }

  return (
    <div className="exam-scope-grades">
      {sections.map((section) => (
        <section key={section.grade} className="exam-scope-grade">
          <header className="exam-scope-grade-head">
            <h3>{section.gradeLabel}</h3>
            {section.note ? (
              <span className="exam-scope-grade-note">{section.note}</span>
            ) : null}
          </header>
          <div className="exam-scope-units">
            {section.units.map((unit) => (
              <div key={unit.unit} className="exam-scope-unit">
                <h4>{unit.unit}</h4>
                <ul>
                  {unit.titles.map((item) => (
                    <li key={item.title}>
                      <span className="exam-scope-title">
                        {formatTitle(item.title)}
                      </span>
                      {item.scoreScheme ? (
                        <span className="exam-scope-scheme">
                          {item.scoreScheme}
                        </span>
                      ) : null}
                      <span className="exam-scope-taught">
                        {item.firstTaughtFormTerm}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SemesterCard({ semester }: { semester: ExamScopeSemester }) {
  const [paper, setPaper] = useState<ExamScopePaper>('test')
  const sections = getPaper1ExamScopeSections(semester, paper)
  const paperLabel = EXAM_SCOPE_PAPER_LABELS[paper]
  const panelId = `exam-scope-${semester}-panel`

  return (
    <GlassPanel className="exam-scope-card" as="section">
      <header className="exam-scope-card-head">
        <h2>{EXAM_SCOPE_SEMESTER_LABELS[semester]}</h2>
        <p>選擇卷別以查看高中甲部指定篇章考核範圍。</p>
      </header>

      <div
        className="exam-scope-paper-tabs"
        role="tablist"
        aria-label={`${EXAM_SCOPE_SEMESTER_LABELS[semester]}卷別`}
      >
        {PAPERS.map((key) => {
          const selected = paper === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`exam-scope-${semester}-${key}`}
              aria-selected={selected}
              aria-controls={panelId}
              className={`exam-scope-paper-tab${selected ? ' active' : ''}`}
              onClick={() => setPaper(key)}
            >
              {EXAM_SCOPE_PAPER_LABELS[key]}
            </button>
          )
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`exam-scope-${semester}-${paper}`}
        className="exam-scope-card-body"
      >
        <p className="exam-scope-selection-label">
          {EXAM_SCOPE_SEMESTER_LABELS[semester]} · {paperLabel}
          {paper === 'paper1' ? '（甲部）' : null}
        </p>
        <ScopeSections sections={sections} />
      </div>
    </GlassPanel>
  )
}

export function ScopePage() {
  return (
    <div className="page exam-scope-page">
      <header className="page-header reveal-up">
        <h1>測考範圍</h1>
        <p>對照高中卷一甲部指定篇章，按上／下學期與統測、卷一、卷二查看考核範圍。</p>
      </header>

      <div className="exam-scope-cards reveal-up delay-1">
        {SEMESTERS.map((semester) => (
          <SemesterCard key={semester} semester={semester} />
        ))}
      </div>
    </div>
  )
}
