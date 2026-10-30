import type { ReactNode } from 'react'
import logoUrl from '../assets/logo.webp'
import { bedLabel, hasPatient, wardBeds } from '../data/store'
import type { Bed, Observation, Position, ShiftMonth, Sheet, Ward } from '../data/types'
import { HOSPITAL_AR, HOSPITAL_EN, MANAGED_BY, STATUS, UNITS, VITALS, unitCount } from '../lib/constants'
import { ageLabel, dateTime, daysInMonth, isWeekend, longDate, monthTitle, prettyTime, shortDate, shortDateTime, stayDay, stayLength, weekdayOf } from '../lib/dates'
import { formatPhone } from '../lib/phone'
import { twoDigits } from '../lib/ids'
import { vitalLevel } from '../lib/vitals'

/* ------------------------------ إطار الصفحة ------------------------------ */

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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="pp-meta-row">
      <b>{label}:</b>
      <span>{value}</span>
    </div>
  )
}

const printedAt = () => `طُبع في ${dateTime(new Date())}`

/* ------------------------------ استمارة الردهة ------------------------------ */

const PER_PAGE = 10

/** استمارة متابعة المرضى والعمليات لردهة (١٠ بطاقات في الصفحة) */
export function WardDoc({ ward, beds, sheet, onlyOccupied }: { ward: Ward; beds: Record<string, Bed>; sheet?: Sheet; onlyOccupied: boolean }) {
  const all = wardBeds(ward, beds)
  const occupied = all.filter(hasPatient)
  const list = onlyOccupied ? occupied : all
  const pages: Bed[][] = []
  for (let i = 0; i < Math.max(list.length, 1); i += PER_PAGE) pages.push(list.slice(i, i + PER_PAGE))

  const meta = (
    <>
      <MetaRow label="التاريخ" value={sheet?.date ? shortDate(sheet.date) : ''} />
      <MetaRow label="الشفت" value={sheet?.shift ?? ''} />
      <MetaRow label="المقيم الدوري" value={sheet?.resident ?? ''} />
    </>
  )

  return (
    <>
      {pages.map((chunk, pi) => (
        <PageFrame key={pi} title="استمارة متابعة المرضى والعمليات" meta={meta} footLeft={`صفحة ${pi + 1} من ${pages.length}`}>
          <div className="pp-strip">
            <span className="pp-strip-tag">{ward.name}</span>
            <span className="pp-strip-count">
              المرضى: {occupied.length} من {unitCount(ward.beds, ward.unit)}
            </span>
          </div>
          <div className="pp-grid">
            {chunk.map((b) => (
              <PrintCard key={b.id} ward={ward} bed={b} />
            ))}
          </div>
        </PageFrame>
      ))}
    </>
  )
}

