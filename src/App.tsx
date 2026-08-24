import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { defaultPath, useAuth } from './context/AuthContext'
import { AdminPage } from './pages/AdminPage'
import { ClassPage } from './pages/ClassPage'
import { IndividualPage } from './pages/IndividualPage'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { CalendarPage } from './pages/CalendarPage'
import { YearOverviewPage } from './pages/YearOverviewPage'
import { PapersPage } from './pages/PapersPage'
import { DutiesPage } from './pages/DutiesPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ClassTimetablePage } from './pages/ClassTimetablePage'
import { PersonalTimetablePage } from './pages/PersonalTimetablePage'
import { ProgressPage } from './pages/ProgressPage'
import { ReadingPage } from './pages/ReadingPage'
import { TowerPage } from './pages/TowerPage'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={defaultPath(user?.role)} replace />
}

function StaffRoutes() {
  const { user } = useAuth()
  if (user?.role === 'student') return <Navigate to="/tower" replace />
  return <Outlet />
}

function AdminRoutes() {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return <Navigate to={defaultPath(user?.role)} replace />
  }
  return <Outlet />
}

function StudentRoutes() {
  const { user } = useAuth()
  if (user?.role !== 'student') {
    return <Navigate to={defaultPath(user?.role)} replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<StaffRoutes />}>
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/year" element={<YearOverviewPage />} />
          <Route path="/timetable" element={<PersonalTimetablePage />} />
          <Route path="/timetable/class" element={<ClassTimetablePage />} />
          <Route
            path="/timetable/school"
            element={
              <PlaceholderPage
                title="全校時間表"
                description="全校中國語文科的時間表總覽。"
              />
            }
          />
          <Route path="/class" element={<ClassPage />} />
          <Route path="/class/individual" element={<IndividualPage />} />
          <Route path="/resources" element={<Navigate to="/resources/papers" replace />} />
          <Route path="/resources/papers" element={<PapersPage />} />
          <Route path="/resources/duties" element={<DutiesPage />} />
          <Route
            path="/resources/scope"
            element={
              <PlaceholderPage
                title="測考範圍"
                description="各級測考範圍與相關說明。"
              />
            }
          />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route element={<AdminRoutes />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
        <Route element={<StudentRoutes />}>
          <Route path="/tower" element={<TowerPage />} />
        </Route>
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
