import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, FileDown, NotebookPen, Printer } from 'lucide-react'
import { WhatsAppIcon } from '../components/Contacts'
import { Field, PageHeader, SectionHeader, Sheet, Spinner, useConfirm, useToast } from '../components/ui'
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
  const todayRow = useRef<HTMLElement | null>(null)
  const todayItem = useRef<HTMLElement | null>(null)
  const isCurrent = month === today.monthId
  const days = daysInMonth(month)
  const positions = settings.positions
  const dayList = Array.from({ length: days }, (_, i) => i + 1)

  useEffect(() => {
    if (!isCurrent || loading) return
    // الجدول للحاسوب والقائمة للهاتف: نمرّر إلى العنصر الظاهر منهما
    const el = [todayRow.current, todayItem.current].find((e) => e && e.offsetParent !== null)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [isCurrent, loading])

  const filled = data?.days ? Object.values(data.days).filter((d) => Object.values(d ?? {}).some(Boolean)).length : 0
  const printDoc = () => <ShiftDoc month={month} data={data} positions={positions} shiftStart={settings.shiftStart} />
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

  const todayAssign = isCurrent ? data?.days?.[String(today.day)] ?? {} : {}
  const wa = (name?: string) => {
    const c = findContactByName(contacts, name)
    return c ? (
      <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" className="text-wa hover:opacity-80" aria-label={`مراسلة ${name} عبر واتساب`}>
        <WhatsAppIcon size={15} />
      </a>
    ) : null
  }

  return (
    <div>
      <PageHeader
        title="الكولات"
        subtitle={`جدول الخفارات الشهري — خفارة ٢٤ ساعة تبدأ ${prettyTime(settings.shiftStart)}`}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => printer.print(printDoc(), filename)} disabled={loading}>
              <Printer size={15} />
              طباعة
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => printer.pdf(printDoc(), filename)} disabled={loading}>
              <FileDown size={15} />
              PDF
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="panel flex items-center">
          <button type="button" className="btn btn-ghost btn-icon rounded-e-none" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="الشهر السابق">
            <ChevronRight size={18} />
          </button>
          <div className="min-w-[9.5rem] border-x border-line px-3 text-center">
            <div className="text-[0.95rem] font-bold">{monthTitle(month)}</div>
            <div className="text-[0.72rem] text-muted">{loading ? 'جارٍ التحميل…' : `${filled} من ${days} يوماً معبأ`}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon rounded-s-none" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="الشهر التالي">
            <ChevronLeft size={18} />
          </button>
        </div>
        {!isCurrent && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMonth(today.monthId)}>
            الشهر الحالي
          </button>
        )}
        {isAdmin && (
          <>
            <span className="flex-1" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNoteOpen(true)}>
              <NotebookPen size={15} />
              ملاحظة الشهر
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyPrevious}>
              <Copy size={15} />
              نسخ من الشهر السابق
            </button>
          </>
        )}
      </div>

      {data?.note && (
        <div className="mb-4 rounded-lg border border-info/25 bg-info-soft px-4 py-2.5 text-[0.88rem] text-info">
          <b>ملاحظة: </b>
          {data.note}
        </div>
      )}

      {isCurrent && !loading && (
        <section className="mb-6">
          <SectionHeader title={`خفارة اليوم — ${weekdayOf(month, today.day)} ${today.day}`} />
          <div className="panel grid overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border-b border-e border-line px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.74rem] text-muted">{p.label}</div>
                  <div className={`truncate font-semibold ${todayAssign[p.id] ? 'text-ink' : 'text-faint'}`}>{todayAssign[p.id] || '—'}</div>
                </div>
                {wa(todayAssign[p.id])}
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-brand">
          <Spinner size={24} />
        </div>
      ) : (
        <>
          {/* جدول (الحاسوب) */}
          <div className="panel hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-[0.84rem]">
              <thead className="sticky top-0 bg-surface-2 text-[0.78rem] text-muted">
                <tr>
                  <th className="w-28 border-b border-line px-3 py-2.5 text-start font-semibold">اليوم</th>
                  {positions.map((p) => (
                    <th key={p.id} className="border-b border-line px-3 py-2.5 text-start font-semibold">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayList.map((d) => {
                  const isToday = isCurrent && d === today.day
                  const assign = data?.days?.[String(d)] ?? {}
                  return (
                    <tr
                      key={d}
                      ref={
                        isToday
                          ? (el) => {
                              todayRow.current = el
                            }
                          : undefined
                      }
                      onClick={isAdmin ? () => setEditDay(d) : undefined}
                      className={`border-b border-line last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-2' : ''} ${
                        isToday ? 'bg-brand-soft' : isWeekend(month, d) ? 'bg-surface-2' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-block w-6 font-bold tabular-nums text-ink">{d}</span>
                        <span className={isToday ? 'font-semibold text-brand-ink' : 'text-muted'}>{weekdayOf(month, d)}</span>
                      </td>
                      {positions.map((p) => (
                        <td key={p.id} className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={assign[p.id] ? 'text-ink' : 'text-faint'}>{assign[p.id] || '—'}</span>
                            {!isAdmin && wa(assign[p.id])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* قائمة الأيام (الهاتف) */}
          <div className="panel divide-y divide-line overflow-hidden md:hidden">
            {dayList.map((d) => {
              const isToday = isCurrent && d === today.day
              const assign = data?.days?.[String(d)] ?? {}
              const any = positions.some((p) => assign[p.id])
              return (
                <div
                  key={d}
                  ref={
                    isToday
                      ? (el) => {
                          todayItem.current = el
                        }
                      : undefined
                  }
                  className={`flex gap-3 px-4 py-3 ${isToday ? 'bg-brand-soft' : isWeekend(month, d) ? 'bg-surface-2' : ''}`}
                >
                  <div className="w-12 shrink-0 text-center">
                    <div className={`text-[1.2rem] font-bold leading-tight tabular-nums ${isToday ? 'text-brand-ink' : 'text-ink'}`}>{d}</div>
                    <div className="text-[0.7rem] text-muted">{weekdayOf(month, d)}</div>
                  </div>
                  <div className="min-w-0 flex-1 border-s border-line ps-3">
                    {any ? (
                      <dl className="space-y-0.5 text-[0.84rem]">
                        {positions.map((p) =>
                          assign[p.id] ? (
                            <div key={p.id} className="flex items-center gap-2">
                              <dt className="w-[45%] shrink-0 truncate text-muted">{p.label}</dt>
                              <dd className="min-w-0 flex-1 truncate font-semibold text-ink">{assign[p.id]}</dd>
                              {wa(assign[p.id])}
                            </div>
                          ) : null,
                        )}
                      </dl>
                    ) : (
                      <div className="py-1 text-[0.84rem] text-faint">لم تُحدَّد الخفارة</div>
                    )}
                    {isAdmin && (
                      <button type="button" className="mt-1.5 text-[0.8rem] font-semibold text-brand-ink" onClick={() => setEditDay(d)} aria-label={`تعديل خفارة يوم ${d}`}>
                        {any ? 'تعديل' : '+ تعيين الخفارة'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
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
        <div className="flex gap-2">
          <button type="submit" form="day-form" className="btn btn-primary">
            حفظ
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      }
    >
      <form id="day-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
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
    <Sheet open={open} onClose={onClose} size="sm" title={`ملاحظة جدول ${monthTitle(month)}`} subtitle="تظهر أعلى الجدول وفي النسخة المطبوعة">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setShiftNote(month, value).catch(() => toast('تعذّر الحفظ', 'error'))
          toast('تم حفظ الملاحظة')
          onClose()
        }}
        className="space-y-4"
      >
        <textarea className="input" rows={4} value={value} onChange={(e) => setValue(e.target.value)} maxLength={500} />
        <button type="submit" className="btn btn-primary w-full">
          حفظ
        </button>
      </form>
    </Sheet>
  )
}
