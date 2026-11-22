import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardList, Pencil, Printer, Search, Settings2 } from 'lucide-react'
import { BedCard } from '../components/BedCard'
import { BedSheet, type BedTab } from '../components/BedSheet'
import { PrintChoice, Toggle } from '../components/PrintChoice'
import { EmptyState, Field, PageHeader, Sheet, Spinner, useToast } from '../components/ui'
import { WardEditor } from '../components/WardEditor'
import { saveSheet, setFreeBedStatus } from '../data/actions'
import { useAuth } from '../data/auth'
import { bedLabel, hasPatient, useCensus, useData, wardBeds } from '../data/store'
import type { Bed, Sheet as SheetT, Ward } from '../data/types'
import { SHIFT_OPTIONS, UNITS, unitCount } from '../lib/constants'
import { dayMonth, isoDate } from '../lib/dates'
import { useNow } from '../lib/hooks'
import { matchesQuery, patientsCount } from '../lib/text'
import { isDue, vitalsDue } from '../lib/vitals'
import { WardDoc } from '../print/docs'
import { HandoverChoice } from './Resident'

type Filter = 'all' | 'patients' | 'critical' | 'due' | 'discharge' | 'free'

/** السرير المفتوح في النافذة، والتبويب أو الوضع الذي يُفتح عليه */
interface OpenBed {
  index: number
  tab?: BedTab
  mode?: 'admit'
}

