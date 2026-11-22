import { toLatinDigits } from './phone'

/**
 * توحيد النص العربي للبحث: الهمزات، والتاء المربوطة، والألف المقصورة، والتشكيل، والأرقام.
 * فالبحث عن «زهية» يجد «زهيه»، و«احمد» يجد «أحمد».
 */
export function normalizeAr(s: string): string {
  return toLatinDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

/** هل تطابق كلمة البحث أحد الحقول؟ (البحث الفارغ يطابق الكل) */
export function matchesQuery(query: string, fields: (string | undefined)[]): boolean {
  const q = normalizeAr(query)
  if (!q) return true
  return fields.some((f) => !!f && normalizeAr(f).includes(q))
}

/** عدد المرضى بصيغة عربية سليمة: مريض واحد، مريضان، 5 مرضى، 11 مريضاً */
export function patientsCount(n: number): string {
  const r = n % 100
  if (n === 0) return 'لا يوجد مرضى'
  if (n === 1) return 'مريض واحد'
  if (n === 2) return 'مريضان'
  if (r >= 3 && r <= 10) return `${n} مرضى`
  if (r >= 11 && r <= 99) return `${n} مريضاً`
  return `${n} مريض`
}

/** الاسم المناسب بعد رقم يُعرض منفصلاً: 5 «مرضى»، 21 «مريضاً» */
export function patientsNoun(n: number): string {
  const r = n % 100
  if (n >= 2 && r >= 2 && r <= 10) return 'مرضى'
  if (r >= 11 && r <= 99) return 'مريضاً'
  return 'مريض'
}
