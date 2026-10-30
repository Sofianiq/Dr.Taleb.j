import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EMPTY_PATIENT, STATUS, UNITS, VITAL_ORDER } from '../lib/constants'
import { newAdmissionId } from '../lib/ids'
import { operatorLabel } from '../lib/operator'
import { bedLabel } from './store'
import type {
  ActivityAction,
  AnnouncementLevel,
  AppSettings,
  Bed,
  BedStatus,
  Contact,
  PatientData,
  Role,
  Sheet,
  VitalKey,
  Ward,
} from './types'

/**
 * ملاحظة: كتابات Firestore تُطبَّق محلياً فوراً وتظهر للجميع لحظة وصولها للخادم.
 * عند انقطاع الإنترنت تبقى الوعود (Promises) معلّقة حتى عودة الاتصال، لذلك لا ننتظرها في الواجهة.
 */

const clean = (v: string) => v.trim()

type Vitals = Partial<Record<VitalKey, string>>

function cleanVitals(values: Vitals): Vitals {
  const out: Vitals = {}
  for (const k of VITAL_ORDER) {
    const v = values[k]?.trim()
    if (v) out[k] = v
  }
  return out
}

function cleanPatient(p: Partial<PatientData>): Partial<PatientData> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(p)) out[k] = clean(String(v ?? ''))
  return out as Partial<PatientData>
}

const unitOf = (ward: Ward) => UNITS[ward.unit].one

function logActivity(batch: WriteBatch, role: Role, action: ActivityAction, text: string, wardName = '', patientName = '') {
  batch.set(doc(collection(db, 'activity')), {
    action,
    text,
    wardName,
    patientName,
    by: operatorLabel(role),
    at: serverTimestamp(),
  })
}

const CLEARED = {
  ...EMPTY_PATIENT,
  admissionId: '',
  admittedAt: null,
  vitals: {},
  vitalsAt: null,
  vitalsBy: '',
}

const bedRef = (bed: Bed) => doc(db, 'beds', bed.id)

const bedBase = (bed: Bed) => ({ wardId: bed.wardId, index: bed.index, label: bed.label })

/* ------------------------------ المرضى ------------------------------ */

export interface AdmitInput extends PatientData {
  status: BedStatus
  admittedAt: Date
}

/** إدخال مريض جديد إلى سرير */
export function admitPatient(ward: Ward, bed: Bed, input: AdmitInput, vitals: Vitals, role: Role): Promise<void> {
  const batch = writeBatch(db)
  const admissionId = newAdmissionId()
  const by = operatorLabel(role)
  const v = cleanVitals(vitals)
  const hasVitals = Object.keys(v).length > 0
  const { status, admittedAt, ...patient } = input
  batch.set(bedRef(bed), {
    ...bedBase(bed),
    ...CLEARED,
    ...cleanPatient(patient),
    status: STATUS[status].hasPatient ? status : 'occupied',
    admissionId,
    admittedAt: Timestamp.fromDate(admittedAt),
    vitals: v,
    vitalsAt: hasVitals ? serverTimestamp() : null,
    vitalsBy: hasVitals ? by : '',
    updatedAt: serverTimestamp(),
    updatedBy: by,
  })
  if (hasVitals) {
    batch.set(doc(collection(db, 'observations')), { admissionId, bedId: bed.id, wardId: ward.id, values: v, at: serverTimestamp(), by })
  }
  logActivity(batch, role, 'admit', `إدخال ${clean(input.patientName)} إلى ${unitOf(ward)} ${bedLabel(bed)}`, ward.name, clean(input.patientName))
  return batch.commit()
}

/** تحديث بيانات المريض و/أو حالته */
export function updatePatient(
  ward: Ward,
  bed: Bed,
  patch: Partial<PatientData> & { status?: BedStatus; admittedAt?: Date },
  role: Role,
): Promise<void> {
  const batch = writeBatch(db)
  const { status, admittedAt, ...patient } = patch
  const data: Record<string, unknown> = {
    ...bedBase(bed),
    ...cleanPatient(patient),
    updatedAt: serverTimestamp(),
    updatedBy: operatorLabel(role),
  }
  if (status) data.status = status
  if (admittedAt) data.admittedAt = Timestamp.fromDate(admittedAt)
  batch.set(bedRef(bed), data, { merge: true })
  const name = clean(patch.patientName ?? bed.patientName)
  const onlyStatus = status && Object.keys(patient).length === 0 && !admittedAt
  if (onlyStatus) {
    logActivity(batch, role, 'status', `حالة ${name}: «${STATUS[status].label}»`, ward.name, name)
  } else {
    logActivity(batch, role, 'update', `تحديث بيانات ${name}${status && status !== bed.status ? ` — «${STATUS[status].label}»` : ''}`, ward.name, name)
  }
  return batch.commit()
}

