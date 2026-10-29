import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, ChevronLeft, Info, PhoneCall, Search, UserRoundCheck, UsersRound } from 'lucide-react'
import { ContactCard, WhatsAppIcon } from '../components/Contacts'
import { EmptyState, PageHeader, StatTile } from '../components/ui'
import { isOccupied, useData } from '../data/store'
import type { Slot } from '../data/types'
import { SECTIONS } from '../lib/constants'
import { currentShiftDate, longDate } from '../lib/dates'
import { twoDigits } from '../lib/ids'
import { whatsappUrl } from '../lib/phone'
import { findContactByName } from './Staff'

export function InquiriesPage() {
  const { slots, wards, contacts, today, settings } = useData()
  const [q, setQ] = useState('')

  const wardById = useMemo(() => Object.fromEntries(wards.map((w) => [w.id, w])), [wards])

  const patients = useMemo(() => {
    const list: Slot[] = []
    for (const s of Object.values(slots)) {
      const w = wardById[s.wardId]
      if (!w || !isOccupied(s)) continue
      const max = s.section === 'icu' ? w.beds : w.rooms
      if (s.index < 1 || s.index > max) continue
      list.push(s)
    }
    list.sort((a, b) => (wardById[a.wardId]?.order ?? 0) - (wardById[b.wardId]?.order ?? 0) || a.section.localeCompare(b.section) * -1 || a.index - b.index)
    return list
  }, [slots, wardById])

  const needle = q.trim()
  const results = needle
    ? patients.filter((p) => [p.patientName, p.doctorName, p.operation].some((f) => f.includes(needle)))
    : patients

  const deskContacts = contacts.filter((c) => c.dept === 'inquiries' || c.dept === 'administration')
  const onCall = settings.positions.map((p) => ({ ...p, name: today.assignments[p.id] ?? '' }))

  return (
    <div className="anim-fade-up">
      <PageHeader title="الاستعلامات" subtitle="البحث عن المرضى ومعرفة أماكنهم والخفارة الحالية" icon={<Info size={22} />} />

      <div className="relative mb-4">
        <Search size={20} className="pointer-events-none absolute inset-y-0 start-4 my-auto text-brand" />
        <input
          className="input h-14 rounded-2xl ps-12 text-[1.02rem] shadow-soft"
          placeholder="ابحث عن مريض بالاسم أو الطبيب أو العملية…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
        />
      </div>

      {!needle && (
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <StatTile label="المرضى الراقدون حالياً" value={patients.length} icon={<UsersRound size={20} />} />
          <StatTile label="في ردهة الإنعاش القلبي" value={patients.filter((p) => p.section === 'icu').length} icon={<BedDouble size={20} />} tone="accent" />
        </div>
      )}

      <section className="mb-6">
        <h2 className="section-title mb-2.5 flex items-center gap-2">
          <UsersRound size={18} className="text-brand" />
          {needle ? `نتائج البحث (${results.length})` : 'المرضى الحاليون'}
        </h2>
        {results.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Search size={26} />} title={needle ? 'لم يتم العثور على مريض بهذا الاسم' : 'لا يوجد مرضى مسجلون حالياً'}>
              {needle ? 'تأكد من كتابة الاسم بشكل صحيح.' : 'يُسجّل المرضى من قبل الطبيب المقيم في تبويب الردهات.'}
            </EmptyState>
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {results.slice(0, needle ? 100 : 60).map((p) => {
              const w = wardById[p.wardId]
              const sec = SECTIONS[p.section]
              return (
                <Link
                  key={p.id}
                  to={`/resident/ward/${p.wardId}${p.section === 'icu' ? '?s=icu' : ''}`}
                  className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-surface-2"
                >
                  <div
                    className={`grid size-12 shrink-0 place-items-center rounded-xl text-center leading-tight ${
                      p.section === 'icu' ? 'bg-accent-soft text-accent' : 'bg-info-soft text-info'
                    }`}
                  >
                    <span className="text-[0.62rem] font-semibold">ردهة</span>
                    <span className="font-display text-[1rem] font-bold">{w?.number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{p.patientName}</div>
                    <div className="truncate text-[0.8rem] text-muted">
                      {sec.unit} {p.roomNo || twoDigits(p.index)} — {sec.title}
                      {p.doctorName && ` • ${p.doctorName}`}
                    </div>
                    {p.operation && <div className="truncate text-[0.78rem] text-ink-2">{p.operation}</div>}
                  </div>
                  <ChevronLeft size={18} className="shrink-0 text-muted" />
                </Link>
              )
            })}
          </div>
        )}
        {!needle && results.length > 60 && (
          <p className="mt-2 text-center text-[0.8rem] text-muted">يُعرض أول ٦٠ مريضاً — استخدم البحث للوصول إلى البقية.</p>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="section-title flex items-center gap-2">
            <UserRoundCheck size={18} className="text-brand" />
            الخفارة الحالية
          </h2>
          <span className="text-[0.78rem] text-muted">{longDate(currentShiftDate(settings.shiftStart))}</span>
        </div>
        <div className="card grid divide-y divide-line overflow-hidden sm:grid-cols-2 sm:divide-y-0">
          {onCall.map((p) => {
            const c = findContactByName(contacts, p.name)
            return (
              <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 sm:border-b sm:border-line">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.76rem] font-semibold text-muted">{p.label}</div>
                  <div className={`truncate font-bold ${p.name ? 'text-ink' : 'text-muted/60'}`}>{p.name || 'غير محدد'}</div>
                </div>
                {c && (
                  <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-icon size-9 min-h-9 min-w-9" aria-label={`مراسلة ${c.name}`}>
                    <WhatsAppIcon size={18} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-2.5 flex items-center gap-2">
          <PhoneCall size={18} className="text-brand" />
          أرقام الاستعلامات والإدارة
        </h2>
        {deskContacts.length === 0 ? (
          <div className="card">
            <EmptyState icon={<PhoneCall size={26} />} title="لم تُضف أرقام بعد">
              تضيف الإدارة الأرقام من «دليل الهواتف» ضمن قسم «الاستعلامات» أو «الإدارة».
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {deskContacts.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
