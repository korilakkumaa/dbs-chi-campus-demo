import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AdminPage } from './pages/AdminPage'
import { ClassPage } from './pages/ClassPage'
import { IndividualPage } from './pages/IndividualPage'
import { LoginPage } from './pages/LoginPage'
import { OverviewPage } from './pages/OverviewPage'
import { ProgressPage } from './pages/ProgressPage'
import { ReadingPage } from './pages/ReadingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/progress" replace />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/class" element={<ClassPage />} />
        <Route path="/class/individual" element={<IndividualPage />} />
        <Route path="/reading" element={<ReadingPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/progress" replace />} />
    </Routes>
  )
}
