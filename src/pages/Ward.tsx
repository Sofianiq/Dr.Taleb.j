import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardList, Pencil, Printer, Search, Settings2 } from 'lucide-react'
import { BedSheet } from '../components/BedSheet'
import { BedTile } from '../components/BedTile'
import { PrintChoice, Toggle } from '../components/PrintChoice'
import { EmptyState, Field, PageHeader, Sheet, Spinner, useToast } from '../components/ui'
import { WardEditor } from '../components/WardEditor'
import { saveSheet } from '../data/actions'
import { useAuth } from '../data/auth'
import { bedLabel, hasPatient, useCensus, useData, wardBeds } from '../data/store'
import type { Bed, Sheet as SheetT, Ward } from '../data/types'
import { SHIFT_OPTIONS, unitCount } from '../lib/constants'
import { isoDate, numericDate } from '../lib/dates'
import { WardDoc } from '../print/docs'
import { HandoverChoice } from './Resident'

type Filter = 'all' | 'patients' | 'critical' | 'discharge' | 'free'

const FILTERS: { value: Filter; label: string; test: (b: Bed) => boolean }[] = [
  { value: 'all', label: 'الكل', test: () => true },
  { value: 'patients', label: 'المرضى', test: (b) => hasPatient(b) },
  { value: 'critical', label: 'حرج', test: (b) => b.status === 'critical' },
  { value: 'discharge', label: 'جاهز للخروج', test: (b) => b.status === 'discharge' },
  { value: 'free', label: 'متاح', test: (b) => b.status === 'empty' },
]

export function WardPage() {
  const { wardId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { wards, wardsReady, beds, sheets } = useData()
  const { byWard } = useCensus()
  const { isAdmin } = useAuth()
  const ward = wards.find((w) => w.id === wardId)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const list = useMemo(() => (ward ? wardBeds(ward, beds) : []), [ward, beds])

  if (!ward) {
    if (wardsReady) return <Navigate to="/resident" replace />
    return (
      <div className="grid place-items-center py-24 text-brand">
        <Spinner size={22} />
      </div>
    )
  }

  const c = byWard[ward.id]
  const openIndex = Number(params.get('bed')) || null
  const openBed = openIndex ? list.find((b) => b.index === openIndex) ?? null : null
  const setOpen = (index: number | null) => setParams(index ? { bed: String(index) } : {}, { replace: true })

  const needle = q.trim()
  const shown = list.filter((b) => {
    if (!FILTERS.find((f) => f.value === filter)!.test(b)) return false
    if (!needle) return true
    return [b.patientName, b.doctorName, b.procedure, bedLabel(b)].some((f) => f.includes(needle))
  })
  const sheet = sheets[ward.id]

  return (
    <div>
      <PageHeader
        back={{ to: '/resident', label: 'الردهات' }}
        title={ward.name}
        subtitle={`${unitCount(ward.beds, ward.unit)} · ${c.patients} مريض · ${c.empty} متاح`}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPrintOpen(true)}>
              <Printer size={15} />
              الاستمارة
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHandoverOpen(true)}>
              <ClipboardList size={15} />
              تقرير التسليم
            </button>
            {isAdmin && (
              <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditOpen(true)} aria-label="إعدادات الردهة">
                <Settings2 size={15} />
              </button>
            )}
          </>
        }
      />

      {/* ترويسة الاستمارة: التاريخ والشفت والمقيم الدوري */}
      <div className="panel mb-4 flex items-stretch overflow-hidden">
        {[
          ['التاريخ', sheet?.date ? numericDate(sheet.date) : ''],
          ['الشفت', sheet?.shift ?? ''],
          ['المقيم الدوري', sheet?.resident ?? ''],
        ].map(([label, value], i) => (
          <div key={label} className={`min-w-0 flex-1 px-3.5 py-2.5 ${i > 0 ? 'border-s border-line' : ''}`}>
            <div className="text-[0.72rem] font-semibold text-muted">{label}</div>
            <div className={`truncate text-[0.88rem] font-bold ${value ? 'text-ink' : 'text-faint'}`}>{value || '—'}</div>
          </div>
        ))}
        <button type="button" onClick={() => setSheetOpen(true)} className="grid w-12 shrink-0 place-items-center border-s border-line text-muted hover:bg-surface-2 hover:text-ink" aria-label="تعديل معلومات الشفت">
          <Pencil size={16} />
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map((f) => {
            const n = list.filter(f.test).length
            const active = filter === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[0.82rem] font-semibold ${
                  active ? 'border-ink bg-ink text-surface' : 'border-line-strong bg-surface text-ink-2 hover:border-faint'
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${active ? 'opacity-70' : 'text-faint'}`}>{n}</span>
              </button>
            )
          })}
        </div>
        <div className="relative sm:ms-auto sm:w-64">
          <Search size={16} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-faint" />
          <input className="input min-h-9 ps-9 text-[0.9rem]" placeholder="بحث بالاسم أو الطبيب أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="panel">
          <EmptyState title="لا توجد نتائج">جرّب تغيير عامل التصفية أو كلمة البحث.</EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((b) => (
            <BedTile key={b.id} ward={ward} bed={b} onOpen={() => setOpen(b.index)} />
          ))}
        </div>
      )}

      <BedSheet ward={ward} bed={openBed} onClose={() => setOpen(null)} />
      <SheetHeaderEditor open={sheetOpen} onClose={() => setSheetOpen(false)} ward={ward} sheet={sheet} />
      <WardPrint open={printOpen} onClose={() => setPrintOpen(false)} ward={ward} />
      <HandoverChoice open={handoverOpen} onClose={() => setHandoverOpen(false)} wardId={ward.id} />
      {isAdmin && <WardEditor open={editOpen} onClose={() => setEditOpen(false)} ward={ward} />}
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
    <Sheet open={open} onClose={onClose} size="sm" title="معلومات الشفت" subtitle={`${ward.name} — تظهر في رأس الاستمارة المطبوعة`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="التاريخ">
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <div>
          <div className="field-label" id="shift-label">
            الشفت
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-labelledby="shift-label">
            {SHIFT_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, shift: s })}
                aria-pressed={form.shift === s}
                className={`rounded-md border px-3 py-1.5 text-[0.84rem] font-semibold ${form.shift === s ? 'border-ink bg-ink text-surface' : 'border-line-strong text-ink-2'}`}
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
        <button type="submit" className="btn btn-primary w-full">
          حفظ
        </button>
      </form>
    </Sheet>
  )
}

function WardPrint({ open, onClose, ward }: { open: boolean; onClose: () => void; ward: Ward }) {
  const { beds, sheets } = useData()
  const [onlyOccupied, setOnlyOccupied] = useState(false)
  return (
    <PrintChoice
      open={open}
      onClose={onClose}
      title="استمارة متابعة المرضى"
      subtitle={`${ward.name} — بتنسيق A4 (١٠ بطاقات في الصفحة)`}
      filename={`DrTJPH-${ward.id}-${isoDate()}`}
      build={() => <WardDoc ward={ward} beds={beds} sheet={sheets[ward.id]} onlyOccupied={onlyOccupied} />}
    >
      <Toggle
        checked={onlyOccupied}
        onChange={setOnlyOccupied}
        label="المرضى فقط"
        hint="بدونه تُطبع جميع البطاقات، والفارغة منها صالحة للكتابة اليدوية"
      />
    </PrintChoice>
  )
}
