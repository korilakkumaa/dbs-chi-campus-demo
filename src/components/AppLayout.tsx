import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CampusProvider } from '../context/CampusContext'
import { Navbar } from './Navbar'
import { StudentSearch } from './StudentSearch'
import { ToolsSidebar } from './ToolsSidebar'

export function AppLayout() {
  const { user } = useAuth()
  const [toolsOpen, setToolsOpen] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  if (user.role === 'student') {
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

  return (
    <CampusProvider>
      <div className={`app-shell${toolsOpen ? ' tools-open' : ''}`}>
        <div className="atmosphere" aria-hidden />
        <ToolsSidebar open={toolsOpen} onClose={() => setToolsOpen(false)} />
        <header className="shell-chrome">
          <Navbar
            toolsOpen={toolsOpen}
            onToggleTools={() => setToolsOpen((o) => !o)}
          />
          <div className="shell-search-row">
            <div className="shell-search-card">
              <StudentSearch />
            </div>
          </div>
        </header>
        <main className="page-stage">
          <Outlet />
        </main>
      </div>
    </CampusProvider>
  )
}
