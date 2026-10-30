import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeftRight, FileText, LogOut, Pencil, RefreshCw, UserPlus } from 'lucide-react'
import {
  admitPatient,
  dischargePatient,
  recordVitals,
  setBedLabel,
  setFreeBedStatus,
  transferPatient,
  updatePatient,
} from '../data/actions'
import { useAuth } from '../data/auth'
import { bedLabel, hasPatient, useData, useObservations, wardBeds } from '../data/store'
import type { Bed, BedStatus, Observation, PatientData, Sex, VitalKey, Ward } from '../data/types'
import { DISCHARGE_TYPES, EMPTY_PATIENT, FREE_STATUSES, PATIENT_STATUSES, STATUS, UNITS, VITALS } from '../lib/constants'
import { dateTime, fromLocalInput, shortDateTime, stayDay, stayLength, timeAgo, toLocalInput } from '../lib/dates'
import { isValidPhone, whatsappUrl } from '../lib/phone'
import { LEVEL_TEXT, vitalLevel } from '../lib/vitals'
import { PatientDoc } from '../print/docs'
import { usePrint } from '../print/PrintProvider'
import { WhatsAppIcon } from './Contacts'
import { Field, Segmented, Sheet, StatusTag, Tabs, TONE_DOT, useConfirm, useToast } from './ui'
import { VitalsChart } from './VitalsChart'

type Vitals = Partial<Record<VitalKey, string>>
type Tab = 'info' | 'vitals' | 'history'

const patientOf = (bed: Bed): PatientData => ({
  patientName: bed.patientName,
  age: bed.age,
  sex: bed.sex,
  doctorName: bed.doctorName,
  procedure: bed.procedure,
  familyPhone: bed.familyPhone,
  notes: bed.notes,
})

/* ------------------------------ حقول المريض ------------------------------ */

function PatientFields({ ward, value, onChange }: { ward: Ward; value: PatientData; onChange: (v: PatientData) => void }) {
  const set = (k: keyof PatientData) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <>
      <Field label="اسم المريض">
        <input className="input font-semibold" value={value.patientName} onChange={set('patientName')} maxLength={120} placeholder="الاسم الثلاثي" />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="العمر">
          <input className="input" value={value.age} onChange={set('age')} maxLength={20} placeholder={ward.population === 'neonate' ? 'مثال: 3 أيام' : 'بالسنوات'} />
        </Field>
        <div>
          <span className="field-label">الجنس</span>
          <div className="flex h-[2.6rem] gap-1 rounded-[7px] border border-line-strong p-0.5">
            {(['ذكر', 'أنثى'] as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...value, sex: value.sex === s ? '' : s })}
                className={`rounded-md px-3.5 text-[0.86rem] font-semibold ${value.sex === s ? 'bg-ink text-surface' : 'text-muted hover:text-ink'}`}
                aria-pressed={value.sex === s}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الطبيب المختص">
          <input className="input" value={value.doctorName} onChange={set('doctorName')} maxLength={120} placeholder="د. " />
        </Field>
        <Field label={ward.procedureLabel}>
          <input className="input" value={value.procedure} onChange={set('procedure')} maxLength={200} />
        </Field>
      </div>
      <Field label="هاتف ذوي المريض" hint="للتواصل المباشر عبر واتساب">
        <div className="flex gap-2">
          <input className="input ltr-input" type="tel" inputMode="tel" value={value.familyPhone} onChange={set('familyPhone')} maxLength={30} placeholder="07xx xxx xxxx" />
          {isValidPhone(value.familyPhone) && (
            <a href={whatsappUrl(value.familyPhone)} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-icon shrink-0" aria-label="مراسلة ذوي المريض عبر واتساب">
              <WhatsAppIcon size={18} />
            </a>
          )}
        </div>
      </Field>
      <Field label="ملاحظات والحالة العامة">
        <textarea className="input" rows={3} value={value.notes} onChange={set('notes')} maxLength={3000} />
      </Field>
    </>
  )
}

/* ------------------------------ حقول العلامات الحيوية ------------------------------ */

