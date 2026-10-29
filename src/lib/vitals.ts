import { toLatinDigits } from './phone'

export type VitalLevel = 'ok' | 'warn' | 'alert' | 'none'

const num = (v: string) => {
  const n = parseFloat(toLatinDigits(v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** تنبيه بصري بسيط للقيم الخارجة عن المدى المعتاد — للتنبيه فقط وليس للتشخيص */
export function vitalLevel(key: 'bp' | 'pulse' | 'spo2', value: string): VitalLevel {
  if (!value.trim()) return 'none'
  if (key === 'spo2') {
    const n = num(value)
    if (n === null) return 'none'
    if (n < 90) return 'alert'
    if (n < 94) return 'warn'
    return 'ok'
  }
  if (key === 'pulse') {
    const n = num(value)
    if (n === null) return 'none'
    if (n < 45 || n > 130) return 'alert'
    if (n < 55 || n > 105) return 'warn'
    return 'ok'
  }
  const m = /(\d{2,3})\s*[/\\-]\s*(\d{2,3})/.exec(toLatinDigits(value))
  if (!m) return 'none'
  const sys = Number(m[1])
  const dia = Number(m[2])
  if (sys >= 180 || sys < 85 || dia >= 120 || dia < 45) return 'alert'
  if (sys >= 150 || sys < 95 || dia >= 95 || dia < 55) return 'warn'
  return 'ok'
}
