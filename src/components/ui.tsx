import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, Info, X, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo.webp'

/* ---------------------------------- الشعار ---------------------------------- */

export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="شعار مستشفى الدكتور طالب الجنابي الأهلي"
      className={`shrink-0 rounded-full bg-white ${className}`}
      draggable={false}
    />
  )
}

/* ------------------------------- نافذة منبثقة ------------------------------- */

let openSheets = 0

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    openSheets++
    document.documentElement.style.overflow = 'hidden'
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      openSheets--
      if (openSheets === 0) document.documentElement.style.overflow = ''
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="anim-fade-in absolute inset-0 bg-[#04120b]/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`anim-sheet sm:anim-pop relative flex max-h-[92dvh] w-full flex-col rounded-t-[1.6rem] bg-surface shadow-float outline-none sm:rounded-[1.6rem] ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-line-strong sm:hidden" />
        <header className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.08rem] font-bold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[0.83rem] text-muted">{subtitle}</div>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon -me-2 -mt-1" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-b-[1.6rem]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* --------------------------------- التنبيهات --------------------------------- */

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.filter((t) => t.text !== text).slice(-2), { id, kind, text }])
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 5200 : 2800)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4">
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`anim-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-[0.92rem] font-semibold shadow-float ${
                t.kind === 'error'
                  ? 'bg-accent text-white'
                  : t.kind === 'info'
                    ? 'bg-ink text-bg'
                    : 'bg-brand text-on-brand'
              }`}
            >
              {t.kind === 'error' ? <XCircle size={19} /> : t.kind === 'info' ? <Info size={19} /> : <CheckCircle2 size={19} />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/* ------------------------------- نافذة التأكيد ------------------------------- */

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  )
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={!!state}
        onClose={() => close(false)}
        title={
          <span className="flex items-center gap-2">
            {state?.danger && <AlertTriangle size={20} className="text-accent" />}
            {state?.title}
          </span>
        }
        footer={
          <div className="flex gap-2.5">
            <button type="button" className={`btn flex-1 ${state?.danger ? 'bg-accent text-white' : 'btn-primary'}`} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'تأكيد'}
            </button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => close(false)}>
              إلغاء
            </button>
          </div>
        }
      >
        {state?.message && <div className="text-[0.95rem] leading-relaxed text-ink-2">{state.message}</div>}
      </Sheet>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)

/* ------------------------------- عناصر الصفحات ------------------------------- */

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: string | boolean
  actions?: ReactNode
  icon?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mb-4 flex items-center gap-3">
      {back && (
        <button
          type="button"
          className="btn btn-secondary btn-icon shrink-0"
          aria-label="رجوع"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <ChevronRight size={20} />
        </button>
      )}
      {icon && !back && (
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[1.3rem] font-bold text-ink">{title}</h1>
        {subtitle && <div className="truncate text-[0.85rem] text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid size-16 place-items-center rounded-3xl bg-surface-3 text-muted">{icon}</div>
      <div className="font-display text-[1.02rem] font-bold text-ink">{title}</div>
      {children && <div className="mt-1 max-w-xs text-[0.88rem] leading-relaxed text-muted">{children}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; badge?: ReactNode }[]
  className?: string
}) {
  return (
    <div className={`flex gap-1 rounded-2xl border border-line bg-surface-3 p-1 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[0.88rem] font-semibold transition ${
              active ? 'bg-surface text-brand-ink shadow-soft' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
            {o.badge}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-e-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-label="جارٍ التحميل"
    />
  )
}

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.78rem] text-muted">{hint}</span>}
    </label>
  )
}

export function StatTile({
  label,
  value,
  icon,
  tone = 'brand',
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: 'brand' | 'accent' | 'info' | 'coral'
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-ink',
    accent: 'bg-accent-soft text-accent',
    info: 'bg-info-soft text-info',
    coral: 'bg-coral-soft text-coral',
  }
  return (
    <div className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-3.5">
      <div className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-10 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="font-display text-[1.25rem] font-bold leading-tight text-ink tabular-nums">{value}</div>
        <div className="text-[0.76rem] leading-snug text-muted">{label}</div>
      </div>
    </div>
  )
}
