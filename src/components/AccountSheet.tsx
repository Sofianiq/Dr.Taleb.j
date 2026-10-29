import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Download, Eye, EyeOff, KeyRound, LogOut, Monitor, Moon, ShieldCheck, Share, SquarePlus, Sun } from 'lucide-react'
import { changePassword, logout } from '../lib/auth'
import { ACCOUNTS, ROLE_LABEL } from '../lib/constants'
import { usePwa } from '../lib/pwa'
import type { Role } from '../data/types'
import { Field, Segmented, Sheet, Spinner, useConfirm, useToast } from './ui'

type Theme = 'auto' | 'light' | 'dark'

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyStoredTheme() {
  const t = readTheme()
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function AccountSheet({ open, onClose, role }: { open: boolean; onClose: () => void; role: Role | null }) {
  const [pwOpen, setPwOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const pwa = usePwa()
  const confirm = useConfirm()

  useEffect(() => {
    try {
      if (theme === 'auto') localStorage.removeItem('theme')
      else localStorage.setItem('theme', theme)
    } catch {
      /* التخزين غير متاح */
    }
    applyStoredTheme()
  }, [theme])

  const doLogout = async () => {
    const ok = await confirm({ title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج من التطبيق على هذا الجهاز؟', confirmLabel: 'خروج', danger: true })
    if (ok) {
      onClose()
      await logout()
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="الحساب والإعدادات">
        {role && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-soft p-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-brand text-on-brand">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-brand-ink">{ROLE_LABEL[role]}</div>
              <div className="truncate text-[0.85rem] text-ink-2" dir="ltr">
                {ACCOUNTS[role].email}
              </div>
              <div className="text-[0.78rem] text-muted">
                {role === 'admin' ? 'صلاحيات كاملة على جميع أقسام التطبيق' : 'تعبئة استمارات المرضى والاطلاع على جميع الأقسام'}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button type="button" className="btn btn-secondary w-full justify-start" onClick={() => setPwOpen(true)}>
            <KeyRound size={19} className="text-brand" />
            تغيير كلمة المرور
          </button>
          {!pwa.isStandalone && (
            <button
              type="button"
              className="btn btn-secondary w-full justify-start"
              onClick={async () => {
                if (pwa.canInstall) await pwa.install()
                else setInstallOpen(true)
              }}
            >
              <Download size={19} className="text-brand" />
              تثبيت التطبيق على الهاتف
            </button>
          )}
        </div>

        <div className="mt-5">
          <div className="field-label">المظهر</div>
          <Segmented<Theme>
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'auto', label: <><Monitor size={16} /> تلقائي</> },
              { value: 'light', label: <><Sun size={16} /> فاتح</> },
              { value: 'dark', label: <><Moon size={16} /> داكن</> },
            ]}
          />
        </div>

        <button type="button" className="btn btn-danger mt-6 w-full" onClick={doLogout}>
          <LogOut size={19} />
          تسجيل الخروج
        </button>
      </Sheet>

      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      <InstallGuideSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </>
  )
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  autoComplete: string
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        className="input input-ltr pe-12"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
      />
      <button
        type="button"
        className="absolute inset-y-0 end-1 my-auto grid size-10 place-items-center rounded-xl text-muted hover:text-ink"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

export { PasswordInput }

export function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setCurrent('')
      setNext('')
      setAgain('')
      setError('')
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (next !== again) return setError('كلمتا المرور الجديدتان غير متطابقتين.')
    if (next === current) return setError('كلمة المرور الجديدة مطابقة للحالية.')
    setBusy(true)
    try {
      await changePassword(current, next)
      toast('تم تغيير كلمة المرور بنجاح')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تغيير كلمة المرور.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="تغيير كلمة المرور"
      subtitle="ستُطبَّق كلمة المرور الجديدة على جميع الأجهزة التي تستخدم هذا الحساب"
    >
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Field label="كلمة المرور الحالية">
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="كلمة المرور الجديدة" hint="٦ أحرف أو أرقام على الأقل">
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
        </Field>
        <Field label="تأكيد كلمة المرور الجديدة">
          <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
        </Field>
        {error && <div className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[0.88rem] font-medium text-accent">{error}</div>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !current || !next || !again}>
          {busy ? <Spinner size={18} /> : <KeyRound size={18} />}
          حفظ كلمة المرور الجديدة
        </button>
      </form>
    </Sheet>
  )
}

export function InstallGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isIOS } = usePwa()
  return (
    <Sheet open={open} onClose={onClose} title="تثبيت التطبيق على الهاتف" subtitle="يعمل كتطبيق مستقل بأيقونة على الشاشة الرئيسية">
      <div className="space-y-4 pb-3 text-[0.93rem] leading-relaxed text-ink-2">
        {isIOS ? (
          <ol className="space-y-3">
            <Step n={1}>افتح التطبيق من متصفح <b>Safari</b>.</Step>
            <Step n={2}>
              اضغط زر المشاركة <Share size={17} className="inline align-[-3px] text-info" /> في أسفل الشاشة.
            </Step>
            <Step n={3}>
              اختر <b>«إضافة إلى الشاشة الرئيسية»</b> <SquarePlus size={17} className="inline align-[-3px]" /> ثم اضغط «إضافة».
            </Step>
          </ol>
        ) : (
          <ol className="space-y-3">
            <Step n={1}>افتح التطبيق من متصفح <b>Chrome</b>.</Step>
            <Step n={2}>اضغط قائمة المتصفح (⋮) في الأعلى.</Step>
            <Step n={3}>
              اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.
            </Step>
          </ol>
        )}
        <p className="rounded-xl bg-surface-3 px-3.5 py-2.5 text-[0.85rem] text-muted">
          بعد التثبيت يفتح التطبيق بملء الشاشة، ويعمل حتى عند ضعف الإنترنت، وتتم مزامنة التغييرات تلقائياً.
        </p>
      </div>
    </Sheet>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-ink">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}
