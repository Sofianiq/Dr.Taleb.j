import { Clock, Plus } from 'lucide-react'
import type { SectionKey, Slot } from '../data/types'
import { SECTIONS } from '../lib/constants'
import { timeAgo } from '../lib/dates'
import { twoDigits } from '../lib/ids'
import { vitalLevel, type VitalLevel } from '../lib/vitals'

const LEVEL_CLASS: Record<VitalLevel, string> = {
  none: 'bg-surface-3 text-ink-2',
  ok: 'bg-brand-soft text-brand-ink',
  warn: 'bg-warn-soft text-warn',
  alert: 'bg-accent-soft text-accent',
}

export function slotLabel(section: SectionKey, index: number, slot?: Slot) {
  const s = SECTIONS[section]
  return `${s.unit} / ${s.code}: ${slot?.roomNo || twoDigits(index)}`
}

export function SlotCard({
  section,
  index,
  slot,
  onOpen,
}: {
  section: SectionKey
  index: number
  slot?: Slot
  onOpen: () => void
}) {
  const occupied = !!slot && slot.patientName.trim() !== ''
  const sec = SECTIONS[section]
  const updated = slot?.updatedAt?.toDate?.() ?? null

  const header = (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`rounded-lg px-2.5 py-1 text-[0.8rem] font-bold ${
          section === 'icu' ? 'bg-accent-soft text-accent' : 'bg-info-soft text-info'
        }`}
      >
        {slotLabel(section, index, slot)}
      </span>
      <span className="font-display text-[0.8rem] font-bold text-muted/70 tabular-nums" dir="ltr">
        #{twoDigits(index)}
      </span>
    </div>
  )

  if (!occupied) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[9.5rem] flex-col rounded-[1.1rem] border-[1.5px] border-dashed border-line-strong bg-surface/60 p-3.5 text-start transition hover:border-brand/50 hover:bg-surface"
      >
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3 text-muted">
          <span className="grid size-9 place-items-center rounded-full bg-surface-3">
            <Plus size={18} />
          </span>
          <span className="text-[0.84rem] font-medium">
            {sec.unit === 'سرير' ? 'سرير فارغ' : 'غرفة فارغة'} — اضغط لإضافة مريض
          </span>
        </div>
      </button>
    )
  }

  const vitals: { key: string; label: string; value: string; level: VitalLevel }[] = [
    { key: 'bp', label: 'BP', value: slot.bp, level: vitalLevel('bp', slot.bp) },
    { key: 'pulse', label: 'Pulse', value: slot.pulse, level: vitalLevel('pulse', slot.pulse) },
    { key: 'spo2', label: 'SpO₂', value: slot.spo2, level: vitalLevel('spo2', slot.spo2) },
    { key: 'drain', label: 'Drain', value: slot.drain, level: 'none' },
    { key: 'uop', label: 'UOP', value: slot.uop, level: 'none' },
  ]

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`card relative flex flex-col overflow-hidden p-3.5 text-start transition hover:-translate-y-0.5 hover:shadow-card ${
        slot.pending ? 'ring-2 ring-warn/40' : ''
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-[3px] ${section === 'icu' ? 'bg-accent' : 'bg-info'}`} />
      {header}
      <dl className="mt-2.5 space-y-1 text-[0.9rem]">
        <Row label="اسم المريض" value={slot.patientName} strong />
        <Row label="الطبيب المختص" value={slot.doctorName} />
        <Row label="نوع العملية" value={slot.operation} />
      </dl>
      <div className="mt-2.5 flex flex-wrap gap-1.5" dir="ltr">
        {vitals.map((v) => (
          <span key={v.key} className={`chip font-mono text-[0.72rem] ${LEVEL_CLASS[v.value ? v.level : 'none']} ${v.value ? '' : 'opacity-55'}`}>
            <span className="font-sans opacity-75">{v.label}</span>
            <span className="tabular-nums">{v.value || '—'}</span>
          </span>
        ))}
      </div>
      {slot.notes && (
        <p className="mt-2.5 line-clamp-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[0.83rem] leading-relaxed text-ink-2">
          {slot.notes}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 text-[0.72rem] text-muted">
        <Clock size={12} />
        {slot.pending ? 'بانتظار المزامنة…' : updated ? `آخر تحديث ${timeAgo(updated)}` : ''}
        {slot.updatedBy && !slot.pending && <span>• {slot.updatedBy}</span>}
      </div>
    </button>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd className={`min-w-0 truncate ${strong ? 'font-bold text-ink' : 'text-ink-2'}`}>{value || '—'}</dd>
    </div>
  )
}
