import { lazy, Suspense, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  createHashRouter,
} from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { defaultPath, useAuth } from './context/AuthContext'
import { canAccessAdminConsole, isStudent } from './lib/permissions'
import { AuthBootScreen, LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProgressPage } from './pages/ProgressPage'

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const YearOverviewPage = lazy(() =>
  import('./pages/YearOverviewPage').then((m) => ({ default: m.YearOverviewPage })),
)
const PapersPage = lazy(() =>
  import('./pages/PapersPage').then((m) => ({ default: m.PapersPage })),
)
const DutiesPage = lazy(() =>
  import('./pages/DutiesPage').then((m) => ({ default: m.DutiesPage })),
)
const ClassPage = lazy(() =>
  import('./pages/ClassPage').then((m) => ({ default: m.ClassPage })),
)
const IndividualPage = lazy(() =>
  import('./pages/IndividualPage').then((m) => ({ default: m.IndividualPage })),
)
const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
)
const ClassTimetablePage = lazy(() =>
  import('./pages/ClassTimetablePage').then((m) => ({
    default: m.ClassTimetablePage,
  })),
)
const PersonalTimetablePage = lazy(() =>
  import('./pages/PersonalTimetablePage').then((m) => ({
    default: m.PersonalTimetablePage,
  })),
)
const HomeworkAbsMailPage = lazy(() =>
  import('./pages/HomeworkAbsMailPage').then((m) => ({
    default: m.HomeworkAbsMailPage,
  })),
)
const ReadingPage = lazy(() =>
  import('./pages/ReadingPage').then((m) => ({ default: m.ReadingPage })),
)
const TowerPage = lazy(() =>
  import('./pages/TowerPage').then((m) => ({ default: m.TowerPage })),
)

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      載入頁面中…
    </div>
  )
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function HomeRedirect() {
  const { user, ready } = useAuth()
  if (!ready) return <AuthBootScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={defaultPath(user.role)} replace />
}

function StaffRoutes() {
  const { user } = useAuth()
  if (isStudent(user)) return <Navigate to="/tower" replace />
  return <Outlet />
}

function AdminRoutes() {
  const { user } = useAuth()
  if (!canAccessAdminConsole(user)) {
    return <Navigate to={defaultPath(user?.role)} replace />
  }
  return <Outlet />
}

function StudentRoutes() {
  const { user } = useAuth()
  if (!isStudent(user)) {
    return <Navigate to={defaultPath(user?.role)} replace />
  }
  return <Outlet />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<StaffRoutes />}>
          <Route path="/progress" element={<ProgressPage />} />
          <Route
            path="/progress/abs-mail"
            element={
              <LazyRoute>
                <HomeworkAbsMailPage />
              </LazyRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <LazyRoute>
                <CalendarPage />
              </LazyRoute>
            }
          />
          <Route
            path="/calendar/year"
            element={
              <LazyRoute>
                <YearOverviewPage />
              </LazyRoute>
            }
          />
          <Route
            path="/timetable"
            element={
              <LazyRoute>
                <PersonalTimetablePage />
              </LazyRoute>
            }
          />
          <Route
            path="/timetable/class"
            element={
              <LazyRoute>
                <ClassTimetablePage />
              </LazyRoute>
            }
          />
          <Route
            path="/timetable/school"
            element={
              <PlaceholderPage
                title="全校時間表"
                description="全校中國語文科的時間表總覽。"
                upcoming
              />
            }
          />
          <Route
            path="/class"
            element={
              <LazyRoute>
                <ClassPage />
              </LazyRoute>
            }
          />
          <Route
            path="/class/individual"
            element={
              <LazyRoute>
                <IndividualPage />
              </LazyRoute>
            }
          />
          <Route path="/resources" element={<Navigate to="/resources/papers" replace />} />
          <Route
            path="/resources/papers"
            element={
              <LazyRoute>
                <PapersPage />
              </LazyRoute>
            }
          />
          <Route
            path="/resources/duties"
            element={
              <LazyRoute>
                <DutiesPage />
              </LazyRoute>
            }
          />
          <Route
            path="/resources/scope"
            element={
              <PlaceholderPage
                title="測考範圍"
                description="各級測考範圍與相關說明。"
                upcoming
              />
            }
          />
          <Route
            path="/reading"
            element={
              <LazyRoute>
                <ReadingPage />
              </LazyRoute>
            }
          />
          <Route
            path="/overview"
            element={
              <LazyRoute>
                <OverviewPage />
              </LazyRoute>
            }
          />
          <Route element={<AdminRoutes />}>
            <Route
              path="/admin"
              element={
                <LazyRoute>
                  <AdminPage />
                </LazyRoute>
              }
            />
          </Route>
        </Route>
        <Route element={<StudentRoutes />}>
          <Route
            path="/tower"
            element={
              <LazyRoute>
                <TowerPage />
              </LazyRoute>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

/** Data router so `useBlocker` works for dirty-form navigation guards. */
export const appRouter = createHashRouter([
  { path: '*', element: <AppRoutes /> },
])

export default function App() {
  return <AppRoutes />
}
