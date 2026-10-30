import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ClipboardList, Plus, Settings2 } from 'lucide-react'
import { PrintChoice } from '../components/PrintChoice'
import { EmptyState, MetricStrip, PageHeader, SectionHeader, TONE_DOT } from '../components/ui'
import { WardEditor } from '../components/WardEditor'
import { useAuth } from '../data/auth'
import { useCensus, useData, wardBeds } from '../data/store'
import type { BedStatus, Ward } from '../data/types'
import { STATUS, unitCount } from '../lib/constants'
import { currentShiftDate, isoDate, longDate, prettyTime } from '../lib/dates'
import { HandoverDoc } from '../print/docs'

const MAP_TONE: Record<BedStatus, string> = {
  occupied: 'bg-brand',
  critical: 'bg-critical',
  discharge: 'bg-info',
  reserved: 'bg-warn',
  cleaning: 'bg-faint',
  empty: 'bg-surface border border-line-strong',
}

/** خريطة مصغّرة لأسرّة الردهة ملوّنة حسب الحالة */
function BedMap({ ward }: { ward: Ward }) {
  const { beds } = useData()
  return (
    <div className="flex flex-wrap gap-[3px]" aria-hidden="true">
      {wardBeds(ward, beds).map((b) => (
        <span key={b.id} className={`size-3.5 rounded-[3px] ${MAP_TONE[b.status]}`} title={`${b.index} — ${STATUS[b.status].label}`} />
      ))}
    </div>
  )
}

export function WardCard({ ward }: { ward: Ward }) {
  const { byWard } = useCensus()
  const c = byWard[ward.id]
  const pct = c.capacity ? Math.round((c.patients / c.capacity) * 100) : 0
  const flags: { s: BedStatus; n: number }[] = (['critical', 'discharge', 'reserved', 'cleaning'] as BedStatus[])
    .map((s) => ({ s, n: c[s] }))
    .filter((f) => f.n > 0)
  return (
    <Link to={`/resident/ward/${ward.id}`} className="panel group flex flex-col p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[1.02rem] font-bold text-ink">{ward.name}</div>
          <div className="text-[0.78rem] text-muted">{unitCount(ward.beds, ward.unit)}</div>
        </div>
        <ChevronLeft size={18} className="mt-1 shrink-0 text-faint transition-transform group-hover:-translate-x-0.5" />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[1.7rem] font-bold leading-none text-ink tabular-nums">{c.patients}</span>
        <span className="text-[0.86rem] text-muted">/ {c.capacity} مريض</span>
        <span className="ms-auto text-[0.8rem] font-semibold text-muted tabular-nums">{pct}%</span>
      </div>
      <div className="mt-3">
        <BedMap ward={ward} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[0.76rem] text-muted">
        <span>
          متاح: <b className="font-semibold text-ink tabular-nums">{c.empty}</b>
        </span>
        {flags.map((f) => (
          <span key={f.s} className="inline-flex items-center gap-1">
            <span className={`size-1.5 rounded-full ${TONE_DOT[STATUS[f.s].tone]}`} />
            {STATUS[f.s].label}: <b className="font-semibold text-ink tabular-nums">{f.n}</b>
          </span>
        ))}
      </div>
    </Link>
  )
}