/** تسجيل قراءة علامات حيوية جديدة (تُحفظ في سجل المريض) */
export function recordVitals(ward: Ward, bed: Bed, values: Vitals, role: Role): Promise<void> {
  const v = cleanVitals(values)
  const batch = writeBatch(db)
  const by = operatorLabel(role)
  batch.update(bedRef(bed), { vitals: v, vitalsAt: serverTimestamp(), vitalsBy: by, updatedAt: serverTimestamp(), updatedBy: by })
  batch.set(doc(collection(db, 'observations')), {
    admissionId: bed.admissionId,
    bedId: bed.id,
    wardId: ward.id,
    values: v,
    at: serverTimestamp(),
    by,
  })
  logActivity(batch, role, 'vitals', `علامات حيوية: ${bed.patientName}`, ward.name, bed.patientName)
  return batch.commit()
}

/** تغيير حالة سرير شاغر (شاغر / محجوز / تنظيف) */
export function setFreeBedStatus(ward: Ward, bed: Bed, status: BedStatus, role: Role): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    bedRef(bed),
    { ...bedBase(bed), ...CLEARED, status, updatedAt: serverTimestamp(), updatedBy: operatorLabel(role) },
    { merge: true },
  )
  logActivity(batch, role, 'status', `${unitOf(ward)} ${bedLabel(bed)}: «${STATUS[status].label}»`, ward.name)
  return batch.commit()
}

/** تعديل رقم السرير/الغرفة المعروض (للإدارة) */
export function setBedLabel(bed: Bed, label: string): Promise<void> {
  return setDoc(bedRef(bed), { wardId: bed.wardId, index: bed.index, label: clean(label) }, { merge: true })
}

/** نقل مريض إلى سرير آخر (في الردهة نفسها أو غيرها) */
export function transferPatient(fromWard: Ward, from: Bed, toWard: Ward, to: Bed, role: Role): Promise<void> {
  const batch = writeBatch(db)
  const by = operatorLabel(role)
  batch.set(bedRef(to), {
    ...bedBase(to),
    patientName: from.patientName,
    age: from.age,
    sex: from.sex,
    doctorName: from.doctorName,
    procedure: from.procedure,
    familyPhone: from.familyPhone,
    notes: from.notes,
    status: from.status,
    admissionId: from.admissionId,
    admittedAt: from.admittedAt,
    vitals: from.vitals,
    vitalsAt: from.vitalsAt,
    vitalsBy: from.vitalsBy,
    updatedAt: serverTimestamp(),
    updatedBy: by,
  })
  batch.set(bedRef(from), { ...bedBase(from), ...CLEARED, status: 'cleaning', updatedAt: serverTimestamp(), updatedBy: by })
  const where = fromWard.id === toWard.id ? `${unitOf(toWard)} ${bedLabel(to)}` : `${toWard.name} — ${unitOf(toWard)} ${bedLabel(to)}`
  logActivity(batch, role, 'transfer', `نقل ${from.patientName} من ${unitOf(fromWard)} ${bedLabel(from)} إلى ${where}`, fromWard.name, from.patientName)
  return batch.commit()
}

/** إخراج المريض: نقل بياناته إلى السجل وتفريغ السرير */
export function dischargePatient(
  ward: Ward,
  bed: Bed,
  dischargeType: string,
  dischargeNote: string,
  nextStatus: BedStatus,
  role: Role,
): Promise<void> {
  const batch = writeBatch(db)
  const by = operatorLabel(role)
  batch.set(doc(collection(db, 'archive')), {
    admissionId: bed.admissionId,
    wardId: ward.id,
    wardName: ward.name,
    bedLabel: bedLabel(bed),
    unit: ward.unit,
    patientName: bed.patientName,
    age: bed.age,
    sex: bed.sex,
    doctorName: bed.doctorName,
    procedure: bed.procedure,
    familyPhone: bed.familyPhone,
    notes: bed.notes,
    vitals: bed.vitals,
    admittedAt: bed.admittedAt,
    dischargedAt: serverTimestamp(),
    dischargeType,
    dischargeNote: clean(dischargeNote),
    dischargedBy: by,
  })
  batch.set(bedRef(bed), { ...bedBase(bed), ...CLEARED, status: nextStatus, updatedAt: serverTimestamp(), updatedBy: by })
  logActivity(batch, role, 'discharge', `خروج ${bed.patientName} — ${dischargeType}`, ward.name, bed.patientName)
  return batch.commit()
}

/* ------------------------------ الردهات (للإدارة) ------------------------------ */

const wardDoc = (w: Ward) => ({
  name: clean(w.name),
  order: w.order,
  unit: w.unit,
  beds: w.beds,
  procedureLabel: clean(w.procedureLabel),
  vitals: w.vitals,
  population: w.population,
})

