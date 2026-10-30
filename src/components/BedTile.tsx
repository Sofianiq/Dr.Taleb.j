import { bedLabel, hasPatient } from '../data/store'
import type { Bed, Ward } from '../data/types'
import { STATUS, UNITS, VITALS } from '../lib/constants'
import { ageLabel, stayDay, timeAgo } from '../lib/dates'
import { LEVEL_TEXT, vitalLevel } from '../lib/vitals'
import { StatusTag, TONE_DOT } from './ui'

/** أهم العلامات الحيوية المسجّلة لعرضها مختصرة */
export function vitalsSummary(ward: Ward, bed: Bed, max = 4) {
  return ward.vitals
    .filter((k) => bed.vitals[k])
    .slice(0, max)
    .map((k) => ({ key: k, label: VITALS[k].label, value: bed.vitals[k] as string, level: vitalLevel(k, bed.vitals[k], ward.population) }))
}

export function BedTile({ ward, bed, onOpen }: { ward: Ward; bed: Bed; onOpen: () => void }) {
  const unit = UNITS[ward.unit]
  const occupied = hasPatient(bed)
  const critical = bed.status === 'critical'

  const head = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-baseline gap-1.5">
        <span className="num text-[1.02rem] font-bold text-ink">{bedLabel(bed)}</span>
        <span className="text-[0.74rem] text-muted">{unit.one}</span>
      </span>
      <StatusTag status={bed.status} />
    </div>
  )

  if (!occupied) {
    const tone = STATUS[bed.status].tone
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[8.25rem] flex-col rounded-[10px] border border-line bg-surface-2 p-3 text-start transition-colors hover:border-line-strong hover:bg-surface"
        aria-label={`${unit.one} ${bedLabel(bed)} — ${STATUS[bed.status].label}`}
      >
        {head}
        <div className="mt-auto flex items-center gap-2 text-[0.8rem] text-muted">
          <span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />
          {bed.status === 'empty' ? 'متاح لإدخال مريض' : bed.status === 'reserved' ? 'محجوز لمريض قادم' : 'غير متاح مؤقتاً'}
        </div>
      </button>
    )
  }

  const vitals = vitalsSummary(ward, bed, 3)
  const admitted = bed.admittedAt?.toDate() ?? null
  const day = stayDay(admitted)
  const vitalsAt = bed.vitalsAt?.toDate() ?? null
  const meta = [ageLabel(bed.age), bed.sex, bed.doctorName].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${unit.one} ${bedLabel(bed)} — ${bed.patientName}`}
      className={`flex min-h-[8.25rem] flex-col rounded-[10px] border bg-surface p-3 text-start transition-colors ${
        critical ? 'border-critical/45 hover:border-critical' : 'border-line hover:border-line-strong'
      } ${bed.pending ? 'ring-2 ring-warn/30' : ''}`}
    >
      {head}
      <div className="mt-2 truncate text-[0.95rem] font-bold text-ink">{bed.patientName}</div>
      <div className="truncate text-[0.76rem] text-muted">{meta || bed.procedure || '—'}</div>
      {vitals.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[0.74rem]" dir="ltr">
          {vitals.map((v) => (
            <span key={v.key} className="whitespace-nowrap">
              <span className="text-faint">{v.label} </span>
              <span className={`font-semibold tabular-nums ${LEVEL_TEXT[v.level]}`}>{v.value}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[0.74rem] text-faint">لا توجد علامات حيوية مسجّلة</div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[0.7rem] text-faint">
        <span>{day ? `اليوم ${day}` : ''}</span>
        <span className="truncate">{bed.pending ? 'بانتظار المزامنة…' : vitalsAt ? `قراءة ${timeAgo(vitalsAt)}` : ''}</span>
      </div>
    </button>
  )
}
