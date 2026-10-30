import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ContactRow, WhatsAppIcon } from '../components/Contacts'
import { EmptyState, MetricStrip, PageHeader, SectionHeader, StatusTag } from '../components/ui'
import { bedLabel, hasPatient, useCensus, useData, wardBeds } from '../data/store'
import type { Bed, Ward } from '../data/types'
import { UNITS } from '../lib/constants'
import { currentShiftDate, longDate, stayDay } from '../lib/dates'
import { isValidPhone, whatsappUrl } from '../lib/phone'
import { findContactByName } from './Staff'

export function InquiriesPage() {
  const { wards, beds, contacts, today, settings } = useData()
  const { total } = useCensus()
  const [q, setQ] = useState('')

  const patients = useMemo(() => {
    const list: { ward: Ward; bed: Bed }[] = []
    for (const w of wards) for (const b of wardBeds(w, beds)) if (hasPatient(b)) list.push({ ward: w, bed: b })
    return list
  }, [wards, beds])

  const needle = q.trim()
  const results = needle
    ? patients.filter(({ bed }) => [bed.patientName, bed.doctorName, bed.procedure].some((f) => f.includes(needle)))
    : patients

  const desk = contacts.filter((c) => c.dept === 'inquiries' || c.dept === 'administration')
  const onCall = settings.positions.map((p) => ({ ...p, name: today.assignments[p.id] ?? '' }))

  return (
    <div>
      <PageHeader title="الاستعلامات" subtitle="البحث عن المرضى ومعرفة أماكنهم، والخفارة الحالية، وأرقام التواصل" />

      <div className="relative mb-4">
        <Search size={19} className="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-faint" />
        <input
          className="input min-h-12 ps-11 text-[1rem]"
          placeholder="ابحث عن مريض بالاسم أو الطبيب أو الإجراء"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          aria-label="بحث عن مريض"
        />
      </div>

      {!needle && (
        <div className="mb-6">
          <MetricStrip
            items={[
              { label: 'المرضى الراقدون', value: total.patients },
              { label: 'متاح للإدخال', value: total.empty },
              { label: 'حالات حرجة', value: total.critical, tone: total.critical ? 'critical' : undefined },
            ]}
          />
        </div>
      )}

      <SectionHeader title={needle ? 'نتائج البحث' : 'المرضى الحاليون'} meta={`${results.length} مريض`} />
      <div className="panel mb-7 overflow-hidden">
        {results.length === 0 ? (
          <EmptyState title={needle ? 'لا يوجد مريض بهذا الاسم' : 'لا يوجد مرضى راقدون حالياً'}>
            {needle ? 'تأكد من كتابة الاسم بشكل صحيح.' : 'يُدخَل المرضى من تبويب «الطبيب المقيم».'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {results.map(({ ward, bed }) => (
              <li key={bed.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/resident/ward/${ward.id}?bed=${bed.index}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="w-14 shrink-0 text-center">
                    <div className="num text-[1.05rem] font-bold text-ink">{bedLabel(bed)}</div>
                    <div className="text-[0.68rem] text-muted">{UNITS[ward.unit].one}</div>
                  </div>
                  <div className="min-w-0 flex-1 border-s border-line ps-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{bed.patientName}</span>
                      <StatusTag status={bed.status} className="shrink-0" />
                    </div>
                    <div className="truncate text-[0.78rem] text-muted">
                      {ward.name}
                      {bed.doctorName && ` · ${bed.doctorName}`}
                      {bed.admittedAt && ` · اليوم ${stayDay(bed.admittedAt.toDate())}`}
                    </div>
                  </div>
                </Link>
                {isValidPhone(bed.familyPhone) && (
                  <a href={whatsappUrl(bed.familyPhone)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-icon shrink-0 text-wa" aria-label={`مراسلة ذوي ${bed.patientName} عبر واتساب`}>
                    <WhatsAppIcon size={18} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SectionHeader title="الخفارة الحالية" meta={longDate(currentShiftDate(settings.shiftStart))} />
      <div className="panel mb-7 grid overflow-hidden sm:grid-cols-2">
        {onCall.map((p, i) => {
          const c = findContactByName(contacts, p.name)
          return (
            <div key={p.id} className={`flex items-center gap-3 border-line px-4 py-2.5 ${i > 0 ? 'border-t' : ''} ${i === 1 ? 'sm:border-t-0' : ''} sm:[&:nth-child(even)]:border-s`}>
              <div className="min-w-0 flex-1">
                <div className="text-[0.76rem] text-muted">{p.label}</div>
                <div className={`truncate font-semibold ${p.name ? 'text-ink' : 'text-faint'}`}>{p.name || 'غير محدد'}</div>
              </div>
              {c && (
                <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-sm btn-icon" aria-label={`مراسلة ${c.name}`}>
                  <WhatsAppIcon size={16} />
                </a>
              )}
            </div>
          )
        })}
      </div>

      <SectionHeader title="أرقام الاستعلامات والإدارة" />
      <div className="panel divide-y divide-line overflow-hidden">
        {desk.length === 0 ? (
          <EmptyState title="لم تُضف أرقام بعد">تضيف الإدارة الأرقام من «دليل الهواتف» ضمن قسم «الاستعلامات» أو «الإدارة».</EmptyState>
        ) : (
          desk.map((c) => <ContactRow key={c.id} contact={c} />)
        )}
      </div>
    </div>
  )
}
