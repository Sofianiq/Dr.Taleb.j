import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, FileDown, Pencil, Printer, Search, UserRound, Clock3 } from 'lucide-react'
import { EmptyState, Field, PageHeader, Segmented, Sheet, useToast } from '../components/ui'
import { SlotCard } from '../components/SlotCard'
import { SlotEditor } from '../components/SlotEditor'
import { saveSheet } from '../data/actions'
import { useAuth } from '../data/auth'
import { isOccupied, useData } from '../data/store'
import type { SectionKey, Sheet as SheetT, Ward } from '../data/types'
import { SECTIONS, SHIFT_OPTIONS } from '../lib/constants'
import { isoDate, numericDate } from '../lib/dates'
import { slotIdOf } from '../lib/ids'
import { WardDoc } from '../print/docs'
import { usePrint } from '../print/PrintProvider'
import { WardEditSheet } from './Resident'

type Filter = 'all' | 'occupied' | 'empty'

export function WardPage() {
  const { wardId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { wards, slots, sheets } = useData()
  const { isAdmin } = useAuth()
  const ward = wards.find((w) => w.id === wardId)
  const section: SectionKey = params.get('s') === 'icu' ? 'icu' : 'rooms'
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [wardEdit, setWardEdit] = useState<Ward | null>(null)

  const counts = useMemo(() => {
    if (!ward) return { rooms: 0, icu: 0 }
    let rooms = 0
    let icu = 0
    for (let i = 1; i <= ward.rooms; i++) if (isOccupied(slots[slotIdOf(ward.id, 'rooms', i)])) rooms++
    for (let i = 1; i <= ward.beds; i++) if (isOccupied(slots[slotIdOf(ward.id, 'icu', i)])) icu++
    return { rooms, icu }
  }, [ward, slots])

  if (!ward) return <Navigate to="/resident" replace />

  const total = section === 'rooms' ? ward.rooms : ward.beds
  const sec = SECTIONS[section]
  const sheet = sheets[ward.id]
  const needle = q.trim()
  const indices = Array.from({ length: total }, (_, i) => i + 1).filter((i) => {
    const slot = slots[slotIdOf(ward.id, section, i)]
    const occ = isOccupied(slot)
    if (filter === 'occupied' && !occ) return false
    if (filter === 'empty' && occ) return false
    if (needle) {
      const hay = [slot?.patientName, slot?.doctorName, slot?.operation, slot?.roomNo, String(i)].join(' ')
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const switchSection = (s: SectionKey) => {
    setParams(s === 'icu' ? { s: 'icu' } : {}, { replace: true })
    setFilter('all')
    setQ('')
  }

  return (
    <div className="anim-fade-up">
      <PageHeader
        back="/resident"
        title={
          <span className="flex items-center gap-2">
            ردهة {ward.number}
            {ward.name && <span className="truncate text-[0.95rem] font-semibold text-muted">— {ward.name}</span>}
          </span>
        }
        subtitle="استمارة متابعة المرضى والعمليات"
        actions={
          <>
            {isAdmin && (
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWardEdit(ward)} aria-label="تعديل الردهة">
                <Pencil size={18} />
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setPrintOpen(true)} aria-label="طباعة / PDF">
              <Printer size={18} />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </button>
          </>
        }
      />

      <Segmented<SectionKey>
        value={section}
        onChange={switchSection}
        className="mb-3"
        options={(['rooms', 'icu'] as SectionKey[]).map((k) => ({
          value: k,
          label: (
            <span className="flex flex-col items-center leading-tight sm:flex-row sm:gap-1.5">
              <span>
                {SECTIONS[k].letter} — {SECTIONS[k].title}
              </span>
              <span className="text-[0.72rem] font-medium opacity-80 tabular-nums">
                ({counts[k]}/{k === 'rooms' ? ward.rooms : ward.beds})
              </span>
            </span>
          ),
        }))}
      />

      {/* ترويسة الاستمارة */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="card mb-4 grid w-full grid-cols-3 divide-x divide-line overflow-hidden text-start transition hover:border-brand/40"
      >
        {[
          { icon: <CalendarDays size={15} />, label: 'التاريخ', value: sheet?.date ? numericDate(sheet.date) : '' },
          { icon: <Clock3 size={15} />, label: 'الشفت', value: sheet?.shift ?? '' },
          { icon: <UserRound size={15} />, label: 'المقيم الدوري', value: sheet?.resident ?? '' },
        ].map((m) => (
          <div key={m.label} className="min-w-0 px-3 py-2.5">
            <div className="flex items-center gap-1 text-[0.72rem] font-semibold text-muted">
              {m.icon}
              {m.label}
            </div>
            <div className={`truncate text-[0.88rem] font-bold ${m.value ? 'text-ink' : 'text-muted/60'}`}>{m.value || 'اضغط للتعبئة'}</div>
          </div>
        ))}
      </button>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={17} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted" />
          <input
            className="input min-h-10 ps-9 text-[0.92rem]"
            placeholder={`بحث في ${sec.short} (اسم، طبيب، عملية...)`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              ['all', 'الكل'],
              ['occupied', 'المشغولة'],
              ['empty', 'الفارغة'],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`chip min-h-9 px-3 text-[0.8rem] ${filter === k ? 'bg-ink text-bg' : 'bg-surface-3 text-ink-2'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {indices.length === 0 ? (
        <EmptyState icon={<Search size={26} />} title="لا توجد نتائج">
          جرّب تغيير كلمة البحث أو عامل التصفية.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {indices.map((i) => (
            <SlotCard key={i} section={section} index={i} slot={slots[slotIdOf(ward.id, section, i)]} onOpen={() => setEditing(i)} />
          ))}
        </div>
      )}

      <SlotEditor
        ward={ward}
        section={section}
        index={editing}
        slot={editing !== null ? slots[slotIdOf(ward.id, section, editing)] : undefined}
        onClose={() => setEditing(null)}
      />
      <SheetHeaderEditor open={sheetOpen} onClose={() => setSheetOpen(false)} ward={ward} sheet={sheet} />
      <PrintSheet open={printOpen} onClose={() => setPrintOpen(false)} ward={ward} section={section} />
      <WardEditSheet ward={wardEdit} onClose={() => setWardEdit(null)} />
    </div>
  )
}

function SheetHeaderEditor({ open, onClose, ward, sheet }: { open: boolean; onClose: () => void; ward: Ward; sheet?: SheetT }) {
  const toast = useToast()
  const { today } = useData()
  const [form, setForm] = useState<SheetT>({ date: '', shift: '', resident: '' })

  useEffect(() => {
    if (open)
      setForm({
        date: sheet?.date || isoDate(),
        shift: sheet?.shift || '',
        resident: sheet?.resident || today.assignments.resident || '',
      })
  }, [open, sheet, today.assignments.resident])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveSheet(ward.id, form).catch(() => toast('تعذّر الحفظ', 'error'))
    toast('تم حفظ معلومات الشفت')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="معلومات الاستمارة" subtitle={`ردهة ${ward.number} — تظهر في رأس الاستمارة المطبوعة`}>
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Field label="التاريخ">
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <div>
          <div className="field-label" id="shift-label">الشفت</div>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-labelledby="shift-label">
            {SHIFT_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, shift: s })}
                className={`chip min-h-9 px-3.5 text-[0.85rem] ${form.shift === s ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-2'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <input className="input" aria-labelledby="shift-label" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} maxLength={40} />
        </div>
        <Field label="المقيم الدوري">
          <input className="input" value={form.resident} onChange={(e) => setForm({ ...form, resident: e.target.value })} maxLength={120} placeholder="د. " />
        </Field>
        <button type="submit" className="btn btn-primary w-full">حفظ</button>
      </form>
    </Sheet>
  )
}

function PrintSheet({ open, onClose, ward, section }: { open: boolean; onClose: () => void; ward: Ward; section: SectionKey }) {
  const { slots, sheets } = useData()
  const printer = usePrint()
  const [which, setWhich] = useState<'current' | 'both'>('current')
  const [onlyOccupied, setOnlyOccupied] = useState(false)

  const sections: SectionKey[] = which === 'both' ? ['rooms', 'icu'] : [section]
  const doc = <WardDoc ward={ward} sections={sections} slots={slots} sheet={sheets[ward.id]} onlyOccupied={onlyOccupied} />
  // أسماء ملفات لاتينية لأن بعض المتصفحات ترفض الأسماء العربية عند التنزيل
  const filename = `DrTJPH-Ward-${ward.order}-${which === 'both' ? 'AB' : SECTIONS[section].letter}-${isoDate()}`

  return (
    <Sheet open={open} onClose={onClose} title="طباعة الاستمارة" subtitle={`ردهة ${ward.number} — بتنسيق A4 جاهز للطباعة`}>
      <div className="space-y-4 pb-2">
        <div>
          <div className="field-label">المحتوى</div>
          <Segmented
            value={which}
            onChange={setWhich}
            options={[
              { value: 'current', label: `${SECTIONS[section].letter} — ${SECTIONS[section].title}` },
              { value: 'both', label: 'القسمان A و B' },
            ]}
          />
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <span>
            <span className="block font-semibold">المشغولة فقط</span>
            <span className="block text-[0.8rem] text-muted">بدون تفعيل الخيار تُطبع جميع البطاقات (الفارغة صالحة للكتابة اليدوية)</span>
          </span>
          <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={onlyOccupied} onChange={(e) => setOnlyOccupied(e.target.checked)} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className="btn btn-primary"
            disabled={printer.busy}
            onClick={() => {
              onClose()
              printer.print(doc, filename)
            }}
          >
            <Printer size={18} />
            طباعة
          </button>
          <button
            type="button"
            className="btn btn-soft"
            disabled={printer.busy}
            onClick={() => {
              onClose()
              printer.pdf(doc, filename)
            }}
          >
            <FileDown size={18} />
            ملف PDF
          </button>
        </div>
        <p className="text-center text-[0.78rem] text-muted">
          من نافذة الطباعة يمكنك أيضاً اختيار «حفظ كـ PDF».
        </p>
      </div>
    </Sheet>
  )
}
