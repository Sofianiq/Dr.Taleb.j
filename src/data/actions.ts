import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EMPTY_SLOT, ROLE_LABEL } from '../lib/constants'
import { slotIdOf } from '../lib/ids'
import type {
  AnnouncementLevel,
  AppSettings,
  Contact,
  Role,
  SectionKey,
  Sheet,
  Slot,
  SlotData,
  Ward,
} from './types'

/**
 * ملاحظة: كتابات Firestore تُطبَّق محلياً فوراً وتظهر للجميع لحظة وصولها للخادم.
 * عند انقطاع الإنترنت تبقى الوعود (Promises) معلّقة حتى عودة الاتصال، لذلك لا ننتظرها في الواجهة.
 */

const clean = (v: string) => v.trim()

export function saveSlot(
  wardId: string,
  section: SectionKey,
  index: number,
  data: Partial<SlotData>,
  role: Role,
): Promise<void> {
  const payload: Record<string, unknown> = { wardId, section, index }
  for (const [k, v] of Object.entries(data)) payload[k] = clean(String(v ?? ''))
  payload.updatedAt = serverTimestamp()
  payload.updatedBy = ROLE_LABEL[role]
  return setDoc(doc(db, 'slots', slotIdOf(wardId, section, index)), payload, { merge: true })
}

/** إخراج المريض: نقل بياناته إلى السجل وتفريغ الغرفة مع الإبقاء على رقمها */
export function dischargeSlot(slot: Slot, ward: Ward, role: Role): Promise<void> {
  const batch = writeBatch(db)
  const archived = doc(collection(db, 'archive'))
  batch.set(archived, {
    wardId: ward.id,
    wardNumber: ward.number,
    section: slot.section,
    index: slot.index,
    roomNo: slot.roomNo,
    patientName: slot.patientName,
    doctorName: slot.doctorName,
    operation: slot.operation,
    bp: slot.bp,
    pulse: slot.pulse,
    spo2: slot.spo2,
    drain: slot.drain,
    uop: slot.uop,
    notes: slot.notes,
    dischargedAt: serverTimestamp(),
    dischargedBy: ROLE_LABEL[role],
  })
  const cleared: Record<string, unknown> = { ...EMPTY_SLOT, roomNo: slot.roomNo }
  cleared.updatedAt = serverTimestamp()
  cleared.updatedBy = ROLE_LABEL[role]
  batch.set(doc(db, 'slots', slot.id), cleared, { merge: true })
  return batch.commit()
}

export function saveSheet(wardId: string, sheet: Sheet): Promise<void> {
  return setDoc(
    doc(db, 'sheets', wardId),
    { date: clean(sheet.date), shift: clean(sheet.shift), resident: clean(sheet.resident) },
    { merge: true },
  )
}

export function saveWard(wardId: string, data: Partial<Pick<Ward, 'number' | 'name' | 'rooms' | 'beds'>>): Promise<void> {
  return setDoc(doc(db, 'wards', wardId), data, { merge: true })
}

export function saveSettings(data: Partial<AppSettings>): Promise<void> {
  return setDoc(doc(db, 'settings', 'app'), data, { merge: true })
}

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

/** تعيين شخص لمنصب خفارة في يوم معيّن */
export function setShiftCell(monthId: string, day: number, positionId: string, name: string): Promise<void> {
  return setDoc(
    doc(db, 'shifts', monthId),
    { days: { [String(day)]: { [positionId]: clean(name) } } },
    { merge: true },
  )
}

/** حفظ جدول يوم كامل */
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

export function addAnnouncement(title: string, body: string, level: AnnouncementLevel, role: Role): Promise<unknown> {
  return addDoc(collection(db, 'announcements'), {
    title: clean(title),
    body: clean(body),
    level,
    author: ROLE_LABEL[role],
    createdAt: serverTimestamp(),
  })
}

export function deleteAnnouncement(id: string): Promise<void> {
  return deleteDoc(doc(db, 'announcements', id))
}

export function deleteArchived(id: string): Promise<void> {
  return deleteDoc(doc(db, 'archive', id))
}
