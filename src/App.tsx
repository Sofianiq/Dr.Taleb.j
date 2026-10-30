import { useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ConfirmProvider, Logo, Spinner, ToastProvider } from './components/ui'
import { AuthProvider, useAuth } from './data/auth'
import { DataProvider } from './data/store'
import { MANAGED_BY } from './lib/constants'
import { PrintProvider } from './print/PrintProvider'
import { AdminPage } from './pages/Admin'
import { ActivityPage, ArchivePage, DepartmentsManagerPage, WardsManagerPage } from './pages/AdminTools'
import { InquiriesPage } from './pages/Inquiries'
import { Intro } from './pages/Intro'
import { Login } from './pages/Login'
import { ResidentPage } from './pages/Resident'
import { ShiftsPage } from './pages/Shifts'
import { DepartmentPage, StaffPage } from './pages/Staff'
import { WardPage } from './pages/Ward'

const INTRO_KEY = 'intro-seen'

function readIntroSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <Logo size={84} className="ring-1 ring-line" />
        <Spinner size={20} className="text-brand" />
        <div className="text-[0.84rem] font-semibold text-muted">{MANAGED_BY}</div>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth()
  if (!ready) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { ready, user } = useAuth()
  if (!ready) return <Splash />
  if (user) return <Navigate to="/resident" replace />
  return <Login />
}

function Root() {
  const [introSeen, setIntroSeen] = useState(readIntroSeen)
  const navigate = useNavigate()
  const { user } = useAuth()

  // النبذة التعريفية تظهر أولاً عند كل فتح للتطبيق
  if (!introSeen) {
    return (
      <Intro
        onNext={() => {
          try {
            sessionStorage.setItem(INTRO_KEY, '1')
          } catch {
            /* التخزين غير متاح */
          }
          setIntroSeen(true)
          navigate(user ? '/resident' : '/login', { replace: true })
        }}
      />
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/resident" element={<ResidentPage />} />
        <Route path="/resident/ward/:wardId" element={<WardPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/:deptId" element={<DepartmentPage />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/wards" element={<WardsManagerPage />} />
        <Route path="/admin/departments" element={<DepartmentsManagerPage />} />
        <Route path="/admin/activity" element={<ActivityPage />} />
        <Route path="/admin/archive" element={<ArchivePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/resident" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <ConfirmProvider>
              <PrintProvider>
                <Root />
              </PrintProvider>
            </ConfirmProvider>
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  )
}
