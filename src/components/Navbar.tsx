import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import crest from '../assets/dbs-crest.png'

const navItems = [
  { to: '/progress', label: '進度' },
  {
    to: '/class',
    label: '班級',
    children: [
      { to: '/class', label: '班級' },
      { to: '/class/individual', label: '個人' },
    ],
  },
  { to: '/reading', label: '閱讀' },
  { to: '/overview', label: '總覽' },
]

function teacherDisplayName(name?: string, role?: string) {
  if (!name) return ''
  if (role === 'admin') return name
  return name.endsWith('老師') ? name : `${name}老師`
}

function ClassButtons() {
  const { accessibleClasses, selectedClassIds, toggleClass } = useCampus()

  if (accessibleClasses.length === 0) {
    return <p className="empty-note">尚未獲分配班級。</p>
  }

  return (
    <div className="class-buttons" role="group" aria-label="選擇班級">
      {accessibleClasses.map((cls) => {
        const on = selectedClassIds.includes(cls.id)
        return (
          <button
            key={cls.id}
            type="button"
            className={`class-btn${on ? ' selected' : ''}`}
            aria-pressed={on}
            onClick={() => toggleClass(cls.id)}
          >
            <span>{cls.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function StudentSearch() {
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
      className={`search-block nav-search${q ? ' has-query' : ''}`}
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

export function Navbar({
  toolsOpen = false,
  onToggleTools,
}: {
  toolsOpen?: boolean
  onToggleTools?: () => void
}) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [classOpen, setClassOpen] = useState(false)
  const menuRef = useRef<HTMLLIElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const linksRef = useRef<HTMLUListElement>(null)
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    visible: false,
  })

  const moveIndicatorTo = (el: Element | null) => {
    const list = linksRef.current
    const wrap = list?.parentElement
    if (!wrap || !list || !(el instanceof HTMLElement)) {
      setIndicator((prev) => ({ ...prev, visible: false }))
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setIndicator({
      left: elRect.left - wrapRect.left,
      width: elRect.width,
      visible: true,
    })
  }

  const syncIndicatorToActive = () => {
    const list = linksRef.current
    if (!list) return
    moveIndicatorTo(
      list.querySelector('.nav-link.active, .branch-trigger.active'),
    )
  }

  const openClassMenu = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setClassOpen(true)
  }

  const scheduleCloseClassMenu = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setClassOpen(false)
      closeTimerRef.current = null
    }, 160)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setClassOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    setClassOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncIndicatorToActive)
    const onResize = () => syncIndicatorToActive()
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [location.pathname, user?.role])

  return (
    <nav className={`top-nav glass${classOpen ? ' branch-open' : ''}`}>
      <div className="brand-block">
        <button
          type="button"
          className={`brand-crest-btn${toolsOpen ? ' active' : ''}`}
          aria-expanded={toolsOpen}
          aria-controls="tools-sidebar"
          title="常用連結"
          onClick={onToggleTools}
        >
          <img className="brand-crest" src={crest} alt="" aria-hidden />
          <span className="sr-only">
            {toolsOpen ? '關閉常用連結' : '開啟常用連結'}
          </span>
        </button>
        <div>
          <p className="brand-name">拔萃男書院中國語文科</p>
          <p className="brand-sub">
            {teacherDisplayName(user?.name, user?.role)}
          </p>
        </div>
      </div>

      <div
        className="nav-links-wrap"
        onMouseLeave={syncIndicatorToActive}
      >
        <ul className="nav-links" ref={linksRef}>
          {navItems.map((item) =>
            item.children ? (
              <li
                key={item.label}
                className="nav-item has-branch"
                ref={menuRef}
                onMouseEnter={(e) => {
                  openClassMenu()
                  moveIndicatorTo(
                    e.currentTarget.querySelector('.branch-trigger'),
                  )
                }}
                onMouseLeave={scheduleCloseClassMenu}
              >
                <button
                  type="button"
                  className={`nav-link branch-trigger${
                    location.pathname.startsWith('/class') ? ' active' : ''
                  }`}
                  aria-expanded={classOpen}
                  onClick={() => {
                    if (closeTimerRef.current != null) {
                      window.clearTimeout(closeTimerRef.current)
                      closeTimerRef.current = null
                    }
                    setClassOpen((o) => !o)
                  }}
                  onFocus={openClassMenu}
                >
                  {item.label}
                  <span className="caret" aria-hidden />
                </button>
                {classOpen && (
                  <div className="branch-menu glass">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === '/class'}
                        className={({ isActive }) =>
                          `branch-link${isActive ? ' active' : ''}`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </li>
            ) : (
              <li
                key={item.to}
                onMouseEnter={(e) => {
                  moveIndicatorTo(e.currentTarget.querySelector('.nav-link'))
                }}
              >
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ),
          )}
          {user?.role === 'admin' && (
            <li
              onMouseEnter={(e) => {
                moveIndicatorTo(e.currentTarget.querySelector('.nav-link'))
              }}
            >
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                分派
              </NavLink>
            </li>
          )}
        </ul>
        <span
          className={`nav-indicator${indicator.visible ? ' ready' : ''}`}
          style={{
            transform: `translate3d(${indicator.left}px, 0, 0)`,
            width: indicator.width,
          }}
          aria-hidden
        />
      </div>

      <div className="nav-user">
        <StudentSearch />
        <ClassButtons />
        <button
          type="button"
          className="logout-btn"
          onClick={logout}
          aria-label="登出"
          title="登出"
        >
          <span className="logout-sign">
            <svg viewBox="0 0 512 512" aria-hidden>
              <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
            </svg>
          </span>
        </button>
      </div>
    </nav>
  )
}

