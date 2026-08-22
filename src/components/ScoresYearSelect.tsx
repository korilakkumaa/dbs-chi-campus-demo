import { formatAcademicYearLabel } from '../data/academicYear'

type ScoresYearSelectProps = {
  startYear: number
  defaultStart: number
  yearOptions: number[]
  onSelectYear: (year: number) => void
  id?: string
}

export function ScoresYearSelect({
  startYear,
  defaultStart,
  yearOptions,
  onSelectYear,
  id = 'scores-academic-year',
}: ScoresYearSelectProps) {
  return (
    <label className="year-ov-select-wrap" htmlFor={id}>
      <span className="year-ov-select-label">學年</span>
      <select
        id={id}
        className="year-ov-select"
        value={startYear}
        onChange={(e) => onSelectYear(Number(e.target.value))}
        aria-label="選擇學年"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {formatAcademicYearLabel(y)}
            {y === defaultStart ? '（目前）' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
