import type { ReactNode } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { usePrint } from '../print/PrintProvider'
import { Sheet } from './ui'

/** نافذة اختيار: طباعة مباشرة أو ملف PDF، مع خيارات إضافية اختيارية */
export function PrintChoice({
  open,
  onClose,
  title,
  subtitle,
  build,
  filename,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  build: () => ReactNode
  filename: string
  children?: ReactNode
}) {
  const printer = usePrint()
  return (
    <Sheet open={open} onClose={onClose} size="sm" title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {children}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={printer.busy}
            onClick={() => {
              onClose()
              printer.print(build(), filename)
            }}
          >
            <Printer size={16} />
            طباعة
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={printer.busy}
            onClick={() => {
              onClose()
              printer.pdf(build(), filename)
            }}
          >
            <FileDown size={16} />
            ملف PDF
          </button>
        </div>
        <p className="text-[0.76rem] text-muted">ملف PDF يمكن تنزيله أو مشاركته مباشرة عبر واتساب. من نافذة الطباعة يمكن أيضاً اختيار «حفظ كـ PDF».</p>
      </div>
    </Sheet>
  )
}

/** مفتاح تشغيل بسيط داخل نوافذ الطباعة */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5">
      <span>
        <span className="block text-[0.9rem] font-semibold text-ink">{label}</span>
        {hint && <span className="block text-[0.76rem] text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