function PrintCard({ ward, bed }: { ward: Ward; bed: Bed }) {
  const unit = UNITS[ward.unit]
  const p = hasPatient(bed)
  const vitals = ward.vitals.slice(0, 6)
  return (
    <div className={`pp-card ${bed.status === 'critical' ? 'crit' : ''}`}>
      <div className="pp-card-head">
        <span className="pp-room">
          {unit.one} / {unit.code}: {bedLabel(bed)}
        </span>
        <span className="pp-num">{p ? STATUS[bed.status].label : `#${twoDigits(bed.index)}`}</span>
      </div>
      <div className="pp-f">
        <b>اسم المريض:</b>
        <span>{p ? bed.patientName : ''}</span>
        <b className="pp-f-side">العمر:</b>
        <span className="pp-f-short">{p ? [bed.age, bed.sex].filter(Boolean).join(' / ') : ''}</span>
      </div>
      <div className="pp-f">
        <b>الطبيب المختص:</b>
        <span>{p ? bed.doctorName : ''}</span>
      </div>
      <div className="pp-f">
        <b>{ward.procedureLabel}:</b>
        <span>{p ? bed.procedure : ''}</span>
      </div>
      {vitals.length > 0 && (
        <div className="pp-vitals-row">
          <b>الفعاليات الحيوية:</b>
          <div className="pp-vitals" style={{ gridTemplateColumns: `repeat(${vitals.length}, 1fr)` }}>
            {vitals.map((k) => (
              <div className="pp-vital" key={k}>
                <i>{VITALS[k].label}</i>
                <u>{p ? bed.vitals[k] ?? '' : ''}</u>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="pp-notes">
        <b>ملاحظات إضافية:</b>
        {p ? bed.notes : ''}
      </p>
    </div>
  )
}

/* ------------------------------ تقرير تسليم الشفت ------------------------------ */

type HandoverRow = { kind: 'ward'; ward: Ward; count: number } | { kind: 'bed'; ward: Ward; bed: Bed }

const ROW_H = { ward: 8, bed: 13.2 }
const PAGE_BODY = 214

/** تقرير تسليم الشفت: جميع المرضى الحاليين مع آخر علامات حيوية وملاحظات */
export function HandoverDoc({ wards, beds, resident }: { wards: Ward[]; beds: Record<string, Bed>; resident: string }) {
  const rows: HandoverRow[] = []
  let patients = 0
  let critical = 0
  let discharge = 0
  for (const w of wards) {
    const list = wardBeds(w, beds).filter(hasPatient)
    rows.push({ kind: 'ward', ward: w, count: list.length })
    for (const b of list) {
      rows.push({ kind: 'bed', ward: w, bed: b })
      patients++
      if (b.status === 'critical') critical++
      if (b.status === 'discharge') discharge++
    }
  }

  // تقسيم الصفوف على الصفحات بارتفاع ثابت لكل صف
  const pages: HandoverRow[][] = [[]]
  let used = 0
  for (const r of rows) {
    const h = ROW_H[r.kind]
    const last = pages[pages.length - 1]
    if (used + h > PAGE_BODY - (pages.length === 1 ? 12 : 0) && last.length) {
      pages.push([])
      used = 0
    }
    pages[pages.length - 1].push(r)
    used += h
  }

  const meta = (
    <>
      <MetaRow label="التاريخ" value={longDate(new Date())} />
      <MetaRow label="المقيم الخافر" value={resident} />
      <MetaRow label="المستلِم" value="" />
    </>
  )

  return (
    <>
      {pages.map((chunk, pi) => (
        <PageFrame key={pi} title="تقرير تسليم الشفت" meta={meta} footLeft={`صفحة ${pi + 1} من ${pages.length}`} footRight={printedAt()}>
          {pi === 0 && (
            <div className="pp-summary">
              <span>
                المرضى الحاليون: <b>{patients}</b>
              </span>
              <span>
                حالات حرجة: <b className="crit-text">{critical}</b>
              </span>
              <span>
                جاهز للخروج: <b>{discharge}</b>
              </span>
              <span>
                الردهات: <b>{wards.length}</b>
              </span>
            </div>
          )}
          <table className="pp-ho">
            <colgroup>
              <col style={{ width: '13mm' }} />
              <col style={{ width: '38mm' }} />
              <col style={{ width: '36mm' }} />
              <col style={{ width: '15mm' }} />
              <col style={{ width: '40mm' }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>السرير</th>
                <th>المريض</th>
                <th>الطبيب / الإجراء</th>
                <th>الرقود</th>
                <th>آخر علامات حيوية</th>
                <th>الحالة والملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((r) =>
                r.kind === 'ward' ? (
                  <tr key={`w-${r.ward.id}`} className="pp-ho-ward">
                    <td colSpan={6}>
                      {r.ward.name} <small>— {r.count ? `${r.count} مريض` : 'لا يوجد مرضى'}</small>
                    </td>
                  </tr>
                ) : (
                  <HandoverBedRow key={r.bed.id} ward={r.ward} bed={r.bed} />
                ),
              )}
            </tbody>
          </table>
          {pi === 0 && patients === 0 && <div className="pp-empty">لا يوجد مرضى راقدون حالياً.</div>}
        </PageFrame>
      ))}
    </>
  )
}

function HandoverBedRow({ ward, bed }: { ward: Ward; bed: Bed }) {
  const day = stayDay(bed.admittedAt?.toDate())
  const vitals = ward.vitals.filter((k) => bed.vitals[k])
  return (
    <tr className={bed.status === 'critical' ? 'crit' : ''}>
      <td className="pp-ho-bed">{bedLabel(bed)}</td>
      <td>
        <div className="pp-ho-name">{bed.patientName}</div>
        <div className="pp-ho-sub">{[ageLabel(bed.age), bed.sex].filter(Boolean).join(' · ')}</div>
      </td>
      <td>
        <div className="pp-ho-clip">{bed.doctorName}</div>
        <div className="pp-ho-sub pp-ho-clip">{bed.procedure}</div>
      </td>
      <td className="pp-ho-c">{day ? `اليوم ${day}` : ''}</td>
      <td className="pp-ho-vitals">
        {vitals.map((k) => (
          <span key={k} className={vitalLevel(k, bed.vitals[k], ward.population) === 'alert' ? 'crit-text' : ''}>
            {VITALS[k].label} <b>{bed.vitals[k]}</b>
          </span>
        ))}
        {bed.vitalsAt && <em>{shortDateTime(bed.vitalsAt.toDate())}</em>}
      </td>
      <td>
        <div className="pp-ho-status">{STATUS[bed.status].label}</div>
        <div className="pp-ho-notes">{bed.notes}</div>
      </td>
    </tr>
  )
}

/* ------------------------------ ملخص المريض ------------------------------ */

const OBS_FIRST = 16
const OBS_NEXT = 34

/** ملخص حالة مريض مع سجل علاماته الحيوية */
export function PatientDoc({ ward, bed, observations }: { ward: Ward; bed: Bed; observations: Observation[] }) {
  const unit = UNITS[ward.unit]
  const admitted = bed.admittedAt?.toDate()
  const day = stayDay(admitted)
  const rows = [...observations].reverse()
  const pages: Observation[][] = [rows.slice(0, OBS_FIRST)]
  for (let i = OBS_FIRST; i < rows.length; i += OBS_NEXT) pages.push(rows.slice(i, i + OBS_NEXT))

  const info: [string, string][] = [
    ['اسم المريض', bed.patientName],
    ['العمر / الجنس', [bed.age, bed.sex].filter(Boolean).join(' / ')],
    ['الردهة', `${ward.name} — ${unit.one} ${bedLabel(bed)}`],
    ['الطبيب المختص', bed.doctorName],
    [ward.procedureLabel, bed.procedure],
    ['الحالة', STATUS[bed.status].label],
    ['تاريخ الدخول', admitted ? dateTime(admitted) : ''],
    ['مدة الرقود', day ? stayLength(day) : ''],
    ['هاتف ذوي المريض', bed.familyPhone ? formatPhone(bed.familyPhone) : ''],
  ]

  return (
    <>
      {pages.map((chunk, pi) => (
        <PageFrame key={pi} title="ملخص حالة مريض" footLeft={`صفحة ${pi + 1} من ${pages.length}`} footRight={printedAt()}>
          {pi === 0 && (
            <>
              <div className="pp-info">
                {info.map(([l, v]) => (
                  <div key={l}>
                    <b>{l}</b>
                    <span>{v || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="pp-box">
                <b>الملاحظات والحالة العامة</b>
                <p>{bed.notes || '—'}</p>
              </div>
              <div className="pp-subtitle">سجل العلامات الحيوية ({observations.length} قراءة)</div>
            </>
          )}
          <table className="pp-obs">
            <thead>
              <tr>
                <th>الوقت</th>
                {ward.vitals.map((k) => (
                  <th key={k}>
                    {VITALS[k].label}
                    <small>{VITALS[k].unit}</small>
                  </th>
                ))}
                <th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              {chunk.length === 0 ? (
                <tr>
                  <td colSpan={ward.vitals.length + 2} className="pp-empty-cell">
                    لا توجد قراءات مسجّلة
                  </td>
                </tr>
              ) : (
                chunk.map((o) => (
                  <tr key={o.id}>
                    <td className="pp-obs-time">{o.at ? shortDateTime(o.at.toDate()) : ''}</td>
                    {ward.vitals.map((k) => (
                      <td key={k} className={vitalLevel(k, o.values[k], ward.population) === 'alert' ? 'crit-text' : ''}>
                        {o.values[k] ?? ''}
                      </td>
                    ))}
                    <td className="pp-obs-by">{o.by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ flex: 1 }} />
          {pi === pages.length - 1 && (
            <div className="pp-sign">
              <span>توقيع الطبيب المختص: ....................................</span>
              <span>توقيع المقيم: ....................................</span>
            </div>
          )}
        </PageFrame>
      ))}
    </>
  )
}

/* ------------------------------ جدول الخفارات ------------------------------ */

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
          <MetaRow label="نظام الخفارة" value="٢٤ ساعة" />
          <MetaRow label="تبدأ الساعة" value={prettyTime(shiftStart)} />
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
