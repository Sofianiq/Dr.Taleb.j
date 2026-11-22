import type { Bed, Population, VitalKey, Ward } from '../data/types'
import { VITALS } from './constants'
import { toLatinDigits } from './phone'

export type VitalLevel = 'ok' | 'warn' | 'alert' | 'none'
export type VitalDir = 'up' | 'down' | null

export const num = (v: string | undefined) => {
  if (!v) return null
  const n = parseFloat(toLatinDigits(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** ضغط الدم "120/80" ← [120, 80] */
export function parseBp(v: string | undefined): [number, number] | null {
  if (!v) return null
  const m = /(\d{2,3})\s*[/\\-]\s*(\d{2,3})/.exec(toLatinDigits(v))
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** توحيد صيغة الضغط: "124\76" أو "١٢٤-٧٦" ← "124/76" */
export function normalizeBp(v: string): string {
  const t = toLatinDigits(v).trim()
  const m = /(\d{2,3})\s*[/\\\-\s.,]\s*(\d{2,3})/.exec(t)
  if (m) return `${m[1]}/${m[2]}`
  return t.replace(/^\/+|\/+$/g, '').trim()
}

/** تقسيم قيمة الضغط إلى خانتين (الانقباضي / الانبساطي) لحقل الإدخال */
export function splitBp(v: string | undefined): [string, string] {
  const t = toLatinDigits(v ?? '').trim()
  if (!t) return ['', '']
  const m = /^(\d{0,3})\s*[/\\\-\s.,]\s*(\d{0,3})/.exec(t)
  if (m) return [m[1], m[2]]
  return [t.replace(/\D/g, '').slice(0, 3), '']
}

/** تنظيف القيمة قبل الحفظ: أرقام لاتينية، فاصلة عشرية موحّدة، وصيغة ضغط موحّدة */
export function cleanVitalValue(key: VitalKey, value: string | undefined): string {
  let v = toLatinDigits(value ?? '').replace(/٫/g, '.').trim()
  if (!v) return ''
  if (key === 'bp') v = normalizeBp(v)
  else if (VITALS[key].numeric) v = v.replace(/(\d),(\d)/g, '$1.$2')
  return v
}

/** صيغة العرض (تصحّح القيم القديمة المكتوبة بصيغ مختلفة) */
export function formatVital(key: VitalKey, value: string | undefined): string {
  if (!value) return ''
  return key === 'bp' ? normalizeBp(value) || value : value
}

/** [حد تنبيه أدنى, حد طبيعي أدنى, حد طبيعي أعلى, حد تنبيه أعلى] */
type Band = [number, number, number, number]

export const BANDS: Record<Population, Partial<Record<VitalKey, Band>>> = {
  adult: {
    pulse: [45, 55, 105, 130],
    spo2: [90, 94, 101, 101],
    temp: [35.5, 36, 37.8, 39],
    rr: [9, 12, 22, 28],
    rbs: [60, 70, 200, 300],
  },
  neonate: {
    pulse: [80, 100, 180, 200],
    spo2: [85, 90, 101, 101],
    temp: [36, 36.5, 37.5, 38],
    rr: [20, 30, 60, 70],
    rbs: [40, 47, 150, 250],
  },
}

const NONE = { level: 'none' as VitalLevel, dir: null as VitalDir }
const at = (level: VitalLevel, dir: VitalDir = null) => ({ level, dir })

/**
 * تنبيه بصري بسيط للقيم الخارجة عن المدى المعتاد حسب فئة المرضى، مع اتجاه الانحراف (مرتفع/منخفض).
 * للتنبيه فقط — لا يغني عن التقييم السريري.
 */
export function vitalStatus(key: VitalKey, value: string | undefined, population: Population = 'adult'): { level: VitalLevel; dir: VitalDir } {
  if (!value?.trim()) return NONE
  if (key === 'bp') {
    const bp = parseBp(value)
    if (!bp) return NONE
    const [sys, dia] = bp
    if (population === 'neonate') {
      if (sys < 50) return at('alert', 'down')
      if (sys > 100) return at('alert', 'up')
      if (sys < 60) return at('warn', 'down')
      if (sys > 90) return at('warn', 'up')
      return at('ok')
    }
    if (sys >= 180 || dia >= 120) return at('alert', 'up')
    if (sys < 85 || dia < 45) return at('alert', 'down')
    if (sys >= 150 || dia >= 95) return at('warn', 'up')
    if (sys < 95 || dia < 55) return at('warn', 'down')
    return at('ok')
  }
  const band = BANDS[population][key]
  if (!band) return NONE
  const n = num(value)
  if (n === null) return NONE
  const [alertLow, low, high, alertHigh] = band
  if (n < alertLow) return at('alert', 'down')
  if (n > alertHigh) return at('alert', 'up')
  if (n < low) return at('warn', 'down')
  if (n > high) return at('warn', 'up')
  return at('ok')
}

export function vitalLevel(key: VitalKey, value: string | undefined, population: Population = 'adult'): VitalLevel {
  return vitalStatus(key, value, population).level
}

export const LEVEL_TEXT: Record<VitalLevel, string> = {
  none: 'text-ink-2',
  ok: 'text-ink',
  warn: 'text-warn',
  alert: 'text-critical',
}

/* ------------------------------ مواعيد القياس ------------------------------ */

/** off: بلا تذكير · ok: ضمن الموعد · due: حان موعد القياس · late: تجاوز ضعف المدة */
export type DueState = 'off' | 'ok' | 'due' | 'late'

/** حالة موعد قياس العلامات الحيوية حسب تكرار القياس المحدد للردهة */
export function vitalsDue(ward: Ward, bed: Bed, now = Date.now()): DueState {
  const every = ward.vitalsEvery
  const ref = bed.vitalsAt?.toMillis() ?? bed.admittedAt?.toMillis() ?? null
  if (!every || ref === null) return 'off'
  const hours = (now - ref) / 3_600_000
  return hours >= every * 2 ? 'late' : hours >= every ? 'due' : 'ok'
}

export const isDue = (s: DueState) => s === 'due' || s === 'late'
