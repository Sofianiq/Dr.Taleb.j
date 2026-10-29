/**
 * توحيد أرقام الهواتف العراقية إلى الصيغة الدولية (بدون +) لاستخدامها مع واتساب.
 * أمثلة: 07701234567 ← 9647701234567 ، +964 770 123 4567 ← 9647701234567
 */
export function normalizePhone(raw: string): string {
  let d = toLatinDigits(raw).replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  d = d.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('9640')) d = '964' + d.slice(4)
  if (d.startsWith('0') && d.length === 11) d = '964' + d.slice(1)
  else if (d.startsWith('7') && d.length === 10) d = '964' + d
  return d
}

export function isValidPhone(raw: string): boolean {
  const d = normalizePhone(raw)
  return d.length >= 8 && d.length <= 15
}

/** عرض الرقم بشكل مقروء: 0770 123 4567 للأرقام العراقية */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw)
  if (d.startsWith('964') && d.length === 13) {
    const local = '0' + d.slice(3)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return d ? '+' + d : raw
}

export function whatsappUrl(raw: string, text?: string): string {
  const d = normalizePhone(raw)
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${d}${q}`
}

export function telUrl(raw: string): string {
  return `tel:+${normalizePhone(raw)}`
}

/** تحويل الأرقام العربية-الهندية والفارسية إلى أرقام لاتينية */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
}
