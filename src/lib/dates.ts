export const AR_MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
]

export const AR_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD بالتوقيت المحلي */
export function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** معرّف مستند الشهر: YYYY-MM */
export function monthId(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function parseMonthId(id: string): { year: number; month: number } {
  const [y, m] = id.split('-').map(Number)
  return { year: y, month: m - 1 }
}

export function shiftMonth(id: string, delta: number): string {
  const { year, month } = parseMonthId(id)
  return monthId(new Date(year, month + delta, 1))
}

export function daysInMonth(id: string): number {
  const { year, month } = parseMonthId(id)
  return new Date(year, month + 1, 0).getDate()
}

export function monthTitle(id: string): string {
  const { year, month } = parseMonthId(id)
  return `${AR_MONTHS[month]} ${year}`
}

export function weekdayOf(id: string, day: number): string {
  const { year, month } = parseMonthId(id)
  return AR_WEEKDAYS[new Date(year, month, day).getDay()]
}

export function isWeekend(id: string, day: number): boolean {
  const { year, month } = parseMonthId(id)
  return new Date(year, month, day).getDay() === 5
}

/** تاريخ مقروء: الخميس 29 تشرين الأول 2026 */
export function longDate(d = new Date()): string {
  return `${AR_WEEKDAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function shortDate(iso: string): string {
  const d = fromIso(iso)
  if (!d) return iso
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** 29/10/2026 */
export function numericDate(iso: string): string {
  const d = fromIso(iso)
  return d ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` : iso
}

/** وقت نسبي مختصر: قبل ٥ دقائق */
export function timeAgo(date: Date | null | undefined): string {
  if (!date) return ''
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 45) return 'الآن'
  const m = Math.round(s / 60)
  if (m < 60) return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`
  return dateTime(date)
}

export function dateTime(d: Date): string {
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()} — ${clock(d)}`
}

export function clock(d: Date): string {
  const h = d.getHours()
  const suffix = h < 12 ? 'ص' : 'م'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(d.getMinutes())} ${suffix}`
}

/** "08:00" ← "8:00 صباحاً" */
export function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const suffix = h < 12 ? 'صباحاً' : 'مساءً'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m || 0)} ${suffix}`
}

/**
 * يوم الخفارة الحالي: الخفارة ٢٤ ساعة تبدأ عند shiftStart، فقبل موعد البدء
 * نكون ما زلنا ضمن خفارة اليوم السابق.
 */
export function currentShiftDate(shiftStart: string, now = new Date()): Date {
  const [h, m] = shiftStart.split(':').map(Number)
  const start = new Date(now)
  start.setHours(h || 0, m || 0, 0, 0)
  const d = new Date(now)
  if (now < start) d.setDate(d.getDate() - 1)
  return d
}
