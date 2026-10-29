import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Copy, FileDown, NotebookPen, Pencil, Printer } from 'lucide-react'
import { WhatsAppIcon } from '../components/Contacts'
import { Field, PageHeader, Sheet, Spinner, useConfirm, useToast } from '../components/ui'
import { copyShiftMonth, setShiftDay, setShiftNote } from '../data/actions'
import { useAuth } from '../data/auth'
import { useData, useShiftMonth } from '../data/store'
import type { ShiftDay } from '../data/types'
import { daysInMonth, isWeekend, monthTitle, prettyTime, shiftMonth, weekdayOf } from '../lib/dates'
import { whatsappUrl } from '../lib/phone'
import { ShiftDoc } from '../print/docs'
import { usePrint } from '../print/PrintProvider'
import { findContactByName } from './Staff'

export function ShiftsPage() {
  const { today, settings, contacts } = useData()
  const { isAdmin } = useAuth()
  const [month, setMonth] = useState(today.monthId)
  const { data, loading } = useShiftMonth(month)
  const [editDay, setEditDay] = useState<number | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const printer = usePrint()
  const toast = useToast()
  const confirm = useConfirm()
  const todayRef = useRef<HTMLDivElement>(null)
  const isCurrent = month === today.monthId
  const days = daysInMonth(month)
  const positions = settings.positions

  useEffect(() => {
    if (isCurrent && !loading) todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [isCurrent, loading])

  const filled = data?.days ? Object.values(data.days).filter((d) => Object.values(d ?? {}).some(Boolean)).length : 0

  const printDoc = <ShiftDoc month={month} data={data} positions={positions} shiftStart={settings.shiftStart} />
  const filename = `DrTJPH-OnCall-${month}`

  const copyPrevious = async () => {
    const prevId = shiftMonth(month, -1)
    const ok = await confirm({
      title: 'نسخ جدول الشهر السابق',
      message: `سيتم نسخ أسماء الخفارات من ${monthTitle(prevId)} إلى ${monthTitle(month)} حسب رقم اليوم (الأيام المعبأة حالياً سيُعاد كتابتها).`,
      confirmLabel: 'نسخ',
    })
    if (!ok) return
    try {
      const copied = await copyShiftMonth(prevId, month, days)
      toast(copied ? 'تم نسخ الجدول' : 'لا يوجد جدول في الشهر السابق', copied ? 'success' : 'info')
    } catch {
      toast('تعذّر نسخ الجدول', 'error')
    }
  }

  return (
    <div className="anim-fade-up">
      <PageHeader
        title="الكولات (الخفارات)"
        subtitle={`خفارة ٢٤ ساعة تبدأ ${prettyTime(settings.shiftStart)} — على مدار الشهر`}
        icon={<CalendarClock size={22} />}
        actions={
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => printer.print(printDoc, filename)} aria-label="طباعة الجدول" disabled={loading}>
            <Printer size={18} />
          </button>
        }
      />

      {/* التنقل بين الأشهر */}
      <div className="card mb-4 flex items-center gap-2 p-2">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="الشهر السابق">
          <ChevronRight size={20} />
        </button>
        <div className="flex-1 text-center">
          <div className="font-display text-[1.08rem] font-bold">{monthTitle(month)}</div>
          <div className="text-[0.75rem] text-muted">
            {loading ? 'جارٍ التحميل…' : `${filled} من ${days} يوماً معبأ`}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="الشهر التالي">
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {!isCurrent && (
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setMonth(today.monthId)}>
            العودة إلى الشهر الحالي
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => printer.pdf(printDoc, filename)} disabled={loading}>
          <FileDown size={16} />
          ملف PDF
        </button>
        {isAdmin && (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNoteOpen(true)}>
              <NotebookPen size={16} />
              ملاحظة الشهر
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyPrevious}>
              <Copy size={16} />
              نسخ من الشهر السابق
            </button>
          </>
        )}
      </div>

      {data?.note && (
        <div className="mb-4 rounded-2xl border border-info/25 bg-info-soft px-4 py-3 text-[0.9rem] text-info">
          <b>ملاحظة: </b>
          {data.note}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-brand">
          <Spinner size={28} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const isToday = isCurrent && d === today.day
            const assign = data?.days?.[String(d)] ?? {}
            const any = positions.some((p) => assign[p.id])
            return (
              <div
                key={d}
                ref={isToday ? todayRef : undefined}
                className={`card overflow-hidden ${isToday ? 'border-brand/60 ring-2 ring-brand/30' : ''}`}
              >
                <div
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 ${
                    isToday ? 'bg-brand text-on-brand' : isWeekend(month, d) ? 'bg-coral-soft' : 'bg-surface-2'
                  }`}
                >
                  <span className={`grid size-9 place-items-center rounded-xl font-display text-[1.05rem] font-bold tabular-nums ${isToday ? 'bg-white/20' : 'bg-surface text-ink'}`}>
                    {d}
                  </span>
                  <span className="flex-1 font-bold">{weekdayOf(month, d)}</span>
                  {isToday && <span className="chip bg-white/20 text-[0.72rem]">خفارة اليوم</span>}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditDay(d)}
                      className={`grid size-8 place-items-center rounded-lg ${isToday ? 'hover:bg-white/20' : 'text-muted hover:bg-surface-3 hover:text-brand'}`}
                      aria-label={`تعديل خفارة يوم ${d}`}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
                {any ? (
                  <dl className="divide-y divide-line">
                    {positions.map((p) => {
                      const name = assign[p.id]
                      if (!name) return null
                      const c = findContactByName(contacts, name)
                      return (
                        <div key={p.id} className="flex items-center gap-2 px-3.5 py-1.5 text-[0.86rem]">
                          <dt className="w-[42%] shrink-0 truncate text-muted">{p.label}</dt>
                          <dd className="min-w-0 flex-1 truncate font-semibold text-ink">{name}</dd>
                          {c && (
                            <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" className="grid size-7 shrink-0 place-items-center rounded-lg text-wa hover:bg-surface-3" aria-label={`مراسلة ${name} عبر واتساب`}>
                              <WhatsAppIcon size={16} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </dl>
                ) : (
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setEditDay(d)}
                    className="w-full px-3.5 py-4 text-center text-[0.84rem] text-muted enabled:hover:text-brand"
                  >
                    {isAdmin ? '+ تعيين الخفارة' : 'لم تُحدَّد الخفارة بعد'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <DayEditor month={month} day={editDay} assignments={editDay ? data?.days?.[String(editDay)] ?? {} : {}} onClose={() => setEditDay(null)} />
      <NoteEditor open={noteOpen} onClose={() => setNoteOpen(false)} month={month} note={data?.note ?? ''} />
    </div>
  )
}

function DayEditor({ month, day, assignments, onClose }: { month: string; day: number | null; assignments: ShiftDay; onClose: () => void }) {
  const { settings, contacts } = useData()
  const toast = useToast()
  const [form, setForm] = useState<ShiftDay>({})

  useEffect(() => {
    // نعيد التهيئة عند فتح يوم جديد فقط
    if (day !== null) setForm({ ...assignments })
  }, [day]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (day === null) return
    const clean: ShiftDay = {}
    for (const p of settings.positions) clean[p.id] = (form[p.id] ?? '').trim()
    setShiftDay(month, day, clean).catch(() => toast('تعذّر الحفظ — هذه الميزة للإدارة فقط', 'error'))
    toast('تم حفظ خفارة اليوم')
    onClose()
  }

  return (
    <Sheet
      open={day !== null}
      onClose={onClose}
      title={day ? `خفارة ${weekdayOf(month, day)} ${day} ${monthTitle(month)}` : ''}
      subtitle="اكتب الاسم أو اختره من دليل الهواتف"
      footer={
        <button type="submit" form="day-form" className="btn btn-primary w-full">
          حفظ
        </button>
      }
    >
      <form id="day-form" onSubmit={submit} className="grid gap-3 pb-2 sm:grid-cols-2">
        {settings.positions.map((p) => (
          <Field key={p.id} label={p.label}>
            <input className="input" list="contact-names" value={form[p.id] ?? ''} onChange={(e) => setForm({ ...form, [p.id]: e.target.value })} maxLength={80} />
          </Field>
        ))}
        <datalist id="contact-names">
          {contacts.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
      </form>
    </Sheet>
  )
}

function NoteEditor({ open, onClose, month, note }: { open: boolean; onClose: () => void; month: string; note: string }) {
  const toast = useToast()
  const [value, setValue] = useState(note)
  useEffect(() => {
    if (open) setValue(note)
  }, [open, note])
  return (
    <Sheet open={open} onClose={onClose} title={`ملاحظة جدول ${monthTitle(month)}`} subtitle="تظهر أعلى الجدول وفي النسخة المطبوعة">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setShiftNote(month, value).catch(() => toast('تعذّر الحفظ', 'error'))
          toast('تم حفظ الملاحظة')
          onClose()
        }}
        className="space-y-4 pb-2"
      >
        <textarea className="input" rows={4} value={value} onChange={(e) => setValue(e.target.value)} maxLength={500} />
        <button type="submit" className="btn btn-primary w-full">
          حفظ
        </button>
      </form>
    </Sheet>
  )
}