function VitalsInputs({ ward, value, onChange, last }: { ward: Ward; value: Vitals; onChange: (v: Vitals) => void; last?: Vitals }) {
  if (ward.vitals.length === 0) {
    return <p className="text-[0.86rem] text-muted">لم تُحدَّد علامات حيوية لهذه الردهة. يمكن للإدارة تحديدها من إعدادات الردهة.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" dir="ltr">
      {ward.vitals.map((k) => {
        const def = VITALS[k]
        const level = vitalLevel(k, value[k], ward.population)
        return (
          <label key={k} className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.8rem] font-semibold text-ink-2">
              <span>
                {def.label} <span className="font-normal text-faint">{def.unit}</span>
              </span>
              <span className="text-[0.72rem] font-normal text-muted" dir="rtl">
                {def.name}
              </span>
            </span>
            <input
              className={`input text-center font-semibold tabular-nums ${level === 'alert' ? '!border-critical text-critical' : level === 'warn' ? '!border-warn text-warn' : ''}`}
              value={value[k] ?? ''}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              placeholder={def.placeholder}
              inputMode={def.numeric ? 'decimal' : 'text'}
              maxLength={20}
            />
            {last?.[k] && <span className="mt-0.5 block text-[0.7rem] text-faint">السابقة: {last[k]}</span>}
          </label>
        )
      })}
    </div>
  )
}

/* ------------------------------ سجل القراءات ------------------------------ */

