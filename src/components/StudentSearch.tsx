import { useNavigate } from 'react-router-dom'
import { useCampus } from '../context/CampusContext'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

export function StudentSearch() {
  const navigate = useNavigate()
  const { searchQuery, setSearchQuery, filteredStudents, getClassName } =
    useCampus()
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)

  const q = searchQuery.trim()
  const visibleResults = q ? filteredStudents.slice(0, 6) : []

  useEffect(() => {
    setActiveIndex(0)
  }, [searchQuery])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!blockRef.current?.contains(e.target as Node) && searchQuery) {
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [searchQuery, setSearchQuery])

  const openStudent = (studentId: string) => {
    setSearchQuery('')
    setActiveIndex(0)
    navigate(`/class/individual?student=${encodeURIComponent(studentId)}`)
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!q || visibleResults.length === 0) {
      if (e.key === 'Escape' && searchQuery) {
        e.preventDefault()
        setSearchQuery('')
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % visibleResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(
        (i) => (i - 1 + visibleResults.length) % visibleResults.length,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = visibleResults[activeIndex]
      if (selected) openStudent(selected.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSearchQuery('')
    }
  }

  return (
    <div
      ref={blockRef}
      className={`search-block shell-search${q ? ' has-query' : ''}`}
    >
      <label className="sr-only" htmlFor="student-search">
        搜尋學生
      </label>
      <div className="search-field">
        <svg
          className="search-glyph"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden
        >
          <circle
            cx="10.5"
            cy="10.5"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M15.5 15.5 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={searchRef}
          id="student-search"
          type="search"
          role="combobox"
          aria-expanded={Boolean(q)}
          aria-controls="student-search-results"
          aria-activedescendant={
            q && visibleResults[activeIndex]
              ? `search-option-${visibleResults[activeIndex].id}`
              : undefined
          }
          aria-autocomplete="list"
          placeholder="學生姓名、班別、學號"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        {q && (
          <button
            type="button"
            className="search-clear"
            aria-label="清除搜尋"
            onClick={() => {
              setSearchQuery('')
              searchRef.current?.focus()
            }}
          >
            ×
          </button>
        )}
      </div>
      {q && (
        <div
          id="student-search-results"
          className="search-results"
          role="listbox"
          aria-label="搜尋結果"
        >
          <p className="search-count">{filteredStudents.length} 項結果</p>
          {visibleResults.length === 0 ? (
            <p className="search-empty">沒有符合的學生</p>
          ) : (
            visibleResults.map((s, index) => (
              <button
                key={s.id}
                id={`search-option-${s.id}`}
                type="button"
                className={`search-result${index === activeIndex ? ' active' : ''}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => openStudent(s.id)}
              >
                <span className="search-result-name">{s.name}</span>
                <span className="search-result-meta">
                  {getClassName(s.classId)}
                  {String(s.classNumber).padStart(2, '0')}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
