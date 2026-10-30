import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarClock, CloudOff, Info, RefreshCw, Stethoscope, Users } from 'lucide-react'
import { useAuth } from '../data/auth'
import { useData } from '../data/store'
import { HOSPITAL_SHORT, MANAGED_BY, ROLE_LABEL } from '../lib/constants'
import { markOperatorPrompted, operatorPrompted, setOperatorName, useOperatorName } from '../lib/operator'
import { usePwa } from '../lib/pwa'
import { Field, Logo, Sheet } from './ui'
import { AccountSheet } from './AccountSheet'

const NAV: { to: string; label: string; icon: (s: number) => ReactNode }[] = [
  { to: '/resident', label: 'الطبيب المقيم', icon: (s) => <Stethoscope size={s} strokeWidth={1.8} /> },
  { to: '/staff', label: 'الكادر الطبي', icon: (s) => <Users size={s} strokeWidth={1.8} /> },
  { to: '/inquiries', label: 'الاستعلامات', icon: (s) => <Info size={s} strokeWidth={1.8} /> },
  { to: '/shifts', label: 'الكولات', icon: (s) => <CalendarClock size={s} strokeWidth={1.8} /> },
  { to: '/admin', label: 'الإدارة', icon: (s) => <Building2 size={s} strokeWidth={1.8} /> },
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
    if (live) {
      setStalled(false)
      return
    }
    const t = window.setTimeout(() => setStalled(true), 7000)
    return () => window.clearTimeout(t)
  }, [live])
  const online = browserOnline && !stalled
  const label = !online ? 'غير متصل' : status.pendingWrites ? 'جارٍ الحفظ' : live ? 'متصل — تحديث لحظي' : 'جارٍ الاتصال'
  return { online, live, label }
}

function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { online, live, label } = useSyncState()
  return (
    <span role="status" title={label} className={`inline-flex items-center gap-1.5 text-[0.76rem] font-medium ${online ? 'text-muted' : 'text-warn'}`}>
      {online ? (
        <span className={`size-2 rounded-full ${live ? 'live-dot bg-brand text-brand' : 'bg-faint'}`} />
      ) : (
        <CloudOff size={14} />
      )}
      <span className={compact && live ? 'sr-only' : ''}>{compact && live ? label : online ? (live ? 'متصل' : label) : label}</span>
    </span>
  )
}

function initials(name: string) {
  const parts = name.replace(/^(د\.|د |دكتور|الدكتور)\s*/, '').trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function AccountButton({ onClick, wide = false }: { onClick: () => void; wide?: boolean }) {
  const { role } = useAuth()
  const name = useOperatorName()
  if (wide) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-surface-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.82rem] font-bold text-ink-2 ring-1 ring-line">
          {name ? initials(name) : <Users size={16} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.86rem] font-semibold text-ink">{name || 'مستخدم الجهاز'}</span>
          <span className="block truncate text-[0.74rem] text-muted">{role ? ROLE_LABEL[role] : ''}</span>
        </span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.8rem] font-bold text-ink-2 ring-1 ring-line"
      aria-label="الحساب والإعدادات"
    >
      {name ? initials(name) : <Users size={16} />}
    </button>
  )
}

export function AppShell() {
  const { status } = useData()
  const { role } = useAuth()
  const pwa = usePwa()
  const [accountOpen, setAccountOpen] = useState(false)
  const [askName, setAskName] = useState(() => !operatorPrompted())
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh lg:flex">
      {/* الشريط الجانبي (الحاسوب) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface lg:flex">
        <div className="flex items-center gap-3 border-b border-line px-4 py-4">
          <Logo size={40} className="ring-1 ring-line" />
          <div className="min-w-0 leading-snug">
            <div className="text-[0.9rem] font-bold text-ink">{HOSPITAL_SHORT}</div>
            <div className="text-[0.74rem] text-muted">{MANAGED_BY}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3" aria-label="الأقسام">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9rem] font-semibold transition-colors ${
                  isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-3'
                }`
              }
            >
              {item.icon(19)}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line p-3">
          <div className="px-2.5">
            <SyncIndicator />
          </div>
          <AccountButton wide onClick={() => setAccountOpen(true)} />
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-[calc(4.4rem+env(safe-area-inset-bottom))] lg:pb-10">
        {/* الشريط العلوي (الهاتف) */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-14 items-center gap-2.5 px-4">
            <Logo size={32} className="ring-1 ring-line" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[0.9rem] font-bold text-ink">{HOSPITAL_SHORT}</div>
              <div className="truncate text-[0.7rem] text-muted">{MANAGED_BY}</div>
            </div>
            <SyncIndicator compact />
            <AccountButton onClick={() => setAccountOpen(true)} />
          </div>
        </header>

        {status.error && (
          <div className="mx-auto mt-4 max-w-6xl px-4 lg:px-8">
            <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[0.86rem] text-warn">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <span>{status.error}</span>
            </div>
          </div>
        )}

        {pwa.needRefresh && (
          <div className="mx-auto mt-4 max-w-6xl px-4 lg:px-8">
            <div className="flex items-center gap-3 rounded-lg border border-info/25 bg-info-soft px-3.5 py-2 text-[0.86rem] text-info">
              <RefreshCw size={16} className="shrink-0" />
              <span className="flex-1 font-semibold">يتوفر إصدار جديد من التطبيق</span>
              <button type="button" className="btn btn-sm bg-info text-white" onClick={pwa.applyUpdate}>
                تحديث الآن
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 pt-5 lg:px-8 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {/* الشريط السفلي (الهاتف) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="التبويبات الرئيسية"
      >
        <div className="grid h-[4.1rem] grid-cols-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 text-center ${isActive ? 'text-brand-ink' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-4 top-0 h-[2px] rounded-b bg-brand" />}
                  {item.icon(21)}
                  <span className={`text-[0.68rem] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} role={role} />
      <OperatorPrompt
        open={askName}
        onClose={() => {
          markOperatorPrompted()
          setAskName(false)
        }}
      />
    </div>
  )
}

/** يُسأل المستخدم مرة واحدة على كل جهاز عن اسمه ليُسجَّل مع تعديلاته */
function OperatorPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useOperatorName()
  const [name, setName] = useState(current)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setOperatorName(name)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="من يستخدم هذا الجهاز؟" subtitle="يظهر الاسم بجانب كل تعديل في سجل النشاطات">
      <form onSubmit={submit} className="space-y-4">
        <Field label="الاسم" hint="يمكن تغييره لاحقاً من قائمة الحساب">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="مثال: د. حسن علي" autoFocus />
        </Field>
        <div className="flex flex-row-reverse gap-2">
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            حفظ
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            لاحقاً
          </button>
        </div>
      </form>
    </Sheet>
  )
}