function History({ ward, list, loading }: { ward: Ward; list: Observation[]; loading: boolean }) {
  const numericVitals = ward.vitals.filter((k) => list.some((o) => o.values[k]))
  const [vital, setVital] = useState<VitalKey | null>(null)
  const active = vital && numericVitals.includes(vital) ? vital : numericVitals[0]

  if (loading) return <div className="py-8 text-center text-[0.86rem] text-muted">جارٍ التحميل…</div>
  if (list.length === 0) return <div className="py-8 text-center text-[0.86rem] text-muted">لا توجد قراءات مسجّلة لهذا المريض بعد.</div>

  return (
    <div className="space-y-4">
      {active && (
        <div>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
            {numericVitals.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setVital(k)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[0.8rem] font-semibold ${
                  k === active ? 'border-ink bg-ink text-surface' : 'border-line-strong text-ink-2 hover:border-faint'
                }`}
              >
                {VITALS[k].name}
              </button>
            ))}
          </div>
          <VitalsChart list={list} vital={active} population={ward.population} />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[30rem] text-[0.8rem]">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="px-3 py-2 text-start font-semibold">الوقت</th>
              {ward.vitals.map((k) => (
                <th key={k} className="px-2 py-2 text-center font-semibold" dir="ltr">
                  {VITALS[k].label}
                </th>
              ))}
              <th className="px-3 py-2 text-start font-semibold">بواسطة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...list].reverse().map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-3 py-2 text-ink-2">{o.at ? shortDateTime(o.at.toDate()) : '—'}</td>
                {ward.vitals.map((k) => (
                  <td key={k} className={`px-2 py-2 text-center font-semibold tabular-nums ${LEVEL_TEXT[vitalLevel(k, o.values[k], ward.population)]}`} dir="ltr">
                    {o.values[k] || <span className="text-faint">—</span>}
                  </td>
                ))}
                <td className="max-w-[9rem] truncate px-3 py-2 text-muted">{o.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------ نافذة السرير ------------------------------ */

export function BedSheet({ ward, bed, onClose }: { ward: Ward; bed: Bed | null; onClose: () => void }) {
  const open = !!bed
  const { role, isAdmin } = useAuth()
  const toast = useToast()
  const printer = usePrint()
  const unit = UNITS[ward.unit]
  const occupied = hasPatient(bed ?? undefined)

  const [mode, setMode] = useState<'view' | 'admit'>('view')
  const [tab, setTab] = useState<Tab>('info')
  const [patient, setPatient] = useState<PatientData>(EMPTY_PATIENT)
  const [status, setStatus] = useState<BedStatus>('occupied')
  const [admitted, setAdmitted] = useState('')
  const [vitals, setVitals] = useState<Vitals>({})
  const [transferOpen, setTransferOpen] = useState(false)
  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [labelEdit, setLabelEdit] = useState<string | null>(null)
  const initial = useRef<{ patient: PatientData; status: BedStatus; admitted: string; version: number }>({
    patient: EMPTY_PATIENT,
    status: 'occupied',
    admitted: '',
    version: 0,
  })
  const { list: observations, loading: obsLoading } = useObservations(occupied ? bed?.admissionId : undefined)

  const version = bed?.updatedAt?.toMillis() ?? 0

  const loadFromBed = (b: Bed) => {
    const p = patientOf(b)
    const adm = b.admittedAt ? toLocalInput(b.admittedAt.toDate()) : toLocalInput(new Date())
    setPatient(p)
    setStatus(STATUS[b.status].hasPatient ? b.status : 'occupied')
    setAdmitted(adm)
    initial.current = { patient: p, status: b.status, admitted: adm, version: b.updatedAt?.toMillis() ?? 0 }
  }

  // تهيئة النموذج عند فتح سرير أو تغيّر المريض فيه
  const key = bed ? `${bed.id}|${bed.admissionId}` : ''
  useEffect(() => {
    if (!bed) return
    setMode('view')
    setTab('info')
    setVitals({})
    setLabelEdit(null)
    if (hasPatient(bed)) loadFromBed(bed)
    else {
      setPatient(EMPTY_PATIENT)
      setStatus('occupied')
      setAdmitted(toLocalInput(new Date()))
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const changed = useMemo(() => {
    const keys = (Object.keys(patient) as (keyof PatientData)[]).filter((k) => patient[k].trim() !== initial.current.patient[k].trim())
    return { keys, status: status !== initial.current.status, admitted: admitted !== initial.current.admitted }
  }, [patient, status, admitted])
  const dirty = changed.keys.length > 0 || changed.status || changed.admitted
  const remoteChanged = occupied && !bed?.pending && dirty && version !== 0 && version !== initial.current.version

  if (!bed) return null
  const label = bedLabel(bed)
  const admittedDate = bed.admittedAt?.toDate() ?? null

  /* ---------- الإجراءات ---------- */

  const fail = () => toast('تعذّر الحفظ — تحقق من الاتصال أو الصلاحيات', 'error')
  const saved = (msg: string) => toast(navigator.onLine ? msg : 'حُفظ على الجهاز — ستتم المزامنة عند عودة الإنترنت', navigator.onLine ? 'success' : 'info')

  const submitAdmit = (e: FormEvent) => {
    e.preventDefault()
    if (!role) return
    if (!patient.patientName.trim()) return toast('يرجى إدخال اسم المريض', 'error')
    admitPatient(ward, bed, { ...patient, status, admittedAt: fromLocalInput(admitted) ?? new Date() }, vitals, role).catch(fail)
    saved(`تم إدخال ${patient.patientName.trim()}`)
    onClose()
  }

  const submitInfo = () => {
    if (!role) return
    if (!dirty) return onClose()
    if (!patient.patientName.trim()) return toast('اسم المريض مطلوب', 'error')
    const patch: Partial<PatientData> & { status?: BedStatus; admittedAt?: Date } = {}
    for (const k of changed.keys) (patch as Record<string, string>)[k] = patient[k]
    if (changed.status) patch.status = status
    if (changed.admitted) patch.admittedAt = fromLocalInput(admitted) ?? undefined
    updatePatient(ward, bed, patch, role).catch(fail)
    saved('تم حفظ التعديلات')
    onClose()
  }

  const submitVitals = () => {
    if (!role) return
    if (!Object.values(vitals).some((v) => v?.trim())) return toast('أدخل قيمة واحدة على الأقل', 'error')
    recordVitals(ward, bed, vitals, role).catch(fail)
    saved('تم تسجيل القراءة')
    setVitals({})
    setTab('history')
  }

  const changeFreeStatus = (s: BedStatus) => {
    if (!role || s === bed.status) return
    setFreeBedStatus(ward, bed, s, role).catch(fail)
  }

  const saveLabel = () => {
    if (labelEdit === null) return
    setBedLabel(bed, labelEdit).catch(fail)
    setLabelEdit(null)
    toast('تم تعديل الرقم')
  }

  const printSummary = () =>
    printer.pdf(<PatientDoc ward={ward} bed={bed} observations={observations} />, `DrTJPH-Patient-${ward.id}-${label}`)

  /* ---------- العرض ---------- */

  const title = (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        {unit.one} <span className="num">{label}</span>
      </span>
      <span className="text-[0.85rem] font-semibold text-muted">· {ward.name}</span>
    </span>
  )

  let body: ReactNode
  let footer: ReactNode = null

  if (!occupied && mode === 'view') {
    body = (
      <div className="space-y-5">
        <div>
          <div className="field-label">حالة {unit.the}</div>
          <Segmented<BedStatus>
            value={bed.status}
            onChange={changeFreeStatus}
            className="w-full"
            options={FREE_STATUSES.map((s) => ({
              value: s,
              label: (
                <>
                  <span className={`size-1.5 rounded-full ${TONE_DOT[STATUS[s].tone]}`} />
                  {STATUS[s].label}
                </>
              ),
            }))}
          />
        </div>
        {isAdmin && (
          <div>
            <div className="field-label">رقم {unit.the} المعروض</div>
            {labelEdit === null ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLabelEdit(bed.label || label)}>
                <Pencil size={14} />
                تعديل الرقم ({label})
              </button>
            ) : (
              <div className="flex gap-2">
                <input className="input w-32 text-center font-bold" value={labelEdit} onChange={(e) => setLabelEdit(e.target.value)} maxLength={12} autoFocus />
                <button type="button" className="btn btn-primary" onClick={saveLabel}>
                  حفظ
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setLabelEdit(null)}>
                  إلغاء
                </button>
              </div>
            )}
          </div>
        )}
        {bed.updatedBy && bed.updatedAt && (
          <p className="text-[0.78rem] text-faint">
            آخر تغيير {timeAgo(bed.updatedAt.toDate())} — {bed.updatedBy}
          </p>
        )}
      </div>
    )
    footer = (
      <button type="button" className="btn btn-primary w-full" onClick={() => setMode('admit')}>
        <UserPlus size={17} />
        إدخال مريض إلى {unit.the}
      </button>
    )
  } else if (!occupied) {
    body = (
      <form id="admit-form" onSubmit={submitAdmit} className="space-y-4">
        <PatientFields ward={ward} value={patient} onChange={setPatient} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="تاريخ ووقت الدخول">
            <input className="input" type="datetime-local" value={admitted} onChange={(e) => setAdmitted(e.target.value)} />
          </Field>
          <div>
            <span className="field-label">الحالة</span>
            <Segmented<BedStatus>
              value={status}
              onChange={setStatus}
              className="w-full"
              options={(['occupied', 'critical'] as BedStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))}
            />
          </div>
        </div>
        <fieldset className="rounded-lg border border-line p-3.5">
          <legend className="px-1 text-[0.84rem] font-bold text-ink">العلامات الحيوية عند الدخول (اختياري)</legend>
          <VitalsInputs ward={ward} value={vitals} onChange={setVitals} />
        </fieldset>
      </form>
    )
    footer = (
      <div className="flex flex-row-reverse gap-2">
        <button type="submit" form="admit-form" className="btn btn-primary flex-1 sm:flex-none">
          <UserPlus size={17} />
          إدخال المريض
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setMode('view')}>
          رجوع
        </button>
      </div>
    )
  } else {
    const day = stayDay(admittedDate)
    body = (
      <div>
        <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-lg border border-line text-[0.8rem]">
          <div className="px-3 py-2">
            <div className="text-muted">الحالة</div>
            <StatusTag status={bed.status} className="mt-0.5" />
          </div>
          <div className="border-s border-line px-3 py-2">
            <div className="text-muted">مدة الرقود</div>
            <div className="font-bold text-ink">{day ? stayLength(day) : '—'}</div>
          </div>
          <div className="border-s border-line px-3 py-2">
            <div className="text-muted">آخر قراءة</div>
            <div className="truncate font-bold text-ink">{bed.vitalsAt ? timeAgo(bed.vitalsAt.toDate()) : '—'}</div>
          </div>
        </div>

        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          className="mb-4"
          options={[
            { value: 'info', label: 'البيانات' },
            { value: 'vitals', label: 'قراءة جديدة' },
            { value: 'history', label: `السجل والمخطط${observations.length ? ` (${observations.length})` : ''}` },
          ]}
        />

        {tab === 'info' && (
          <div className="space-y-4">
            {remoteChanged && (
              <div className="flex items-center gap-3 rounded-md border border-info/25 bg-info-soft px-3 py-2 text-[0.84rem] text-info">
                <RefreshCw size={15} className="shrink-0" />
                <span className="flex-1">عُدِّلت هذه البيانات من جهاز آخر أثناء التحرير.</span>
                <button type="button" className="btn btn-sm bg-info text-white" onClick={() => loadFromBed(bed)}>
                  عرض الأحدث
                </button>
              </div>
            )}
            <div>
              <span className="field-label">الحالة السريرية</span>
              <Segmented<BedStatus>
                value={status}
                onChange={setStatus}
                className="w-full"
                options={PATIENT_STATUSES.map((s) => ({
                  value: s,
                  label: (
                    <>
                      <span className={`size-1.5 rounded-full ${TONE_DOT[STATUS[s].tone]}`} />
                      {STATUS[s].label}
                    </>
                  ),
                }))}
              />
            </div>
            <PatientFields ward={ward} value={patient} onChange={setPatient} />
            <Field label="تاريخ ووقت الدخول">
              <input className="input" type="datetime-local" value={admitted} onChange={(e) => setAdmitted(e.target.value)} />
            </Field>
            <p className="text-[0.76rem] text-faint">
              {admittedDate && `دخل في ${dateTime(admittedDate)}`}
              {bed.updatedAt && ` · آخر تعديل ${timeAgo(bed.updatedAt.toDate())} — ${bed.updatedBy}`}
            </p>
          </div>
        )}

        {tab === 'vitals' && (
          <div className="space-y-3">
            <p className="text-[0.84rem] text-muted">
              تُحفظ كل قراءة في سجل المريض مع الوقت واسم من سجّلها.
              {bed.vitalsAt && ` آخر قراءة: ${shortDateTime(bed.vitalsAt.toDate())}${bed.vitalsBy ? ` — ${bed.vitalsBy}` : ''}.`}
            </p>
            <VitalsInputs ward={ward} value={vitals} onChange={setVitals} last={bed.vitals} />
            <p className="text-[0.72rem] text-faint">التلوين تنبيه بصري للقيم خارج المدى المعتاد ولا يغني عن التقييم السريري.</p>
          </div>
        )}

        {tab === 'history' && <History ward={ward} list={observations} loading={obsLoading} />}
      </div>
    )

    footer = (
      <div className="flex flex-wrap items-center gap-2">
        {tab === 'info' && (
          <button type="button" className="btn btn-primary" onClick={submitInfo} disabled={!dirty}>
            حفظ التعديلات
          </button>
        )}
        {tab === 'vitals' && (
          <button type="button" className="btn btn-primary" onClick={submitVitals}>
            حفظ القراءة
          </button>
        )}
        <span className="flex-1" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={printSummary} disabled={printer.busy}>
          <FileText size={15} />
          ملخص PDF
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight size={15} />
          نقل
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setDischargeOpen(true)}>
          <LogOut size={15} />
          إخراج
        </button>
      </div>
    )
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        size="lg"
        title={title}
        subtitle={occupied ? bed.patientName : mode === 'admit' ? 'إدخال مريض جديد' : STATUS[bed.status].label}
        footer={footer}
      >
        {body}
      </Sheet>
      {occupied && (
        <>
          <TransferSheet open={transferOpen} onClose={() => setTransferOpen(false)} fromWard={ward} from={bed} onDone={onClose} />
          <DischargeSheet open={dischargeOpen} onClose={() => setDischargeOpen(false)} ward={ward} bed={bed} onDone={onClose} />
        </>
      )}
    </>
  )
}

/* ------------------------------ نقل المريض ------------------------------ */

function TransferSheet({ open, onClose, fromWard, from, onDone }: { open: boolean; onClose: () => void; fromWard: Ward; from: Bed; onDone: () => void }) {
  const { wards, beds } = useData()
  const { role } = useAuth()
  const toast = useToast()
  const [wardId, setWardId] = useState(fromWard.id)
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setWardId(fromWard.id)
      setTarget(null)
    }
  }, [open, fromWard.id])

  const toWard = wards.find((w) => w.id === wardId) ?? fromWard
  const free = wardBeds(toWard, beds).filter((b) => !hasPatient(b) && b.id !== from.id)
  const chosen = free.find((b) => b.id === target)

  const submit = () => {
    if (!role || !chosen) return
    transferPatient(fromWard, from, toWard, chosen, role).catch(() => toast('تعذّر النقل', 'error'))
    toast(`تم نقل ${from.patientName}`)
    onClose()
    onDone()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="نقل المريض"
      subtitle={`${from.patientName} — من ${fromWard.name}، ${UNITS[fromWard.unit].one} ${bedLabel(from)}`}
      footer={
        <div className="flex flex-row-reverse gap-2">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!chosen}>
            تأكيد النقل
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="الردهة">
          <select
            className="input"
            value={wardId}
            onChange={(e) => {
              setWardId(e.target.value)
              setTarget(null)
            }}
          >
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <div className="field-label">
            {UNITS[toWard.unit].many} المتاحة ({free.length})
          </div>
          {free.length === 0 ? (
            <p className="rounded-md bg-surface-2 px-3 py-3 text-[0.86rem] text-muted">لا توجد {UNITS[toWard.unit].many} متاحة في هذه الردهة.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {free.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setTarget(b.id)}
                  aria-pressed={target === b.id}
                  className={`rounded-md border px-2 py-2 text-center ${
                    target === b.id ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong hover:border-faint'
                  }`}
                >
                  <div className="num text-[0.95rem] font-bold">{bedLabel(b)}</div>
                  <div className="text-[0.66rem] text-muted">{STATUS[b.status].label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[0.78rem] text-muted">ينتقل المريض مع كامل بياناته وسجل علاماته الحيوية، ويُعلَّم {UNITS[fromWard.unit].the} السابق «قيد التنظيف».</p>
      </div>
    </Sheet>
  )
}

/* ------------------------------ إخراج المريض ------------------------------ */

function DischargeSheet({ open, onClose, ward, bed, onDone }: { open: boolean; onClose: () => void; ward: Ward; bed: Bed; onDone: () => void }) {
  const { role } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [type, setType] = useState(DISCHARGE_TYPES[0])
  const [note, setNote] = useState('')
  const [next, setNext] = useState<BedStatus>('cleaning')

  useEffect(() => {
    if (open) {
      setType(DISCHARGE_TYPES[0])
      setNote('')
      setNext('cleaning')
    }
  }, [open])

  const submit = async () => {
    if (!role) return
    const ok = await confirm({
      title: 'تأكيد الإخراج',
      message: (
        <>
          سيُنقل <b>{bed.patientName}</b> إلى سجل المرضى المُخرَجين ({type}).
        </>
      ),
      confirmLabel: 'إخراج المريض',
      danger: true,
    })
    if (!ok) return
    dischargePatient(ward, bed, type, note, next, role).catch(() => toast('تعذّر إخراج المريض', 'error'))
    toast(`تم إخراج ${bed.patientName}`)
    onClose()
    onDone()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="sm"
      title="إخراج المريض"
      subtitle={bed.patientName}
      footer={
        <div className="flex flex-row-reverse gap-2">
          <button type="button" className="btn btn-solid-danger" onClick={submit}>
            إخراج
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="field-label">نوع الخروج</legend>
          <div className="space-y-1.5">
            {DISCHARGE_TYPES.map((t) => (
              <label key={t} className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[0.9rem] ${type === t ? 'border-ink' : 'border-line'}`}>
                <input type="radio" name="dtype" checked={type === t} onChange={() => setType(t)} className="accent-[var(--brand)]" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="ملاحظة (اختياري)">
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        <div>
          <span className="field-label">حالة {UNITS[ward.unit].the} بعد الخروج</span>
          <Segmented<BedStatus>
            value={next}
            onChange={setNext}
            className="w-full"
            options={(['cleaning', 'empty'] as BedStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))}
          />
        </div>
      </div>
    </Sheet>
  )
}
