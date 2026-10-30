import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronLeft, Download, Eye, EyeOff, KeyRound, LogOut, Share, SquarePlus } from 'lucide-react'
import { changePassword, logout } from '../lib/auth'
import { ACCOUNTS, ROLE_LABEL } from '../lib/constants'
import { setOperatorName, useOperatorName } from '../lib/operator'
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

function Row({ icon, label, hint, onClick, danger }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2">
      <span className={danger ? 'text-critical' : 'text-muted'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[0.92rem] font-semibold ${danger ? 'text-critical' : 'text-ink'}`}>{label}</span>
        {hint && <span className="block text-[0.78rem] text-muted">{hint}</span>}
      </span>
      {!danger && <ChevronLeft size={16} className="text-faint" />}
    </button>
  )
}

export function AccountSheet({ open, onClose, role }: { open: boolean; onClose: () => void; role: Role | null }) {
  const [pwOpen, setPwOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const operator = useOperatorName()
  const [name, setName] = useState(operator)
  const pwa = usePwa()
  const confirm = useConfirm()
  const toast = useToast()

  useEffect(() => {
    if (open) setName(operator)
  }, [open, operator])

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
      <Sheet open={open} onClose={onClose} title="الحساب والإعدادات" size="sm">
        {role && (
          <div className="mb-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
            <div className="text-[0.78rem] text-muted">الحساب</div>
            <div className="font-bold text-ink">{ROLE_LABEL[role]}</div>
            <div className="text-[0.84rem] text-ink-2" dir="ltr" style={{ textAlign: 'right' }}>
              {ACCOUNTS[role].email}
            </div>
            <div className="mt-1 text-[0.78rem] text-muted">
              {role === 'admin' ? 'صلاحيات كاملة على جميع أقسام التطبيق وإعداداته' : 'إدخال المرضى ومتابعتهم والاطلاع على جميع الأقسام'}
            </div>
          </div>
        )}

        <form
          className="mb-4"
          onSubmit={(e) => {
            e.preventDefault()
            setOperatorName(name)
            toast('تم حفظ اسم مستخدم الجهاز')
          }}
        >
          <Field label="اسم مستخدم هذا الجهاز" hint="يُسجَّل مع كل تعديل في سجل النشاطات">
            <div className="flex gap-2">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="مثال: د. حسن علي" />
              <button type="submit" className="btn btn-secondary shrink-0" disabled={name.trim() === operator}>
                حفظ
              </button>
            </div>
          </Field>
        </form>

        <div className="mb-4">
          <div className="field-label">المظهر</div>
          <Segmented<Theme>
            value={theme}
            onChange={setTheme}
            className="w-full"
            options={[
              { value: 'auto', label: 'تلقائي' },
              { value: 'light', label: 'فاتح' },
              { value: 'dark', label: 'داكن' },
            ]}
          />
        </div>

        <div className="-mx-5 divide-y divide-line border-y border-line">
          <Row icon={<KeyRound size={18} />} label="تغيير كلمة المرور" hint="تُطبَّق على جميع أجهزة هذا الحساب" onClick={() => setPwOpen(true)} />
          {!pwa.isStandalone && (
            <Row
              icon={<Download size={18} />}
              label="تثبيت التطبيق على الهاتف"
              hint="يعمل كتطبيق مستقل وحتى دون إنترنت"
              onClick={async () => {
                if (pwa.canInstall) await pwa.install()
                else setInstallOpen(true)
              }}
            />
          )}
          <Row icon={<LogOut size={18} />} label="تسجيل الخروج" onClick={doLogout} danger />
        </div>
      </Sheet>

      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      <InstallGuideSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </>
  )
}

export function PasswordInput({
  value,
  onChange,
  autoComplete,
  autoFocus,
  id,
}: {
  value: string
  onChange: (v: string) => void
  autoComplete: string
  autoFocus?: boolean
  id?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        className="input ltr-input pe-11"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
      />
      <button
        type="button"
        className="absolute inset-y-0 end-0.5 my-auto grid size-9 place-items-center rounded-md text-muted hover:text-ink"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

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
    <Sheet open={open} onClose={onClose} size="sm" title="تغيير كلمة المرور" subtitle="ستُطبَّق كلمة المرور الجديدة على جميع الأجهزة التي تستخدم هذا الحساب">
      <form onSubmit={submit} className="space-y-4">
        <Field label="كلمة المرور الحالية">
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="كلمة المرور الجديدة" hint="٦ أحرف أو أرقام على الأقل">
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
        </Field>
        <Field label="تأكيد كلمة المرور الجديدة">
          <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
        </Field>
        {error && <div className="rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-[0.86rem] text-critical">{error}</div>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !current || !next || !again}>
          {busy && <Spinner size={16} />}
          حفظ كلمة المرور الجديدة
        </button>
      </form>
    </Sheet>
  )
}

export function InstallGuideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isIOS } = usePwa()
  const steps = isIOS
    ? [
        <>افتح التطبيق من متصفح <b>Safari</b>.</>,
        <>
          اضغط زر المشاركة <Share size={15} className="inline align-[-2px]" /> في أسفل الشاشة.
        </>,
        <>
          اختر <b>«إضافة إلى الشاشة الرئيسية»</b> <SquarePlus size={15} className="inline align-[-2px]" /> ثم «إضافة».
        </>,
      ]
    : [
        <>افتح التطبيق من متصفح <b>Chrome</b>.</>,
        <>اضغط قائمة المتصفح (⋮) في الأعلى.</>,
        <>
          اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.
        </>,
      ]
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="تثبيت التطبيق على الهاتف" subtitle={isIOS ? 'iPhone / iPad' : 'Android'}>
      <ol className="space-y-3 text-[0.92rem] text-ink-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-[0.78rem] font-bold text-ink">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-[0.82rem] text-muted">
        بعد التثبيت يفتح التطبيق بملء الشاشة، ويعمل حتى عند ضعف الإنترنت، وتتم مزامنة التغييرات تلقائياً.
      </p>
    </Sheet>
  )
}
