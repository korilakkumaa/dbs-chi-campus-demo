import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CampusProvider } from '../context/CampusContext'
import { Navbar } from './Navbar'
import { ToolsSidebar } from './ToolsSidebar'

export function AppLayout() {
  const { user } = useAuth()
  const [toolsOpen, setToolsOpen] = useState(false)

  if (!user) return <Navigate to="/login" replace />

  return (
    <CampusProvider>
      <div className={`app-shell${toolsOpen ? ' tools-open' : ''}`}>
        <div className="atmosphere" aria-hidden />
        <ToolsSidebar open={toolsOpen} onClose={() => setToolsOpen(false)} />
        <Navbar
          toolsOpen={toolsOpen}
          onToggleTools={() => setToolsOpen((o) => !o)}
        />
        <main className="page-stage">
          <Outlet />
        </main>
      </div>
    </CampusProvider>
  )
}