export function WardPage() {
  const { wardId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { wards, wardsReady, beds, sheets, settings } = useData()
  const { byWard } = useCensus()
  const { isAdmin, role } = useAuth()
  const toast = useToast()
  const now = useNow()
  const ward = wards.find((w) => w.id === wardId)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<OpenBed | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // الروابط المباشرة إلى سرير (من الاستعلامات والإدارة): ?bed=رقم — تُحوَّل إلى حالة داخلية
  // حتى يعمل زر الرجوع في الهاتف على إغلاق النافذة فقط
  useEffect(() => {
    const index = Number(params.get('bed'))
    if (!index) return
    const tab = params.get('tab')
    setParams({}, { replace: true })
    setOpen({ index, tab: tab === 'vitals' || tab === 'history' ? tab : undefined })
  }, [params, setParams])

  const list = useMemo(() => (ward ? wardBeds(ward, beds) : []), [ward, beds])
  const patients = useMemo(() => list.filter(hasPatient), [list])

  if (!ward) {
    if (wardsReady) return <Navigate to="/resident" replace />
    return (
      <div className="grid place-items-center py-24 text-brand">
        <Spinner size={22} />
      </div>
    )
  }

  const c = byWard[ward.id]
  const unit = UNITS[ward.unit]
  const openBed = open ? list.find((b) => b.index === open.index) ?? null : null

  const filters: { value: Filter; label: string; test: (b: Bed) => boolean; hidden?: boolean }[] = [
    { value: 'all', label: 'الكل', test: () => true },
    { value: 'patients', label: 'المرضى', test: hasPatient },
    { value: 'critical', label: 'حرج', test: (b) => b.status === 'critical' },
    { value: 'due', label: 'بحاجة لقياس', test: (b) => hasPatient(b) && isDue(vitalsDue(ward, b, now)), hidden: !ward.vitalsEvery || ward.vitals.length === 0 },
    { value: 'discharge', label: 'جاهز للخروج', test: (b) => b.status === 'discharge' },
    { value: 'free', label: 'متاح', test: (b) => b.status === 'empty' },
  ]
  const active = filters.find((f) => f.value === filter && !f.hidden) ?? filters[0]
  const shown = list.filter((b) => active.test(b) && matchesQuery(q, [b.patientName, b.doctorName, b.procedure, b.allergies, bedLabel(b)]))
  const sheet = sheets[ward.id]

  const markCleaned = (b: Bed) => {
    if (!role) return
    setFreeBedStatus(ward, b, 'empty', role).catch(() => toast('تعذّر الحفظ — تحقق من الاتصال أو الصلاحيات', 'error'))
    toast(`${unit.one} ${bedLabel(b)}: انتهى التنظيف`)
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/resident', label: 'الردهات' }}
        title={ward.name}
        subtitle={`${unitCount(ward.beds, ward.unit)} · ${patientsCount(c.patients)} · الشاغر ${c.empty}`}
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

      {/* ترويسة الاستمارة: التاريخ والشفت والمقيم الدوري — الضغط في أي مكان يفتح التعديل */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="panel mb-4 grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-stretch overflow-hidden text-start transition-colors hover:border-line-strong"
        aria-label="تعديل معلومات الشفت"
      >
        {[
          ['التاريخ', sheet?.date ? dayMonth(sheet.date) : ''],
          ['الشفت', sheet?.shift ?? ''],
          ['المقيم الدوري', sheet?.resident ?? ''],
        ].map(([label, value], i) => (
          <span key={label} className={`block min-w-0 px-3 py-2.5 sm:px-3.5 ${i > 0 ? 'border-s border-line' : ''}`}>
            <span className="block whitespace-nowrap text-[0.72rem] font-semibold text-muted">{label}</span>
            <span className={`block truncate text-[0.9rem] font-bold ${value ? 'text-ink' : 'text-faint'}`} dir={i === 0 ? 'ltr' : undefined}>
              {value || '—'}
            </span>
          </span>
        ))}
        <span className="grid w-11 place-items-center border-s border-line text-muted">
          <Pencil size={16} />
        </span>
      </button>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {filters
            .filter((f) => !f.hidden)
            .map((f) => {
              const n = list.filter(f.test).length
              const on = active.value === f.value
              const warn = f.value === 'due' && n > 0 && !on
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={on}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[0.82rem] font-semibold ${
                    on ? 'border-ink bg-ink text-surface' : warn ? 'border-warn/40 bg-warn-soft text-warn' : 'border-line-strong bg-surface text-ink-2 hover:border-faint'
                  }`}
                >
                  {f.label}
                  <span className={`tabular-nums ${on ? 'opacity-70' : warn ? '' : 'text-faint'}`}>{n}</span>
                </button>
              )
            })}
        </div>
        <div className="relative sm:ms-auto sm:w-64">
          <Search size={16} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-faint" />
          <input className="input min-h-10 ps-9" placeholder="بحث بالاسم أو الطبيب أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="panel">
          <EmptyState title="لا توجد نتائج">جرّب تغيير عامل التصفية أو كلمة البحث.</EmptyState>
        </div>
      ) : (
        <div className="grid items-start gap-2.5 xl:grid-cols-2">
          {shown.map((b) => (
            <BedCard
              key={b.id}
              ward={ward}
              bed={b}
              flags={settings.flags}
              now={now}
              onOpen={() => setOpen({ index: b.index })}
              onVitals={() => setOpen({ index: b.index, tab: 'vitals' })}
              onAdmit={() => setOpen({ index: b.index, mode: 'admit' })}
              onCleaned={() => markCleaned(b)}
            />
          ))}
        </div>
      )}

      <BedSheet
        ward={ward}
        bed={openBed}
        initialTab={open?.tab}
        initialMode={open?.mode}
        siblings={patients}
        onNavigate={(index, tab) => setOpen({ index, tab })}
        onClose={() => setOpen(null)}
      />
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
                className={`min-h-9 rounded-md border px-3 text-[0.84rem] font-semibold ${form.shift === s ? 'border-ink bg-ink text-surface' : 'border-line-strong text-ink-2'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <input className="input" aria-labelledby="shift-label" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} maxLength={40} />
        </div>
        <Field label="المقيم الدوري">
          <input className="input" value={form.resident} onChange={(e) => setForm({ ...form, resident: e.target.value })} maxLength={120} placeholder="د. " autoComplete="off" />
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
