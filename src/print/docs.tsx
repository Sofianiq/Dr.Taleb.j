import type { ReactNode } from 'react'
import logoUrl from '../assets/logo.webp'
import type { Position, SectionKey, ShiftMonth, Sheet, Slot, Ward } from '../data/types'
import { HOSPITAL_AR, HOSPITAL_EN, MANAGED_BY, SECTIONS } from '../lib/constants'
import { daysInMonth, isWeekend, monthTitle, prettyTime, shortDate, weekdayOf } from '../lib/dates'
import { slotIdOf, twoDigits } from '../lib/ids'

function PageFrame({
  title,
  meta,
  footLeft,
  footRight = 'نموذج متابعة المقيم الدوري — الاستخدام الداخلي',
  children,
}: {
  title: string
  meta?: ReactNode
  footLeft: string
  footRight?: string
  children: ReactNode
}) {
  return (
    <section className="pp-page">
      <header className="pp-head">
        <div className="pp-brand">
          <img className="pp-logo" src={logoUrl} alt="" />
          <div>
            <div className="pp-name-ar">{HOSPITAL_AR}</div>
            <div className="pp-name-en">{HOSPITAL_EN}</div>
            <div className="pp-title">{title}</div>
          </div>
        </div>
        {meta && <div className="pp-meta">{meta}</div>}
      </header>
      <div className="pp-divider" />
      {children}
      <footer className="pp-foot">
        <span>{footRight}</span>
        <strong>{MANAGED_BY}</strong>
        <span>{footLeft}</span>
      </footer>
    </section>
  )
}

const PER_PAGE = 10

/** استمارة متابعة المرضى والعمليات لردهة واحدة (قسم أو قسمين) */
export function WardDoc({
  ward,
  sections,
  slots,
  sheet,
  onlyOccupied,
}: {
  ward: Ward
  sections: SectionKey[]
  slots: Record<string, Slot>
  sheet?: Sheet
  onlyOccupied: boolean
}) {
  const pages: { section: SectionKey; indices: number[]; occupied: number; total: number }[] = []
  for (const section of sections) {
    const count = section === 'rooms' ? ward.rooms : ward.beds
    const all = Array.from({ length: count }, (_, i) => i + 1)
    const occupiedList = all.filter((i) => (slots[slotIdOf(ward.id, section, i)]?.patientName ?? '').trim() !== '')
    const list = onlyOccupied ? occupiedList : all
    for (let i = 0; i < Math.max(list.length, 1); i += PER_PAGE) {
      pages.push({ section, indices: list.slice(i, i + PER_PAGE), occupied: occupiedList.length, total: count })
    }
  }

  const meta = (
    <>
      <div className="pp-meta-row">
        <b>التاريخ:</b>
        <span>{sheet?.date ? shortDate(sheet.date) : ''}</span>
      </div>
      <div className="pp-meta-row">
        <b>الشفت:</b>
        <span>{sheet?.shift ?? ''}</span>
      </div>
      <div className="pp-meta-row">
        <b>المقيم الدوري:</b>
        <span>{sheet?.resident ?? ''}</span>
      </div>
    </>
  )

  return (
    <>
      {pages.map((p, pi) => {
        const sec = SECTIONS[p.section]
        return (
          <PageFrame
            key={pi}
            title="استمارة متابعة المرضى والعمليات"
            meta={meta}
            footLeft={`صفحة ${pi + 1} من ${pages.length}`}
          >
            <div className="pp-strip">
              <span className={`pp-strip-tag ${p.section === 'icu' ? 'icu' : ''}`}>
                ردهة {ward.number}
                {ward.name ? ` (${ward.name})` : ''} — {sec.letter}: {sec.title}
              </span>
              <span className="pp-strip-count">
                المشغول: {p.occupied} من {p.total} {sec.unitPlural}
              </span>
            </div>
            <div className="pp-grid">
              {p.indices.map((i) => (
                <PrintCard key={i} section={p.section} index={i} slot={slots[slotIdOf(ward.id, p.section, i)]} />
              ))}
            </div>
          </PageFrame>
        )
      })}
    </>
  )
}

function PrintCard({ section, index, slot }: { section: SectionKey; index: number; slot?: Slot }) {
  const sec = SECTIONS[section]
  const v = (x?: string) => x ?? ''
  return (
    <div className={`pp-card ${section === 'icu' ? 'icu' : ''}`}>
      <div className="pp-card-head">
        <span className="pp-room">
          {sec.unit} / {sec.code}: {slot?.roomNo || twoDigits(index)}
        </span>
        <span className="pp-num">#{twoDigits(index)}</span>
      </div>
      <div className="pp-f">
        <b>اسم المريض:</b>
        <span>{v(slot?.patientName)}</span>
      </div>
      <div className="pp-f">
        <b>اسم الطبيب المختص:</b>
        <span>{v(slot?.doctorName)}</span>
      </div>
      <div className="pp-f">
        <b>نوع العملية:</b>
        <span>{v(slot?.operation)}</span>
      </div>
      <div className="pp-vitals-row">
        <b>الفعاليات الحيوية:</b>
        <div className="pp-vitals">
          {(
            [
              ['BP', slot?.bp],
              ['Pulse', slot?.pulse],
              ['SpO₂', slot?.spo2],
              ['Drain', slot?.drain],
              ['UOP', slot?.uop],
            ] as const
          ).map(([label, value]) => (
            <div className="pp-vital" key={label}>
              <i>{label}</i>
              <u>{value ?? ''}</u>
            </div>
          ))}
        </div>
      </div>
      <p className="pp-notes">
        <b>ملاحظات إضافية:</b>
        {v(slot?.notes)}
      </p>
    </div>
  )
}

/** جدول الخفارات الشهري */
export function ShiftDoc({
  month,
  data,
  positions,
  shiftStart,
}: {
  month: string
  data: ShiftMonth | null
  positions: Position[]
  shiftStart: string
}) {
  const days = daysInMonth(month)
  return (
    <PageFrame
      title={`جدول الخفارات (الكولات) — ${monthTitle(month)}`}
      meta={
        <>
          <div className="pp-meta-row">
            <b>نظام الخفارة:</b>
            <span>٢٤ ساعة</span>
          </div>
          <div className="pp-meta-row">
            <b>تبدأ الساعة:</b>
            <span>{prettyTime(shiftStart)}</span>
          </div>
        </>
      }
      footLeft={monthTitle(month)}
      footRight="جدول الخفارات — الاستخدام الداخلي"
    >
      <table className="pp-table">
        <thead>
          <tr>
            <th style={{ width: '22mm' }}>اليوم</th>
            {positions.map((p) => (
              <th key={p.id}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <tr key={d} className={isWeekend(month, d) ? 'fri' : ''}>
              <td className="pp-day">
                {d}
                <small>{weekdayOf(month, d)}</small>
              </td>
              {positions.map((p) => (
                <td key={p.id}>{data?.days?.[String(d)]?.[p.id] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data?.note && <div className="pp-note">ملاحظة: {data.note}</div>}
      <div style={{ flex: 1 }} />
    </PageFrame>
  )
}
