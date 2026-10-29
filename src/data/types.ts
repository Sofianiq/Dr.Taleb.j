import type { Timestamp } from 'firebase/firestore'

export type Role = 'admin' | 'staff'

export type SectionKey = 'rooms' | 'icu'

export interface Position {
  id: string
  label: string
}

export interface AppSettings {
  wardCount: number
  defaultRooms: number
  defaultBeds: number
  positions: Position[]
  shiftStart: string
}

export interface Ward {
  id: string
  order: number
  number: string
  name: string
  rooms: number
  beds: number
}

export interface Sheet {
  date: string
  shift: string
  resident: string
}

export interface SlotData {
  roomNo: string
  patientName: string
  doctorName: string
  operation: string
  bp: string
  pulse: string
  spo2: string
  drain: string
  uop: string
  notes: string
}

export interface Slot extends SlotData {
  id: string
  wardId: string
  section: SectionKey
  index: number
  updatedAt?: Timestamp | null
  updatedBy?: string
  pending?: boolean
}

export interface ArchivedPatient extends SlotData {
  id: string
  wardId: string
  wardNumber: string
  section: SectionKey
  index: number
  dischargedAt?: Timestamp | null
  dischargedBy?: string
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
