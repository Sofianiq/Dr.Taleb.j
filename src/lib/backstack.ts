/*
 * زر الرجوع في أندرويد (وإيماءة الرجوع) يغلق النافذة المنبثقة الظاهرة بدلاً من مغادرة الصفحة.
 * عند فتح أول نافذة يُضاف إدخال واحد إلى سجل المتصفح بالعنوان نفسه، ويُزال عند إغلاق آخر نافذة.
 * النوافذ المتداخلة تشترك في هذا الإدخال: كل ضغطة رجوع تغلق النافذة العليا فقط.
 */

const KEY = '__overlay'
const stack: { close: () => void }[] = []
let marker = false
let scheduled = false

const onMarker = () => {
  const st = history.state as Record<string, unknown> | null
  return !!st && st[KEY] === true
}

function sync() {
  scheduled = false
  if (stack.length > 0 && !marker) {
    history.pushState({ ...((history.state as object | null) ?? {}), [KEY]: true }, '')
    marker = true
  } else if (stack.length === 0 && marker) {
    marker = false
    // إن غيّر الموجّه الإدخال الحالي (انتقال إلى صفحة أخرى) فلا نرجع حتى لا نُلغي ذلك الانتقال
    if (onMarker()) history.back()
  }
}

// تأجيل المزامنة إلى نهاية الدورة الحالية يجمع فتح وإغلاق عدة نوافذ في خطوة واحدة
function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(sync)
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (!marker || onMarker()) return
    marker = false
    stack[stack.length - 1]?.close()
    // إن بقيت نوافذ مفتوحة (أو رفضت النافذة الإغلاق) يُعاد الإدخال
    window.setTimeout(schedule, 0)
  })
}

/** يُستدعى عند فتح نافذة؛ ويعيد دالة تُستدعى عند إغلاقها */
export function registerOverlay(close: () => void): () => void {
  const entry = { close }
  stack.push(entry)
  schedule()
  return () => {
    const i = stack.indexOf(entry)
    if (i >= 0) stack.splice(i, 1)
    schedule()
  }
}