export function ResidentPage() {
  const { wards, wardsReady, today, settings, announcements } = useData()
  const { total } = useCensus()
  const { isAdmin } = useAuth()
  const [editorOpen, setEditorOpen] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const resident = today.assignments.resident
  const urgent = announcements.find((a) => a.level !== 'normal')
  const shiftDate = currentShiftDate(settings.shiftStart)

  return (
    <div>
      <PageHeader
        title="الطبيب المقيم"
        subtitle={longDate(new Date())}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHandoverOpen(true)}>
              <ClipboardList size={15} />
              تقرير تسليم الشفت
            </button>
            {isAdmin && (
              <Link to="/admin/wards" className="btn btn-secondary btn-sm">
                <Settings2 size={15} />
                إدارة الردهات
              </Link>
            )}
          </>
        }
      />

      <Link to="/shifts" className="panel mb-4 flex items-center gap-4 px-4 py-3 transition-colors hover:border-line-strong">
        <div className="min-w-0 flex-1">
          <div className="text-[0.76rem] font-semibold text-muted">المقيم الخافر — خفارة {longDate(shiftDate)}</div>
          <div className={`truncate text-[1rem] font-bold ${resident ? 'text-ink' : 'text-faint'}`}>{resident || 'لم يُحدَّد بعد'}</div>
        </div>
        <div className="hidden text-end text-[0.76rem] text-muted sm:block">
          تبدأ {prettyTime(settings.shiftStart)}
          <br />
          لمدة ٢٤ ساعة
        </div>
        <ChevronLeft size={18} className="text-faint" />
      </Link>

      {urgent && (
        <Link
          to="/admin"
          className={`mb-4 block rounded-lg border border-s-[3px] px-4 py-3 ${
            urgent.level === 'urgent' ? 'border-critical/30 border-s-critical bg-critical-soft' : 'border-warn/30 border-s-warn bg-warn-soft'
          }`}
        >
          <div className={`text-[0.74rem] font-bold ${urgent.level === 'urgent' ? 'text-critical' : 'text-warn'}`}>
            {urgent.level === 'urgent' ? 'تبليغ عاجل' : 'تبليغ مهم'}
          </div>
          <div className="font-bold text-ink">{urgent.title}</div>
          {urgent.body && <div className="line-clamp-2 text-[0.86rem] text-ink-2">{urgent.body}</div>}
        </Link>
      )}

      <div className="mb-6">
        <MetricStrip
          items={[
            { label: 'المرضى الحاليون', value: total.patients, hint: `من سعة ${total.capacity}` },
            { label: 'متاح للإدخال', value: total.empty },
            { label: 'حالات حرجة', value: total.critical, tone: total.critical ? 'critical' : undefined },
            { label: 'جاهز للخروج', value: total.discharge, tone: total.discharge ? 'info' : undefined },
          ]}
        />
      </div>

      <SectionHeader
        title="الردهات"
        meta="اضغط على الردهة لعرض أسرّتها ومرضاها"
        actions={
          isAdmin && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorOpen(true)}>
              <Plus size={15} />
              ردهة جديدة
            </button>
          )
        }
      />

      {!wardsReady ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel h-[11.5rem] animate-pulse bg-surface-2" />
          ))}
        </div>
      ) : wards.length === 0 ? (
        <div className="panel">
          <EmptyState title="لا توجد ردهات">{isAdmin ? 'أضف ردهة جديدة لبدء استقبال المرضى.' : 'تُضاف الردهات من قبل الإدارة.'}</EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {wards.map((w) => (
            <WardCard key={w.id} ward={w} />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.74rem] text-muted" aria-label="دليل الألوان">
        {(Object.keys(STATUS) as BedStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-[2px] ${MAP_TONE[s]}`} />
            {STATUS[s].label}
          </span>
        ))}
      </div>

      <WardEditor open={editorOpen} onClose={() => setEditorOpen(false)} ward={null} />
      <HandoverChoice open={handoverOpen} onClose={() => setHandoverOpen(false)} />
    </div>
  )
}

/** تقرير تسليم الشفت: لكل الردهات أو لردهة محددة */
export function HandoverChoice({ open, onClose, wardId }: { open: boolean; onClose: () => void; wardId?: string }) {
  const { wards, beds, today } = useData()
  const [scope, setScope] = useState<string>(wardId ?? 'all')
  const chosen = scope === 'all' ? wards : wards.filter((w) => w.id === scope)
  return (
    <PrintChoice
      open={open}
      onClose={onClose}
      title="تقرير تسليم الشفت"
      subtitle="قائمة المرضى الحاليين مع آخر علامات حيوية وملاحظات"
      filename={`DrTJPH-Handover-${isoDate()}`}
      build={() => <HandoverDoc wards={chosen} beds={beds} resident={today.assignments.resident ?? ''} />}
    >
      <label className="block">
        <span className="field-label">الردهات</span>
        <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">جميع الردهات</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
    </PrintChoice>
  )
}
