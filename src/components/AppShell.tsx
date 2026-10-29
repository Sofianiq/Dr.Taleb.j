import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CloudOff,
  Info,
  RefreshCw,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react'
import { useAuth } from '../data/auth'
import { useData } from '../data/store'
import { HOSPITAL_SHORT, MANAGED_BY } from '../lib/constants'
import { usePwa } from '../lib/pwa'
import { Logo } from './ui'
import { AccountSheet } from './AccountSheet'

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/resident', label: 'الطبيب المقيم', icon: <Stethoscope size={22} /> },
  { to: '/staff', label: 'الكادر الطبي', icon: <Users size={22} /> },
  { to: '/inquiries', label: 'الاستعلامات', icon: <Info size={22} /> },
  { to: '/shifts', label: 'الكولات', icon: <CalendarClock size={22} /> },
  { to: '/admin', label: 'الإدارة', icon: <Building2 size={22} /> },
]

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function useSyncState() {
  const { status } = useData()
  const browserOnline = useOnline()
  const live = browserOnline && status.loaded && !status.fromCache && !status.error
  // إذا تعذّر الوصول إلى الخادم لأكثر من بضع ثوانٍ نعرض "غير متصل" بدلاً من "جارٍ الاتصال"
  const [stalled, setStalled] = useState(false)
  useEffect(() => {
    if (live) return setStalled(false)
    const t = window.setTimeout(() => setStalled(true), 7000)
    return () => window.clearTimeout(t)
  }, [live])
  const online = browserOnline && !stalled
  const label = !online ? 'غير متصل' : status.pendingWrites ? 'جارٍ الحفظ' : live ? 'مباشر' : 'جارٍ الاتصال'
  return { online, live, label }
}

function SyncBadge() {
  const { online, live, label } = useSyncState()
  const tone = !online ? 'bg-warn-soft text-warn' : live ? 'bg-brand-soft text-brand-ink' : 'bg-surface-3 text-muted'
  return (
    // على الهاتف تظهر حالة "مباشر" كنقطة خضراء على زر الحساب لتوفير المساحة
    <span
      className={`chip shrink-0 gap-1.5 ${tone} ${live ? 'max-sm:hidden' : ''}`}
      title={live ? 'التحديثات تظهر لحظياً لجميع المستخدمين' : label}
      role="status"
    >
      {!online ? (
        <CloudOff size={13} />
      ) : (
        <span className={`size-2 rounded-full ${live ? 'live-dot bg-brand-2 text-brand-2' : 'bg-muted'}`} />
      )}
      {label}
    </span>
  )
}

export function AppShell() {
  const { role } = useAuth()
  const { status } = useData()
  const pwa = usePwa()
  const sync = useSyncState()
  const [accountOpen, setAccountOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh pb-[calc(5.4rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-4">
          <Logo size={42} className="ring-1 ring-line" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-display text-[0.95rem] font-bold text-ink">{HOSPITAL_SHORT}</div>
            <div className="truncate text-[0.74rem] font-medium text-muted">{MANAGED_BY}</div>
          </div>
          <SyncBadge />
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="relative grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-brand-ink transition hover:bg-brand-soft"
            aria-label={`الحساب والإعدادات — ${sync.label}`}
          >
            <UserRound size={20} />
            {sync.live && (
              <span className="live-dot absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 border-surface bg-brand-2 text-brand-2 sm:hidden" />
            )}
          </button>
        </div>
        <div className="h-[3px] bg-gradient-to-l from-brand via-brand-2 to-accent opacity-90" />
      </header>

      {status.error && (
        <div className="mx-auto mt-3 max-w-5xl px-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-[0.86rem] text-warn">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{status.error}</span>
          </div>
        </div>
      )}

      {pwa.needRefresh && (
        <div className="mx-auto mt-3 max-w-5xl px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-info/25 bg-info-soft px-4 py-2.5 text-[0.88rem] text-info">
            <RefreshCw size={18} className="shrink-0" />
            <span className="flex-1 font-semibold">يتوفر إصدار جديد من التطبيق</span>
            <button type="button" className="btn btn-sm bg-info text-white" onClick={pwa.applyUpdate}>
              تحديث
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 pt-4">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        aria-label="التبويبات الرئيسية"
      >
        <div className="mx-auto grid h-[4.6rem] max-w-xl grid-cols-5 px-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group flex flex-col items-center justify-center gap-1 rounded-2xl text-center transition ${
                  isActive ? 'text-brand-ink' : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-8 w-14 place-items-center rounded-full transition ${
                      isActive ? 'bg-brand-soft' : 'group-hover:bg-surface-3'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className={`text-[0.7rem] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} role={role} />
    </div>
  )
}
