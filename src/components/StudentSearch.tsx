import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCampus } from '../context/CampusContext'
import { officialStudentNo } from '../data/campusScoresYear'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

export function StudentSearch() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { searchQuery, setSearchQuery, filteredStudents, getClassName } =
    useCampus()
  const [activeIndex, setActiveIndex] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)
  const bootstrapped = useRef(false)

  const q = searchQuery.trim()
  const visibleResults = q ? filteredStudents.slice(0, 6) : []
  const showPanel = panelOpen && Boolean(q)

  // One effect: adopt ?q= on first mount, then mirror the box into the URL.
  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true
      const fromUrl = searchParams.get('q') ?? ''
      if (fromUrl && fromUrl !== searchQuery) {
        setSearchQuery(fromUrl)
        setPanelOpen(true)
        return
      }
    }
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        const cur = p.get('q') ?? ''
        if (searchQuery === cur) return prev
        if (searchQuery.trim()) p.set('q', searchQuery)
        else p.delete('q')
        return p
      },
      { replace: true },
    )
    // searchParams read only for initial hydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, setSearchParams, setSearchQuery])

  useEffect(() => {
    setActiveIndex(0)
  }, [searchQuery])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!blockRef.current?.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const openStudent = (studentId: string) => {
    setSearchQuery('')
    setPanelOpen(false)
    setActiveIndex(0)
    navigate(`/class/individual?student=${encodeURIComponent(studentId)}`)
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (showPanel) {
        setPanelOpen(false)
        return
      }
      if (searchQuery) setSearchQuery('')
      return
    }

    if (!q || visibleResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPanelOpen(true)
      setActiveIndex((i) => (i + 1) % visibleResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPanelOpen(true)
      setActiveIndex(
        (i) => (i - 1 + visibleResults.length) % visibleResults.length,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = visibleResults[activeIndex]
      if (selected) openStudent(selected.id)
    }
  }

  const resultMeta = (s: (typeof filteredStudents)[number]) => {
    const classSeat = `${getClassName(s.classId)}${String(s.classNumber).padStart(2, '0')}`
    const stid = officialStudentNo(s.id)
    const parts = [classSeat, stid]
    if (s.nameEn?.trim()) parts.push(s.nameEn.trim())
    return parts.join(' · ')
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
          aria-expanded={showPanel}
          aria-controls="student-search-results"
          aria-activedescendant={
            showPanel && visibleResults[activeIndex]
              ? `search-option-${visibleResults[activeIndex].id}`
              : undefined
          }
          aria-autocomplete="list"
          placeholder="姓名、班別、座號、學號"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPanelOpen(true)
          }}
          onFocus={() => {
            if (q) setPanelOpen(true)
          }}
          onKeyDown={onSearchKeyDown}
        />
        {q && (
          <button
            type="button"
            className="search-clear"
            aria-label="清除搜尋"
            onClick={() => {
              setSearchQuery('')
              setPanelOpen(false)
              searchRef.current?.focus()
            }}
          >
            ×
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {q ? `${filteredStudents.length} 項結果` : ''}
      </p>
      {showPanel && (
        <div
          id="student-search-results"
          className="search-results"
          role="listbox"
          aria-label="搜尋結果"
        >
          <p className="search-count">{filteredStudents.length} 項結果</p>
          {visibleResults.length === 0 ? (
            <p className="search-empty">
              沒有符合的學生。試：7A12、陳、學號
            </p>
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
                <span className="search-result-meta">{resultMeta(s)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
