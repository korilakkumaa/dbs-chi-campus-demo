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

type NavChild = {
  to: string
  label: string
  end?: boolean
}

type NavItem = {
  to: string
  label: string
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { to: '/progress', label: '首頁' },
  {
    to: '/calendar',
    label: '日曆',
    children: [
      { to: '/calendar', label: '詳細日曆', end: true },
      { to: '/calendar/year', label: '全年概覽' },
    ],
  },
  {
    to: '/timetable',
    label: '時間表',
    children: [
      { to: '/timetable', label: '個人', end: true },
      { to: '/timetable/class', label: '班級' },
      { to: '/timetable/school', label: '全校' },
    ],
  },
  {
    to: '/class',
    label: '分數',
    children: [
      { to: '/class', label: '班級', end: true },
      { to: '/class/individual', label: '個人' },
    ],
  },
  {
    to: '/resources',
    label: '其他資料',
    children: [
      { to: '/resources/papers', label: '出卷' },
      { to: '/resources/scope', label: '測考範圍' },
      { to: '/reading', label: '廣泛閱讀' },
    ],
  },
]

function childIsActive(pathname: string, child: NavChild) {
  if (child.end) return pathname === child.to
  return pathname === child.to || pathname.startsWith(`${child.to}/`)
}

function itemIsActive(pathname: string, item: NavItem) {
  if (item.children?.length) {
    return item.children.some((child) => childIsActive(pathname, child))
  }
  return pathname === item.to
}

function teacherDisplayName(name?: string, role?: string) {
  if (!name) return ''
  if (role === 'admin' || role === 'student') return name
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

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="logout-btn"
      onClick={onClick}
      aria-label="登出"
      title="登出"
    >
      <span className="logout-sign">
        <svg viewBox="0 0 512 512" aria-hidden>
          <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
        </svg>
      </span>
    </button>
  )
}

function StudentNav({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <nav className="top-nav glass student-nav">
      <div className="brand-block">
        <img className="brand-crest" src={crest} alt="" aria-hidden />
        <div>
          <p className="brand-name">拔萃男書院中國語文科</p>
          <p className="brand-sub">{name}</p>
        </div>
      </div>
      <div className="nav-links-wrap">
        <ul className="nav-links">
          <li>
            <NavLink
              to="/tower"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              勇者之塔
            </NavLink>
          </li>
        </ul>
      </div>
      <div className="nav-user">
        <LogoutButton onClick={onLogout} />
      </div>
    </nav>
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
  if (user?.role === 'student') {
    return <StudentNav name={user.name} onLogout={logout} />
  }
  return (
    <StaffNavbar toolsOpen={toolsOpen} onToggleTools={onToggleTools} />
  )
}

function StaffNavbar({
  toolsOpen = false,
  onToggleTools,
}: {
  toolsOpen?: boolean
  onToggleTools?: () => void
}) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
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

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openBranchMenu = (id: string) => {
    clearCloseTimer()
    setOpenMenu(id)
  }

  const scheduleCloseBranchMenu = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null)
      closeTimerRef.current = null
    }, 160)
  }

  useEffect(() => {
    return () => clearCloseTimer()
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!linksRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    setOpenMenu(null)
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
    <nav className={`top-nav glass${openMenu ? ' branch-open' : ''}`}>
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
                onMouseEnter={(e) => {
                  openBranchMenu(item.label)
                  moveIndicatorTo(
                    e.currentTarget.querySelector('.branch-trigger'),
                  )
                }}
                onMouseLeave={scheduleCloseBranchMenu}
              >
                <button
                  type="button"
                  className={`nav-link branch-trigger${
                    itemIsActive(location.pathname, item) ? ' active' : ''
                  }`}
                  aria-expanded={openMenu === item.label}
                  onClick={() => {
                    clearCloseTimer()
                    setOpenMenu((cur) =>
                      cur === item.label ? null : item.label,
                    )
                  }}
                  onFocus={() => openBranchMenu(item.label)}
                >
                  {item.label}
                  <span className="caret" aria-hidden />
                </button>
                {openMenu === item.label && (
                  <div
                    className="branch-menu glass"
                    onMouseEnter={() => openBranchMenu(item.label)}
                  >
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) =>
                          `branch-link${isActive ? ' active' : ''}`
                        }
                        onMouseDown={(e) => e.stopPropagation()}
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
        <LogoutButton onClick={logout} />
      </div>
    </nav>
  )
}

