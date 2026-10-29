import type { AppSettings, Role, SectionKey, SlotData } from '../data/types'

export const HOSPITAL_AR = 'مستشفى الدكتور طالب الجنابي الأهلي'
export const HOSPITAL_SHORT = 'مستشفى الدكتور طالب الجنابي'
export const HOSPITAL_EN = 'Dr. Talib Al-Janabi Private Hospital'
export const MANAGED_BY = 'بإدارة الدكتور طالب الجنابي'

export const ADMIN_EMAIL = 'admin@dr.taleb.com'
export const STAFF_EMAIL = 'staff@dr.taleb.com'

export const ACCOUNTS: Record<Role, { email: string; label: string; description: string }> = {
  admin: { email: ADMIN_EMAIL, label: 'الإدارة', description: 'صلاحيات كاملة' },
  staff: { email: STAFF_EMAIL, label: 'الكادر الطبي', description: 'الأطباء والممرضون' },
}

export function roleOf(email: string | null | undefined): Role | null {
  const e = (email ?? '').trim().toLowerCase()
  if (e === ADMIN_EMAIL) return 'admin'
  if (e === STAFF_EMAIL) return 'staff'
  return null
}

export const ROLE_LABEL: Record<Role, string> = { admin: 'المدير', staff: 'الكادر الطبي' }

export const DEFAULT_SETTINGS: AppSettings = {
  wardCount: 20,
  defaultRooms: 20,
  defaultBeds: 10,
  shiftStart: '08:00',
  positions: [
    { id: 'resident', label: 'الطبيب المقيم' },
    { id: 'surgeon', label: 'الجراح الخافر' },
    { id: 'physician', label: 'طبيب الباطنية الخافر' },
    { id: 'anesthesia', label: 'طبيب التخدير' },
    { id: 'nurse', label: 'الممرض الخافر' },
    { id: 'lab', label: 'المختبر' },
    { id: 'radiology', label: 'الأشعة والسونار' },
  ],
}

export const SECTIONS: Record<
  SectionKey,
  { letter: string; title: string; unit: string; unitPlural: string; short: string; code: string }
> = {
  rooms: {
    letter: 'A',
    title: 'غرف العمليات الجراحية',
    unit: 'غرفة',
    unitPlural: 'غرف',
    short: 'الغرف',
    code: 'R',
  },
  icu: {
    letter: 'B',
    title: 'ردهة الإنعاش القلبي',
    unit: 'سرير',
    unitPlural: 'أسرّة',
    short: 'الأسرّة',
    code: 'B',
  },
}

export const EMPTY_SLOT: SlotData = {
  roomNo: '',
  patientName: '',
  doctorName: '',
  operation: '',
  bp: '',
  pulse: '',
  spo2: '',
  drain: '',
  uop: '',
  notes: '',
}

export const PATIENT_FIELDS: (keyof SlotData)[] = [
  'patientName',
  'doctorName',
  'operation',
  'bp',
  'pulse',
  'spo2',
  'drain',
  'uop',
  'notes',
]

export const SHIFT_OPTIONS = ['صباحي', 'مسائي', 'ليلي', '٢٤ ساعة']

export interface Department {
  id: string
  letter: string
  name: string
  description: string
  /** معرّف منصب الخفارة المرتبط بالقسم (إن وجد) */
  position?: string
}

/** أقسام الكادر الطبي */
export const DEPARTMENTS: Department[] = [
  {
    id: 'surgical-ward',
    letter: 'A',
    name: 'ردهة العمليات الجراحية',
    description: 'رعاية المرضى قبل العمليات الجراحية وبعدها ومتابعة حالتهم على مدار الساعة.',
    position: 'surgeon',
  },
  {
    id: 'cathlab',
    letter: 'B',
    name: 'صالة قسطرة القلب والشرايين',
    description: 'القسطرة التشخيصية والعلاجية للقلب والشرايين وزرع الدعامات.',
  },
  {
    id: 'nicu',
    letter: 'C',
    name: 'الخدج',
    description: 'العناية بالأطفال حديثي الولادة والخدج في الحاضنات.',
  },
  {
    id: 'theatre',
    letter: 'D',
    name: 'العمليات',
    description: 'صالات العمليات الكبرى والصغرى وفريق التخدير.',
    position: 'anesthesia',
  },
  {
    id: 'lab',
    letter: 'E',
    name: 'المختبر',
    description: 'التحاليل المرضية والكيمياوية وبنك الدم على مدار ٢٤ ساعة.',
    position: 'lab',
  },
  {
    id: 'radiology',
    letter: 'F',
    name: 'الأشعة والسونار',
    description: 'الأشعة السينية والسونار والفحوصات التصويرية.',
    position: 'radiology',
  },
]

/** تصنيفات دليل الهواتف: الأقسام الستة + فئات عامة */
export const CONTACT_GROUPS: { id: string; label: string }[] = [
  ...DEPARTMENTS.map((d) => ({ id: d.id, label: d.name })),
  { id: 'residents', label: 'الأطباء المقيمون' },
  { id: 'specialists', label: 'الأطباء الاختصاص' },
  { id: 'nursing', label: 'التمريض' },
  { id: 'inquiries', label: 'الاستعلامات' },
  { id: 'administration', label: 'الإدارة' },
  { id: 'other', label: 'أخرى' },
]

export const CONTACT_ROLES = [
  'طبيب اختصاص',
  'طبيب مقيم',
  'طبيب',
  'ممرض/ة',
  'رئيس/ة تمريض',
  'فني',
  'إداري',
  'موظف استعلامات',
  'أخرى',
]

export function groupLabel(id: string): string {
  return CONTACT_GROUPS.find((g) => g.id === id)?.label ?? 'أخرى'
}
