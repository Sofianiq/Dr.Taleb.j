import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, LogOut, RefreshCw, Save } from 'lucide-react'
import { dischargeSlot, saveSlot } from '../data/actions'
import { useAuth } from '../data/auth'
import { isOccupied } from '../data/store'
import type { SectionKey, Slot, SlotData, Ward } from '../data/types'
import { EMPTY_SLOT, SECTIONS } from '../lib/constants'
import { twoDigits } from '../lib/ids'
import { Field, Sheet, useConfirm, useToast } from './ui'

const toForm = (slot: Slot | undefined, index: number): SlotData => ({
  roomNo: slot?.roomNo || twoDigits(index),
  patientName: slot?.patientName ?? '',
  doctorName: slot?.doctorName ?? '',
  operation: slot?.operation ?? '',
  bp: slot?.bp ?? '',
  pulse: slot?.pulse ?? '',
  spo2: slot?.spo2 ?? '',
  drain: slot?.drain ?? '',
  uop: slot?.uop ?? '',
  notes: slot?.notes ?? '',
})

const VITALS: { key: keyof SlotData; label: string; unit: string; placeholder: string }[] = [
  { key: 'bp', label: 'BP', unit: 'mmHg', placeholder: '120/80' },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', placeholder: '80' },
  { key: 'spo2', label: 'SpO₂', unit: '%', placeholder: '98' },
  { key: 'drain', label: 'Drain', unit: 'ml', placeholder: '50' },
  { key: 'uop', label: 'UOP', unit: 'ml', placeholder: '400' },
]

export function SlotEditor({
  ward,
  section,
  index,
  slot,
  onClose,
}: {
  ward: Ward
  section: SectionKey
  index: number | null
  slot: Slot | undefined
  onClose: () => void
}) {
  const { role } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const open = index !== null
  const [form, setForm] = useState<SlotData>(EMPTY_SLOT)
  const initial = useRef<SlotData>(EMPTY_SLOT)
  const openedVersion = useRef<number>(0)
  const sec = SECTIONS[section]

  const version = slot?.updatedAt?.toMillis?.() ?? 0

  useEffect(() => {
    if (index === null) return
    const f = toForm(slot, index)
    setForm(f)
    initial.current = f
    openedVersion.current = version
    // نعيد التهيئة فقط عند فتح بطاقة جديدة
  }, [index, section, ward.id])

  const changedKeys = useMemo(
    () => (Object.keys(form) as (keyof SlotData)[]).filter((k) => form[k].trim() !== initial.current[k].trim()),
    [form],
  )
  const remoteChanged = open && !slot?.pending && version !== 0 && openedVersion.current !== 0 && version !== openedVersion.current

  const set = (k: keyof SlotData) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const reloadRemote = () => {
    if (index === null) return
    const f = toForm(slot, index)
    setForm(f)
    initial.current = f
    openedVersion.current = version
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (index === null || !role) return
    if (changedKeys.length === 0) return onClose()
    // نحفظ الحقول التي تغيّرت فقط حتى لا نلغي تعديلات زميل آخر على حقول أخرى
    const patch: Partial<SlotData> = {}
    for (const k of changedKeys) patch[k] = form[k]
    saveSlot(ward.id, section, index, patch, role).catch(() => toast('تعذّر حفظ البيانات — تحقق من الاتصال أو الصلاحيات', 'error'))
    toast(navigator.onLine ? 'تم الحفظ وتحديثه لدى الجميع' : 'تم الحفظ على الجهاز — ستتم المزامنة عند عودة الإنترنت', navigator.onLine ? 'success' : 'info')
    onClose()
  }

  const discharge = async () => {
    if (!slot || !role || index === null) return
    const ok = await confirm({
      title: 'إخراج المريض وتفريغ ' + (section === 'icu' ? 'السرير' : 'الغرفة'),
      message: (
        <>
          سيتم نقل بيانات المريض <b>{slot.patientName}</b> إلى سجل المرضى المُخرَجين وتفريغ {sec.unit} {slot.roomNo || twoDigits(index)}.
        </>
      ),
      confirmLabel: 'إخراج المريض',
      danger: true,
    })
    if (!ok) return
    dischargeSlot(slot, ward, role).catch(() => toast('تعذّر إخراج المريض', 'error'))
    toast('تم إخراج المريض وتفريغ ' + sec.unit)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <span className={`rounded-lg px-2 py-0.5 text-[0.85rem] ${section === 'icu' ? 'bg-accent-soft text-accent' : 'bg-info-soft text-info'}`}>
            {sec.unit} / {sec.code}: {form.roomNo || twoDigits(index ?? 0)}
          </span>
          <span className="text-muted" dir="ltr">
            #{twoDigits(index ?? 0)}
          </span>
        </span>
      }
      subtitle={`ردهة ${ward.number} — ${sec.letter}: ${sec.title}`}
      footer={
        <div className="flex flex-wrap gap-2.5">
          <button type="submit" form="slot-form" className="btn btn-primary min-w-[9rem] flex-1">
            <Save size={18} />
            حفظ
          </button>
          {isOccupied(slot) && (
            <button type="button" className="btn btn-danger" onClick={discharge}>
              <LogOut size={18} />
              إخراج المريض
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      }
    >
      {remoteChanged && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-info/25 bg-info-soft px-3.5 py-2.5 text-[0.85rem] text-info">
          <RefreshCw size={17} className="shrink-0" />
          <span className="flex-1">تم تحديث هذه البطاقة من جهاز آخر أثناء التعديل.</span>
          <button type="button" className="btn btn-sm bg-info text-white" onClick={reloadRemote}>
            عرض الأحدث
          </button>
        </div>
      )}
      <form id="slot-form" onSubmit={submit} className="space-y-4 pb-2">
        <div className="grid grid-cols-[7.5rem_1fr] gap-3">
          <Field label={`رقم ${sec.unit === 'سرير' ? 'السرير' : 'الغرفة'}`}>
            <input className="input text-center font-bold tabular-nums" value={form.roomNo} onChange={set('roomNo')} maxLength={12} />
          </Field>
          <Field label="اسم المريض">
            <input className="input font-semibold" value={form.patientName} onChange={set('patientName')} maxLength={120} placeholder="الاسم الثلاثي" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الطبيب المختص">
            <input className="input" value={form.doctorName} onChange={set('doctorName')} maxLength={120} placeholder="د. " />
          </Field>
          <Field label="نوع العملية">
            <input className="input" value={form.operation} onChange={set('operation')} maxLength={200} />
          </Field>
        </div>

        <fieldset className="rounded-2xl border border-line bg-surface-2 p-3.5">
          <legend className="flex items-center gap-1.5 px-1.5 text-[0.88rem] font-bold text-ink">
            <Activity size={17} className="text-accent" />
            الفعاليات الحيوية
          </legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5" dir="ltr">
            {VITALS.map((v) => (
              <label key={v.key} className="block">
                <span className="mb-1 flex items-baseline justify-between px-0.5 text-[0.78rem] font-bold text-ink-2">
                  {v.label}
                  <span className="text-[0.68rem] font-medium text-muted">{v.unit}</span>
                </span>
                <input
                  className="input min-h-11 text-center font-mono tabular-nums"
                  value={form[v.key]}
                  onChange={set(v.key)}
                  placeholder={v.placeholder}
                  inputMode={v.key === 'bp' ? 'text' : 'decimal'}
                  maxLength={v.key === 'drain' || v.key === 'uop' ? 40 : 20}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="ملاحظات إضافية والحالة العامة">
          <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} maxLength={2000} />
        </Field>
      </form>
    </Sheet>
  )
}
