import type { Timestamp } from 'firebase/firestore'

export type Role = 'admin' | 'staff'

/** وحدة الإقامة في الردهة: غرفة أو سرير أو حاضنة */
export type UnitKind = 'room' | 'bed' | 'incubator'

/** مفاتيح العلامات الحيوية المتاحة */
export type VitalKey = 'bp' | 'pulse' | 'spo2' | 'temp' | 'rr' | 'rbs' | 'drain' | 'uop' | 'weight'

export type Population = 'adult' | 'neonate'

/** حالة السرير: الثلاث الأولى تعني وجود مريض */
export type BedStatus = 'occupied' | 'critical' | 'discharge' | 'empty' | 'reserved' | 'cleaning'

export interface Position {
  id: string
  label: string
}

export interface Department {
  id: string
  name: string
  description: string
  /** منصب الخفارة المرتبط بالقسم (اختياري) */
  position?: string
}

export interface AppSettings {
  positions: Position[]
  departments: Department[]
  shiftStart: string
  wardsInitialized: boolean
}

export interface Ward {
  id: string
  order: number
  name: string
  unit: UnitKind
  beds: number
  /** تسمية حقل الإجراء: نوع العملية / نوع الإجراء / التشخيص */
  procedureLabel: string
  vitals: VitalKey[]
  /** فئة المرضى (لحدود التنبيه في العلامات الحيوية) */
  population: Population
  /** ردهة افتراضية لم تُحفظ بعد في قاعدة البيانات */
  virtual?: boolean
}

export interface Sheet {
  date: string
  shift: string
  resident: string
}

export type Sex = 'ذكر' | 'أنثى' | ''

export interface PatientData {
  patientName: string
  age: string
  sex: Sex
  doctorName: string
  procedure: string
  familyPhone: string
  notes: string
}

export interface Bed extends PatientData {
  id: string
  wardId: string
  index: number
  /** رقم السرير/الغرفة المعروض (قابل للتعديل) */
  label: string
  status: BedStatus
  admissionId: string
  admittedAt: Timestamp | null
  vitals: Partial<Record<VitalKey, string>>
  vitalsAt: Timestamp | null
  vitalsBy: string
  updatedAt: Timestamp | null
  updatedBy: string
  pending?: boolean
}

export interface Observation {
  id: string
  admissionId: string
  values: Partial<Record<VitalKey, string>>
  at: Timestamp | null
  by: string
}

export interface ArchivedPatient extends PatientData {
  id: string
  admissionId: string
  wardId: string
  wardName: string
  bedLabel: string
  unit: UnitKind
  vitals: Partial<Record<VitalKey, string>>
  admittedAt: Timestamp | null
  dischargedAt: Timestamp | null
  dischargeType: string
  dischargeNote: string
  dischargedBy: string
}

export type ActivityAction = 'admit' | 'update' | 'vitals' | 'status' | 'transfer' | 'discharge' | 'ward'

export interface Activity {
  id: string
  action: ActivityAction
  text: string
  wardName: string
  patientName: string
  by: string
  at: Timestamp | null
}

export interface Contact {
  id: string
  name: string
  role: string
  dept: string
  phone: string
  note: string
}

export type AnnouncementLevel = 'normal' | 'important' | 'urgent'

export interface Announcement {
  id: string
  title: string
  body: string
  level: AnnouncementLevel
  author: string
  createdAt?: Timestamp | null
}

/** يوم في جدول الخفارات: معرّف المنصب ← اسم الشخص */
export type ShiftDay = Record<string, string>

export interface ShiftMonth {
  days: Record<string, ShiftDay>
  note?: string
}
