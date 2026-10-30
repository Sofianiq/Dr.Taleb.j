import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronRight, Info, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import logoUrl from '../assets/logo.webp'
import type { BedStatus } from '../data/types'
import { STATUS, type Tone } from '../lib/constants'

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
  headerExtra,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  headerExtra?: ReactNode
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
  const width = size === 'lg' ? 'sm:max-w-3xl' : size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-xl'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`anim-sheet relative flex max-h-[94dvh] w-full flex-col rounded-t-[14px] border border-line bg-surface shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)] outline-none sm:rounded-[12px] ${width}`}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.02rem] font-bold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[0.82rem] text-muted">{subtitle}</div>}
          </div>
          {headerExtra}
          <button type="button" className="btn btn-ghost btn-sm btn-icon -me-1.5" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-line bg-surface-2 px-5 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-b-[12px]">
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
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 5200 : 2600)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className="anim-sheet pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg bg-[#16201c] px-3.5 py-2.5 text-[0.88rem] font-medium text-white shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5)]"
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full ${
                  t.kind === 'error' ? 'bg-[#e5484d]' : t.kind === 'info' ? 'bg-[#4b8fd4]' : 'bg-[#2ea66b]'
                }`}
              >
                {t.kind === 'error' ? <X size={12} strokeWidth={3} /> : t.kind === 'info' ? <Info size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
              </span>
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
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])
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
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {state?.danger && <AlertTriangle size={18} className="text-critical" />}
            {state?.title}
          </span>
        }
        footer={
          <div className="flex flex-row-reverse gap-2">
            <button type="button" className={`btn ${state?.danger ? 'btn-solid-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'تأكيد'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
              إلغاء
            </button>
          </div>
        }
      >
        {state?.message && <div className="text-[0.93rem] leading-relaxed text-ink-2">{state.message}</div>}
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
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link to={back.to} className="mb-1.5 inline-flex items-center gap-0.5 text-[0.82rem] font-semibold text-muted hover:text-brand-ink">
          <ChevronRight size={15} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-bold leading-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-[0.86rem] text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

export function SectionHeader({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[0.98rem] font-bold text-ink">{title}</h2>
        {meta && <div className="text-[0.8rem] text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-9 text-center">
      <div className="text-[0.95rem] font-semibold text-ink">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-sm text-[0.86rem] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = '',
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`inline-flex rounded-lg border border-line-strong bg-surface p-0.5 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-semibold transition-colors ${
              size === 'sm' ? 'min-h-8 text-[0.8rem]' : 'min-h-9 text-[0.86rem]'
            } ${active ? 'bg-ink text-surface' : 'text-muted hover:text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** تبويبات بخط سفلي (للصفحات والنوافذ) */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
}) {
  return (
    <div className={`no-scrollbar flex gap-5 overflow-x-auto border-b border-line ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[0.88rem] font-semibold transition-colors ${
              active ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }) {
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
      {hint && <span className="mt-1 block text-[0.76rem] text-muted">{hint}</span>}
    </label>
  )
}

/* ------------------------------- الحالات والألوان ------------------------------- */

export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-brand-ink',
  critical: 'text-critical',
  info: 'text-info',
  warn: 'text-warn',
  neutral: 'text-muted',
  muted: 'text-faint',
}
export const TONE_BG: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-ink',
  critical: 'bg-critical-soft text-critical',
  info: 'bg-info-soft text-info',
  warn: 'bg-warn-soft text-warn',
  neutral: 'bg-surface-3 text-muted',
  muted: 'bg-surface-3 text-faint',
}
export const TONE_DOT: Record<Tone, string> = {
  brand: 'bg-brand',
  critical: 'bg-critical',
  info: 'bg-info',
  warn: 'bg-warn',
  neutral: 'bg-line-strong',
  muted: 'bg-faint',
}

export function StatusTag({ status, className = '' }: { status: BedStatus; className?: string }) {
  const st = STATUS[status]
  return (
    <span className={`tag ${TONE_BG[st.tone]} ${className}`}>
      <span className={`size-1.5 rounded-full ${TONE_DOT[st.tone]}`} />
      {st.label}
    </span>
  )
}

/** شريط مؤشرات أفقي مقسّم بخطوط رفيعة */
export function MetricStrip({ items }: { items: { label: string; value: ReactNode; tone?: Tone; hint?: string }[] }) {
  return (
    <div
      className="panel grid grid-cols-2 overflow-hidden sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
      style={{ '--cols': items.length } as CSSProperties}
    >
      {items.map((m, i) => (
        <div
          key={m.label}
          className={`border-line px-4 py-3 ${i % 2 === 1 ? 'border-s' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i > 0 ? 'sm:border-s' : ''}`}
        >
          <div className="text-[0.76rem] font-semibold text-muted">{m.label}</div>
          <div className={`mt-0.5 text-[1.45rem] font-bold leading-tight tabular-nums ${m.tone ? TONE_TEXT[m.tone] : 'text-ink'}`}>
            {m.value}
          </div>
          {m.hint && <div className="text-[0.72rem] text-faint">{m.hint}</div>}
        </div>
      ))}
    </div>
  )
}
