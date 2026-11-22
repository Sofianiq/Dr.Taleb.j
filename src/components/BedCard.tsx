import { useEffect, useRef, type RefObject } from 'react'
import { AlertTriangle, Check, Clock, CloudUpload, Plus, Timer, UserPlus } from 'lucide-react'
import { bedLabel, hasPatient } from '../data/store'
import type { Bed, PatientFlag, Ward } from '../data/types'
import { hasAllergy, shortProcedureLabel, STATUS, UNITS, VITALS } from '../lib/constants'
import { ageLabel, agoShort, durationAr, stayDay } from '../lib/dates'
import { formatVital, vitalsDue, vitalStatus, type DueState } from '../lib/vitals'
import { FLAG_CHIP, StatusTag } from './ui'

interface BedCardProps {
  ward: Ward
  bed: Bed
  /** كتالوج العلامات السريعة (من الإعدادات) */
  flags: PatientFlag[]
  now: number
  onOpen: () => void
  onVitals: () => void
  onAdmit: () => void
  onCleaned: () => void
}

/** وميض خفيف حول البطاقة عند وصول تعديل جديد من جهاز آخر */
function useRemoteFlash(ref: RefObject<HTMLElement | null>, bed: Bed) {
  const stamp = bed.updatedAt?.toMillis() ?? 0
  const pending = !!bed.pending
  const prev = useRef({ stamp, pending })
  useEffect(() => {
    const p = prev.current
    prev.current = { stamp, pending }
    // نتجاهل تعديلات هذا الجهاز (المعلّقة) وتأكيد الخادم لها، والبيانات القديمة التي تصل عند فتح الصفحة
    if (stamp === p.stamp || pending || p.pending || Math.abs(Date.now() - stamp) > 60_000) return
    const el = ref.current
    if (!el?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const color = getComputedStyle(el).getPropertyValue('--brand').trim() || '#0b6b45'
    el.animate(
      [{ outline: `3px solid ${color}` }, { outline: `3px solid ${color}`, offset: 0.45 }, { outline: '3px solid transparent' }],
      { duration: 1800, easing: 'ease-out' },
    )
  }, [stamp, pending, ref])
}

function Spine({ ward, bed }: { ward: Ward; bed: Bed }) {
  const label = bedLabel(bed)
  const size = label.length <= 3 ? '' : label.length <= 5 ? 'text-[1.05rem]' : 'text-[0.8rem] break-all'
  return (
    <div className="bed-spine" aria-hidden="true">
      <span className={`bed-no ${size}`}>{label}</span>
      <span className="bed-unit">{UNITS[ward.unit].one}</span>
    </div>
  )
}

const DUE_TONE: Record<DueState, string> = { off: 'text-muted', ok: 'text-muted', due: 'text-warn', late: 'text-critical' }

/** نص آخر قراءة في أسفل البطاقة */
function readingLine(bed: Bed, now: number): string {
  const at = bed.vitalsAt?.toDate()
  if (!at) return 'لم تُسجَّل أي قراءة بعد'
  const by = bed.vitalsBy.split(' — ')[0]
  return `آخر قراءة ${agoShort(at, now)}${by ? ` · ${by}` : ''}`
}

function VitalTiles({ ward, bed }: { ward: Ward; bed: Bed }) {
  if (ward.vitals.length === 0) return null
  if (!ward.vitals.some((k) => bed.vitals[k])) {
    return <div className="bed-vitals rounded-md border border-dashed border-line-strong px-3 py-2 text-[0.78rem] text-muted">لم تُسجَّل علامات حيوية بعد</div>
  }
  return (
    <div className="bed-vitals grid grid-cols-3 gap-1.5" dir="ltr">
      {ward.vitals.map((k) => {
        const value = formatVital(k, bed.vitals[k])
        const st = vitalStatus(k, value, ward.population)
        const tone = st.level === 'alert' ? 'bg-critical-soft text-critical' : st.level === 'warn' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink'
        // النصوص الطويلة (مثل ملاحظات التصريف) تلتف على سطرين بدل قصّها
        const long = value.length > 9
        return (
          <div key={k} className={`min-w-0 rounded-md px-2 py-1 ${tone}`}>
            <div className="text-[0.62rem] font-semibold leading-tight opacity-70">{VITALS[k].label}</div>
            <div className="flex min-w-0 items-baseline gap-0.5 text-[0.95rem] font-bold leading-snug tabular-nums">
              {value ? (
                <span className={long ? 'line-clamp-2 break-words text-[0.78rem] leading-tight' : 'truncate'} dir="auto">
                  {value}
                </span>
              ) : (
                <span className="font-normal text-faint">—</span>
              )}
              {st.dir && (
                <span className="shrink-0 text-[0.78rem]">
                  {st.dir === 'up' ? '↑' : '↓'}
                  <span className="sr-only">{st.dir === 'up' ? ' مرتفع' : ' منخفض'}</span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** بطاقة الغرفة/السرير: مستطيل بعرض الشاشة يعرض كل معلومات المريض */
export function BedCard({ ward, bed, flags, now, onOpen, onVitals, onAdmit, onCleaned }: BedCardProps) {
  const ref = useRef<HTMLElement>(null)
  useRemoteFlash(ref, bed)
  const unit = UNITS[ward.unit]
  const label = bedLabel(bed)

  if (!hasPatient(bed)) {
    const changed = bed.updatedAt?.toDate()
    const since = changed && bed.status !== 'empty' ? ` · منذ ${durationAr(now - changed.getTime())}` : ''
    // عبارات محايدة تصلح للغرفة والسرير والحاضنة
    const desc = bed.status === 'empty' ? 'يمكن إدخال مريض' : bed.status === 'reserved' ? 'حجز لمريض قادم' : 'خارج الخدمة مؤقتاً'
    return (
      <article ref={ref} className="bed-card" data-status={bed.status}>
        <button type="button" className="bed-hit" onClick={onOpen} aria-label={`${unit.one} ${label} — ${STATUS[bed.status].label}`} />
        <Spine ward={ward} bed={bed} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <div className="min-w-[8rem] flex-1">
            <div className={`text-[0.92rem] font-bold ${bed.status === 'empty' ? 'text-ink-2' : 'text-ink'}`}>{STATUS[bed.status].label}</div>
            <div className="truncate text-[0.76rem] text-muted">
              {desc}
              {since}
            </div>
          </div>
          {bed.status === 'cleaning' ? (
            <button type="button" className="bed-action btn btn-secondary btn-sm ms-auto" onClick={onCleaned}>
              <Check size={15} />
              تم التنظيف
            </button>
          ) : (
            <button type="button" className="bed-action btn btn-secondary btn-sm ms-auto" onClick={onAdmit}>
              <UserPlus size={15} />
              إدخال مريض
            </button>
          )}
        </div>
      </article>
    )
  }

  const day = stayDay(bed.admittedAt?.toDate(), new Date(now))
  const meta = [ageLabel(bed.age), bed.sex, day ? `اليوم ${day}` : ''].filter(Boolean)
  const activeFlags = flags.filter((f) => bed.flags.includes(f.id))
  const allergy = hasAllergy(bed.allergies)
  const due = ward.vitals.length ? vitalsDue(ward, bed, now) : 'off'
  const dueAlert = due === 'due' || due === 'late'

  return (
    <article ref={ref} className="bed-card" data-status={bed.status}>
      <button type="button" className="bed-hit" onClick={onOpen} aria-label={`${unit.one} ${label} — ${bed.patientName}، ${STATUS[bed.status].label}`} />
      <Spine ward={ward} bed={bed} />
      <div className="bed-main">
        <div className="bed-body">
          <div className="bed-head flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-[1.02rem] font-bold leading-snug text-ink" dir="auto">
                {bed.patientName}
              </h3>
              {meta.length > 0 && <div className="mt-0.5 text-[0.78rem] text-muted">{meta.join(' · ')}</div>}
            </div>
            <StatusTag status={bed.status} className="mt-0.5 shrink-0" />
          </div>

          {(allergy || dueAlert || activeFlags.length > 0) && (
            <div className="bed-alerts flex flex-wrap gap-1">
              {allergy && (
                <span className="chip border-critical/30 bg-critical-soft text-critical">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span className="truncate">
                    حساسية: <bdi>{bed.allergies}</bdi>
                  </span>
                </span>
              )}
              {dueAlert && (
                <span className={`chip ${due === 'late' ? 'border-critical/30 bg-critical-soft text-critical' : 'border-warn/30 bg-warn-soft text-warn'}`}>
                  <Timer size={12} className="shrink-0" />
                  {due === 'late' ? 'القياس متأخر' : 'حان موعد القياس'}
                </span>
              )}
              {activeFlags.map((f) => (
                <span key={f.id} className={`chip ${FLAG_CHIP[f.tone]}`}>
                  {f.label}
                </span>
              ))}
            </div>
          )}

          <dl className="bed-facts grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[0.84rem] leading-snug">
            <dt className="text-muted">الطبيب</dt>
            <dd className={`truncate font-semibold ${bed.doctorName ? 'text-ink' : 'text-faint'}`} dir="auto">
              {bed.doctorName || '—'}
            </dd>
            <dt className="text-muted">{shortProcedureLabel(ward.procedureLabel)}</dt>
            <dd className={`line-clamp-2 ${bed.procedure ? 'text-ink' : 'text-faint'}`} dir="auto">
              {bed.procedure || '—'}
            </dd>
          </dl>

          <VitalTiles ward={ward} bed={bed} />

          {bed.notes.trim() && (
            <p className="bed-notes line-clamp-2 whitespace-pre-line text-[0.8rem] leading-relaxed text-ink-2">
              <span className="font-semibold text-muted">ملاحظات: </span>
              <bdi>{bed.notes.trim()}</bdi>
            </p>
          )}
        </div>

        <div className="bed-foot">
          {bed.pending ? (
            <>
              <CloudUpload size={14} className="shrink-0 text-warn" />
              <span className="min-w-0 flex-1 truncate text-warn">بانتظار المزامنة…</span>
            </>
          ) : (
            <>
              <Clock size={14} className={`shrink-0 ${DUE_TONE[due]}`} />
              <span className={`min-w-0 flex-1 truncate ${DUE_TONE[due]}`}>{readingLine(bed, now)}</span>
            </>
          )}
          {ward.vitals.length > 0 && (
            <button type="button" className="bed-action btn btn-secondary btn-sm" onClick={onVitals}>
              <Plus size={15} />
              قراءة
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
