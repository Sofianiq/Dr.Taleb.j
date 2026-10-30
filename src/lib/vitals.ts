import type { Population, VitalKey } from '../data/types'
import { toLatinDigits } from './phone'

export type VitalLevel = 'ok' | 'warn' | 'alert' | 'none'

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

/**
 * تنبيه بصري بسيط للقيم الخارجة عن المدى المعتاد حسب فئة المرضى.
 * للتنبيه فقط — لا يغني عن التقييم السريري.
 */
export function vitalLevel(key: VitalKey, value: string | undefined, population: Population = 'adult'): VitalLevel {
  if (!value?.trim()) return 'none'
  if (key === 'bp') {
    const bp = parseBp(value)
    if (!bp) return 'none'
    const [sys, dia] = bp
    if (population === 'neonate') {
      if (sys < 50 || sys > 100) return 'alert'
      if (sys < 60 || sys > 90) return 'warn'
      return 'ok'
    }
    if (sys >= 180 || sys < 85 || dia >= 120 || dia < 45) return 'alert'
    if (sys >= 150 || sys < 95 || dia >= 95 || dia < 55) return 'warn'
    return 'ok'
  }
  const band = BANDS[population][key]
  if (!band) return 'none'
  const n = num(value)
  if (n === null) return 'none'
  const [alertLow, low, high, alertHigh] = band
  if (n < alertLow || n > alertHigh) return 'alert'
  if (n < low || n > high) return 'warn'
  return 'ok'
}

export const LEVEL_TEXT: Record<VitalLevel, string> = {
  none: 'text-ink-2',
  ok: 'text-ink',
  warn: 'text-warn',
  alert: 'text-critical',
}
