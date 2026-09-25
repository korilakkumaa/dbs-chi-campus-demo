import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CampusProvider } from '../context/CampusContext'
import { NotificationsProvider } from '../context/NotificationsContext'
import { isStudent } from '../lib/permissions'
import { AuthBootScreen } from '../pages/LoginPage'
import { Navbar } from './Navbar'
import { StudentSearch } from './StudentSearch'
import { ToolsSidebar } from './ToolsSidebar'

/** Student search is most useful on progress / scores routes. */
function showStudentSearch(pathname: string): boolean {
  if (pathname === '/progress' || pathname.startsWith('/progress/')) return true
  if (pathname === '/class' || pathname.startsWith('/class/')) return true
  if (pathname === '/overview' || pathname.startsWith('/overview')) return true
  if (pathname === '/reading' || pathname.startsWith('/reading')) return true
  return false
}

export function AppLayout() {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [toolsOpen, setToolsOpen] = useState(false)

  if (!ready) return <AuthBootScreen />
  if (!user) return <Navigate to="/login" replace />

  if (isStudent(user)) {
    return (
      <div className="app-shell student-shell">
        <div className="atmosphere" aria-hidden />
        <header className="shell-chrome">
          <Navbar />
        </header>
        <main className="page-stage">
          <Outlet />
        </main>
      </div>
    )
  }

  const searchVisible = showStudentSearch(location.pathname)

  return (
    <CampusProvider>
      <NotificationsProvider>
        <div className={`app-shell${toolsOpen ? ' tools-open' : ''}`}>
          <div className="atmosphere" aria-hidden />
          <ToolsSidebar open={toolsOpen} onClose={() => setToolsOpen(false)} />
          <header className="shell-chrome">
            <Navbar
              toolsOpen={toolsOpen}
              onToggleTools={() => setToolsOpen((o) => !o)}
            />
            {searchVisible ? (
              <div className="shell-search-row">
                <div className="shell-search-card">
                  <StudentSearch />
                </div>
              </div>
            ) : null}
          </header>
          <main className="page-stage">
            <Outlet />
          </main>
        </div>
      </NotificationsProvider>
    </CampusProvider>
  )
}
