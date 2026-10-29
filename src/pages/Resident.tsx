import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, CalendarClock, DoorOpen, HeartPulse, LayoutGrid, Megaphone, Pencil, Stethoscope, Users } from 'lucide-react'
import { Field, PageHeader, Sheet, StatTile, useToast } from '../components/ui'
import { useAuth } from '../data/auth'
import { saveWard } from '../data/actions'
import { isOccupied, useData } from '../data/store'
import type { Ward } from '../data/types'
import { currentShiftDate, longDate, prettyTime } from '../lib/dates'
import { slotIdOf } from '../lib/ids'

export function useWardOccupancy() {
  const { wards, slots } = useData()
  return useMemo(() => {
    const map: Record<string, { rooms: number; icu: number }> = {}
    for (const w of wards) map[w.id] = { rooms: 0, icu: 0 }
    for (const w of wards) {
      for (let i = 1; i <= w.rooms; i++) if (isOccupied(slots[slotIdOf(w.id, 'rooms', i)])) map[w.id].rooms++
      for (let i = 1; i <= w.beds; i++) if (isOccupied(slots[slotIdOf(w.id, 'icu', i)])) map[w.id].icu++
    }
    return map
  }, [wards, slots])
}

export function ResidentPage() {
  const { wards, today, settings, announcements } = useData()
  const { isAdmin } = useAuth()
  const occupancy = useWardOccupancy()
  const [editing, setEditing] = useState<Ward | null>(null)

  const totals = useMemo(() => {
    let rooms = 0
    let icu = 0
    let capacity = 0
    for (const w of wards) {
      rooms += occupancy[w.id]?.rooms ?? 0
      icu += occupancy[w.id]?.icu ?? 0
      capacity += w.rooms + w.beds
    }
    return { rooms, icu, capacity }
  }, [wards, occupancy])

  const resident = today.assignments.resident
  const urgent = announcements.find((a) => a.level !== 'normal')
  const shiftDate = currentShiftDate(settings.shiftStart)

  return (
    <div className="anim-fade-up">
      <PageHeader title="الطبيب المقيم" subtitle="متابعة المرضى والعمليات في الردهات" icon={<Stethoscope size={22} />} />

      {/* خفارة اليوم */}
      <Link
        to="/shifts"
        className="relative mb-4 flex items-center gap-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-l from-[#0b6a40] to-[#14935a] p-4 text-white shadow-card"
      >
        <div className="pattern-bg absolute inset-0 opacity-60" />
        <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
          <CalendarClock size={24} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="text-[0.78rem] text-white/75">
            خفارة اليوم — {longDate(shiftDate)}
          </div>
          <div className="truncate font-display text-[1.08rem] font-bold">
            {resident ? `المقيم الخافر: ${resident}` : 'لم يُحدَّد المقيم الخافر بعد'}
          </div>
          <div className="text-[0.75rem] text-white/70">تبدأ الخفارة الساعة {prettyTime(settings.shiftStart)} ولمدة ٢٤ ساعة</div>
        </div>
      </Link>

      {urgent && (
        <Link
          to="/admin"
          className={`mb-4 flex items-start gap-3 rounded-2xl border p-3.5 ${
            urgent.level === 'urgent' ? 'border-accent/30 bg-accent-soft text-accent' : 'border-warn/30 bg-warn-soft text-warn'
          }`}
        >
          <Megaphone size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold">{urgent.title}</div>
            {urgent.body && <div className="line-clamp-2 text-[0.86rem] opacity-90">{urgent.body}</div>}
          </div>
        </Link>
      )}

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <StatTile label="غرف مشغولة" value={totals.rooms} icon={<DoorOpen size={20} />} />
        <StatTile label="أسرّة الإنعاش" value={totals.icu} icon={<HeartPulse size={20} />} tone="accent" />
        <StatTile label="إجمالي المرضى" value={totals.rooms + totals.icu} icon={<Users size={20} />} tone="info" />
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <LayoutGrid size={19} className="text-brand" />
            الردهات
          </h2>
          <p className="text-[0.82rem] text-muted">
            {wards.length} ردهة — اضغط على الردهة لعرض الغرف والأسرّة
            {isAdmin && '، وعلى ✎ لتعديل رقمها'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
        {wards.map((w) => {
          const occ = occupancy[w.id] ?? { rooms: 0, icu: 0 }
          const total = occ.rooms + occ.icu
          const cap = w.rooms + w.beds
          return (
            <div key={w.id} className="relative">
              <Link
                to={`/resident/ward/${w.id}`}
                className="card group relative flex aspect-square flex-col items-center justify-center overflow-hidden p-2 text-center transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card active:scale-[0.98]"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-brand to-brand-2 opacity-80" />
                <span className="text-[0.72rem] font-semibold text-muted">ردهة</span>
                <span className="font-display text-[2rem] font-extrabold leading-none text-brand-ink tabular-nums sm:text-[2.3rem]" dir="auto">
                  {w.number}
                </span>
                {w.name && <span className="mt-1 line-clamp-1 max-w-full px-1 text-[0.7rem] font-medium text-ink-2">{w.name}</span>}
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold tabular-nums ${
                    total ? 'bg-brand-soft text-brand-ink' : 'bg-surface-3 text-muted'
                  }`}
                >
                  <BedDouble size={12} />
                  {total}/{cap}
                </span>
              </Link>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setEditing(w)}
                  className="absolute end-1.5 top-2.5 grid size-8 place-items-center rounded-full bg-surface/90 text-muted shadow-soft ring-1 ring-line transition hover:text-brand"
                  aria-label={`تعديل الردهة ${w.number}`}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <WardEditSheet ward={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export function WardEditSheet({ ward, onClose }: { ward: Ward | null; onClose: () => void }) {
  const toast = useToast()
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [rooms, setRooms] = useState(20)
  const [beds, setBeds] = useState(10)

  useEffect(() => {
    if (ward) {
      setNumber(ward.number)
      setName(ward.name)
      setRooms(ward.rooms)
      setBeds(ward.beds)
    }
  }, [ward])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ward) return
    const clamp = (v: number) => Math.max(1, Math.min(60, Math.floor(v) || 1))
    saveWard(ward.id, { number: number.trim() || String(ward.order), name: name.trim(), rooms: clamp(rooms), beds: clamp(beds) }).catch(() =>
      toast('تعذّر حفظ التعديل — تحقق من الصلاحيات', 'error'),
    )
    toast('تم حفظ بيانات الردهة')
    onClose()
  }

  return (
    <Sheet open={!!ward} onClose={onClose} title={`تعديل الردهة ${ward?.number ?? ''}`} subtitle="يظهر التعديل فوراً لجميع المستخدمين">
      <form onSubmit={submit} className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="رقم الردهة">
            <input className="input text-center font-display text-lg font-bold" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={10} required />
          </Field>
          <Field label="اسم الردهة (اختياري)">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="مثال: الجراحة العامة" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="عدد غرف العمليات (A)">
            <input className="input text-center tabular-nums" type="number" inputMode="numeric" min={1} max={60} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} />
          </Field>
          <Field label="عدد أسرّة الإنعاش (B)">
            <input className="input text-center tabular-nums" type="number" inputMode="numeric" min={1} max={60} value={beds} onChange={(e) => setBeds(Number(e.target.value))} />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary w-full">حفظ</button>
      </form>
    </Sheet>
  )
}
