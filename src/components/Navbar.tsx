import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCampus } from '../context/CampusContext'
import {
  gradeLabel,
  gradeNumberFromClassName,
} from '../data/teacherWhitelist'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
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

function ClassSelectSwitch({
  allSelected,
  onChange,
}: {
  allSelected: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`class-select-switch${allSelected ? ' on' : ''}`}
      role="switch"
      aria-checked={allSelected}
      aria-label={allSelected ? '清除全部班級' : '全選班級'}
      title={allSelected ? '清除' : '全選'}
      onClick={() => onChange(!allSelected)}
    >
      <span className="class-select-switch-label" aria-hidden>
        全
      </span>
      <span className="class-select-switch-track" aria-hidden>
        <span className="class-select-switch-thumb" />
      </span>
    </button>
  )
}

function ClassButtons() {
  const { user } = useAuth()
  const { accessibleClasses, selectedClassIds, toggleClass, selectClasses } =
    useCampus()
  const [expandedGrade, setExpandedGrade] = useState<number | null>(null)
  const [panelGrade, setPanelGrade] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const grades = useMemo(() => {
    const map = new Map<number, typeof accessibleClasses>()
    for (const cls of accessibleClasses) {
      const g = gradeNumberFromClassName(cls.name)
      if (g == null) continue
      const list = map.get(g)
      if (list) list.push(cls)
      else map.set(g, [cls])
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [accessibleClasses])

  const panelClasses =
    panelGrade == null
      ? []
      : (grades.find(([g]) => g === panelGrade)?.[1] ?? [])
  const panelGradeLabel = panelGrade == null ? '' : gradeLabel(panelGrade)

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openGradePanel = (grade: number, classIds: string[]) => {
    clearCloseTimer()
    setExpandedGrade(grade)
    setPanelGrade(grade)
    selectClasses(classIds)
    window.requestAnimationFrame(() => setPanelOpen(true))
  }

  const closeGradePanel = () => {
    setExpandedGrade(null)
    setPanelOpen(false)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setPanelGrade(null)
      closeTimerRef.current = null
    }, 280)
  }

  useEffect(() => {
    setExpandedGrade(null)
    setPanelGrade(null)
    setPanelOpen(false)
    clearCloseTimer()
  }, [user?.id])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [])

  if (accessibleClasses.length === 0) {
    return <p className="empty-note">尚未獲分配班級。</p>
  }

  /* Admin sees every class — collapse behind grade buttons first. */
  if (user?.role === 'admin') {
    return (
      <div className="class-picker" role="group" aria-label="選擇班級">
        <div className="class-buttons grade-buttons" role="group" aria-label="選擇級別">
          {grades.map(([grade, classesInGrade]) => {
            const expanded = expandedGrade === grade
            const gradeIds = classesInGrade.map((c) => c.id)
            const allSelected = gradeIds.every((id) =>
              selectedClassIds.includes(id),
            )
            const anySelected = gradeIds.some((id) =>
              selectedClassIds.includes(id),
            )
            return (
              <button
                key={grade}
                type="button"
                className={`class-btn grade-btn${expanded ? ' expanded' : ''}${allSelected ? ' selected' : anySelected ? ' partial' : ''}`}
                aria-pressed={allSelected}
                aria-expanded={expanded}
                onClick={() => {
                  if (expanded) {
                    closeGradePanel()
                    return
                  }
                  openGradePanel(grade, gradeIds)
                }}
              >
                <span>{gradeLabel(grade)}</span>
              </button>
            )
          })}
        </div>
        <div
          className={`class-picker-dropdown${panelOpen ? ' open' : ''}`}
          aria-hidden={!panelOpen}
        >
          <div className="class-picker-dropdown-inner">
            {panelClasses.length > 0 && (
              <div className="class-buttons-bar">
                <div
                  className="class-buttons class-buttons-row"
                  role="group"
                  aria-label={`${panelGradeLabel} 班級`}
                >
                  {panelClasses.map((cls) => {
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
                <ClassSelectSwitch
                  allSelected={panelClasses.every((c) =>
                    selectedClassIds.includes(c.id),
                  )}
                  onChange={(next) =>
                    selectClasses(
                      next ? panelClasses.map((c) => c.id) : [],
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="class-buttons-bar">
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
      <ClassSelectSwitch
        allSelected={
          accessibleClasses.length > 0 &&
          accessibleClasses.every((c) => selectedClassIds.includes(c.id))
        }
        onChange={(next) =>
          selectClasses(
            next ? accessibleClasses.map((c) => c.id) : [],
          )
        }
      />
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

