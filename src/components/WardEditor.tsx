import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteWard, saveWard } from '../data/actions'
import { useAuth } from '../data/auth'
import { hasPatient, useData, wardBeds } from '../data/store'
import type { Population, UnitKind, VitalKey, Ward } from '../data/types'
import { MAX_BEDS, PROCEDURE_LABELS, UNITS, VITAL_ORDER, VITALS } from '../lib/constants'
import { shortId } from '../lib/ids'
import { Field, Segmented, Sheet, useConfirm, useToast } from './ui'

const BLANK: Omit<Ward, 'id' | 'order'> = {
  name: '',
  unit: 'bed',
  beds: 10,
  procedureLabel: 'التشخيص',
  vitals: ['bp', 'pulse', 'spo2', 'temp'],
  population: 'adult',
}

/** إضافة ردهة أو تعديلها (للإدارة فقط) */
export function WardEditor({ open, onClose, ward }: { open: boolean; onClose: () => void; ward: Ward | null }) {
  const { wards, wardsVirtual, beds } = useData()
  const { role } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isNew = !ward
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(ward ? { name: ward.name, unit: ward.unit, beds: ward.beds, procedureLabel: ward.procedureLabel, vitals: ward.vitals, population: ward.population } : BLANK)
  }, [open, ward])

  const occupiedIndexes = ward ? wardBeds(ward, beds).filter(hasPatient).map((b) => b.index) : []
  const highestOccupied = occupiedIndexes.length ? Math.max(...occupiedIndexes) : 0

  const toggleVital = (k: VitalKey) =>
    setForm((f) => ({ ...f, vitals: f.vitals.includes(k) ? f.vitals.filter((x) => x !== k) : VITAL_ORDER.filter((x) => x === k || f.vitals.includes(x)) }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!role) return
    const name = form.name.trim()
    const count = Math.floor(Number(form.beds))
    if (!name) return setError('يرجى إدخال اسم الردهة.')
    if (!count || count < 1 || count > MAX_BEDS) return setError(`عدد ${UNITS[form.unit].many} يجب أن يكون بين 1 و ${MAX_BEDS}.`)
    if (count < highestOccupied)
      return setError(`لا يمكن تقليل العدد إلى ${count}: يوجد مريض في ${UNITS[form.unit].one} رقم ${highestOccupied}. انقل المريض أولاً.`)
    const next: Ward = {
      id: ward?.id ?? shortId('w'),
      order: ward?.order ?? Math.max(0, ...wards.map((w) => w.order)) + 1,
      ...form,
      name,
      beds: count,
      procedureLabel: form.procedureLabel.trim() || 'التشخيص',
    }
    saveWard(wards, wardsVirtual, next, isNew, role).catch(() => toast('تعذّر الحفظ — هذه الميزة للإدارة فقط', 'error'))
    toast(isNew ? `تمت إضافة ${name}` : 'تم حفظ التعديلات')
    onClose()
  }

  const remove = async () => {
    if (!ward || !role) return
    if (occupiedIndexes.length) return setError('لا يمكن حذف ردهة فيها مرضى. انقل المرضى أو أخرجهم أولاً.')
    const ok = await confirm({ title: `حذف ${ward.name}`, message: 'ستُحذف الردهة من التطبيق لجميع المستخدمين.', confirmLabel: 'حذف الردهة', danger: true })
    if (!ok) return
    deleteWard(wards, wardsVirtual, ward, role).catch(() => toast('تعذّر الحذف', 'error'))
    toast('تم حذف الردهة')
    onClose()
  }

  const customLabel = !PROCEDURE_LABELS.includes(form.procedureLabel)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? 'إضافة ردهة' : `إعدادات ${ward?.name}`}
      subtitle="تظهر التغييرات فوراً لجميع المستخدمين"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" form="ward-form" className="btn btn-primary">
            {isNew ? 'إضافة الردهة' : 'حفظ'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <span className="flex-1" />
          {!isNew && (
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              <Trash2 size={15} />
              حذف الردهة
            </button>
          )}
        </div>
      }
    >
      <form id="ward-form" onSubmit={submit} className="space-y-4">
        <Field label="اسم الردهة">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="مثال: ردهة الباطنية" autoFocus={isNew} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="field-label">نوع الوحدة</span>
            <Segmented<UnitKind>
              value={form.unit}
              onChange={(unit) => setForm({ ...form, unit })}
              className="w-full"
              options={(Object.keys(UNITS) as UnitKind[]).map((u) => ({ value: u, label: UNITS[u].one }))}
            />
          </div>
          <Field label={`عدد ${UNITS[form.unit].many}`} hint={highestOccupied ? `أعلى رقم مشغول حالياً: ${highestOccupied}` : undefined}>
            <input
              className="input tabular-nums"
              type="number"
              min={1}
              max={MAX_BEDS}
              inputMode="numeric"
              value={form.beds}
              onChange={(e) => setForm({ ...form, beds: Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="field-label">فئة المرضى</span>
            <Segmented<Population>
              value={form.population}
              onChange={(population) => setForm({ ...form, population })}
              className="w-full"
              options={[
                { value: 'adult', label: 'بالغون وأطفال' },
                { value: 'neonate', label: 'حديثو الولادة' },
              ]}
            />
            <span className="mt-1 block text-[0.74rem] text-muted">تُستخدم لحدود التنبيه في العلامات الحيوية</span>
          </div>
          <Field label="تسمية حقل الإجراء">
            <select
              className="input"
              value={customLabel ? '__custom' : form.procedureLabel}
              onChange={(e) => setForm({ ...form, procedureLabel: e.target.value === '__custom' ? '' : e.target.value })}
            >
              {PROCEDURE_LABELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
              <option value="__custom">تسمية أخرى…</option>
            </select>
            {customLabel && (
              <input
                className="input mt-2"
                value={form.procedureLabel}
                onChange={(e) => setForm({ ...form, procedureLabel: e.target.value })}
                maxLength={30}
                placeholder="اكتب التسمية"
              />
            )}
          </Field>
        </div>
        <fieldset>
          <legend className="field-label">العلامات الحيوية المتابَعة في هذه الردهة</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {VITAL_ORDER.map((k) => {
              const on = form.vitals.includes(k)
              return (
                <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[0.84rem] ${on ? 'border-ink' : 'border-line'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleVital(k)} className="accent-[var(--brand)]" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{VITALS[k].name}</span>
                    <span className="block text-[0.7rem] text-muted" dir="ltr" style={{ textAlign: 'right' }}>
                      {VITALS[k].label} · {VITALS[k].unit}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {error && <div className="rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-[0.86rem] text-critical">{error}</div>}
      </form>
    </Sheet>
  )
}