/** عند أول تعديل: حفظ الردهات الافتراضية فعلياً في قاعدة البيانات */
function materialize(batch: WriteBatch, wards: Ward[], virtual: boolean) {
  if (!virtual) return
  for (const w of wards) batch.set(doc(db, 'wards', w.id), wardDoc(w))
  batch.set(doc(db, 'settings', 'app'), { wardsInitialized: true }, { merge: true })
}

export function saveWard(wards: Ward[], virtual: boolean, ward: Ward, isNew: boolean, role: Role): Promise<void> {
  const batch = writeBatch(db)
  materialize(batch, wards, virtual)
  batch.set(doc(db, 'wards', ward.id), wardDoc(ward))
  if (!virtual) batch.set(doc(db, 'settings', 'app'), { wardsInitialized: true }, { merge: true })
  logActivity(batch, role, 'ward', `${isNew ? 'إضافة' : 'تعديل'} ${ward.name} (${ward.beds} ${UNITS[ward.unit].many})`, ward.name)
  return batch.commit()
}

export function deleteWard(wards: Ward[], virtual: boolean, ward: Ward, role: Role): Promise<void> {
  const batch = writeBatch(db)
  materialize(batch, wards, virtual)
  batch.delete(doc(db, 'wards', ward.id))
  logActivity(batch, role, 'ward', `حذف ${ward.name}`, ward.name)
  return batch.commit()
}

export function reorderWards(wards: Ward[], virtual: boolean, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db)
  materialize(batch, wards, virtual)
  orderedIds.forEach((id, i) => batch.set(doc(db, 'wards', id), { order: i + 1 }, { merge: true }))
  return batch.commit()
}

/* ------------------------------ الإعدادات والترويسة ------------------------------ */

export function saveSheet(wardId: string, sheet: Sheet): Promise<void> {
  return setDoc(
    doc(db, 'sheets', wardId),
    { date: clean(sheet.date), shift: clean(sheet.shift), resident: clean(sheet.resident) },
    { merge: true },
  )
}

export function saveSettings(data: Partial<Omit<AppSettings, 'wardsInitialized'>>): Promise<void> {
  return setDoc(doc(db, 'settings', 'app'), data, { merge: true })
}

/* ------------------------------ دليل الهواتف ------------------------------ */

export type ContactInput = Omit<Contact, 'id'>

export function addContact(c: ContactInput): Promise<unknown> {
  return addDoc(collection(db, 'contacts'), { ...c, createdAt: serverTimestamp() })
}

export function updateContact(id: string, c: ContactInput): Promise<void> {
  return updateDoc(doc(db, 'contacts', id), { ...c })
}

export function deleteContact(id: string): Promise<void> {
  return deleteDoc(doc(db, 'contacts', id))
}

/* ------------------------------ الخفارات ------------------------------ */

export function setShiftDay(monthId: string, day: number, assignments: Record<string, string>): Promise<void> {
  const cleaned: Record<string, string> = {}
  for (const [k, v] of Object.entries(assignments)) cleaned[k] = clean(v)
  return setDoc(doc(db, 'shifts', monthId), { days: { [String(day)]: cleaned } }, { merge: true })
}

/** نسخ أسماء الخفارات من شهر إلى آخر حسب رقم اليوم — يعيد عدد الأيام المنسوخة */
export async function copyShiftMonth(fromId: string, toId: string, days: number): Promise<number> {
  const snap = await getDoc(doc(db, 'shifts', fromId))
  const source = (snap.data()?.days ?? {}) as Record<string, Record<string, string>>
  const copied: Record<string, Record<string, string>> = {}
  for (let d = 1; d <= days; d++) if (source[String(d)]) copied[String(d)] = source[String(d)]
  const count = Object.keys(copied).length
  if (count) await setDoc(doc(db, 'shifts', toId), { days: copied }, { merge: true })
  return count
}

export function setShiftNote(monthId: string, note: string): Promise<void> {
  return setDoc(doc(db, 'shifts', monthId), { note: clean(note) }, { merge: true })
}

/* ------------------------------ التبليغات والسجلات ------------------------------ */

export function addAnnouncement(title: string, body: string, level: AnnouncementLevel, role: Role): Promise<unknown> {
  return addDoc(collection(db, 'announcements'), {
    title: clean(title),
    body: clean(body),
    level,
    author: operatorLabel(role),
    createdAt: serverTimestamp(),
  })
}

export function deleteAnnouncement(id: string): Promise<void> {
  return deleteDoc(doc(db, 'announcements', id))
}

export function deleteArchived(id: string): Promise<void> {
  return deleteDoc(doc(db, 'archive', id))
}
