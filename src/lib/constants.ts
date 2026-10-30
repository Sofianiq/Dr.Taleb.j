import type {
  AppSettings,
  BedStatus,
  Department,
  PatientData,
  Role,
  UnitKind,
  VitalKey,
  Ward,
} from '../data/types'

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

export const ROLE_LABEL: Record<Role, string> = { admin: 'الإدارة', staff: 'الكادر الطبي' }

/* ------------------------------ الوحدات ------------------------------ */

export const UNITS: Record<UnitKind, { one: string; many: string; the: string; code: string }> = {
  room: { one: 'غرفة', many: 'غرف', the: 'الغرفة', code: 'R' },
  bed: { one: 'سرير', many: 'أسرّة', the: 'السرير', code: 'B' },
  incubator: { one: 'حاضنة', many: 'حاضنات', the: 'الحاضنة', code: 'I' },
}

/** "20 غرفة" / "5 أسرّة" حسب قواعد العدد */
export function unitCount(n: number, unit: UnitKind): string {
  const u = UNITS[unit]
  if (n === 1) return `${u.one} واحد${unit === 'room' || unit === 'incubator' ? 'ة' : ''}`
  if (n >= 3 && n <= 10) return `${n} ${u.many}`
  return `${n} ${u.one}`
}

/* --------------------------- العلامات الحيوية --------------------------- */

export interface VitalDef {
  key: VitalKey
  label: string
  name: string
  unit: string
  placeholder: string
  numeric: boolean
}

export const VITALS: Record<VitalKey, VitalDef> = {
  bp: { key: 'bp', label: 'BP', name: 'ضغط الدم', unit: 'mmHg', placeholder: '120/80', numeric: false },
  pulse: { key: 'pulse', label: 'Pulse', name: 'النبض', unit: 'bpm', placeholder: '80', numeric: true },
  spo2: { key: 'spo2', label: 'SpO₂', name: 'تشبّع الأوكسجين', unit: '%', placeholder: '98', numeric: true },
  temp: { key: 'temp', label: 'Temp', name: 'الحرارة', unit: '°C', placeholder: '37.0', numeric: true },
  rr: { key: 'rr', label: 'RR', name: 'معدل التنفس', unit: '/min', placeholder: '16', numeric: true },
  rbs: { key: 'rbs', label: 'RBS', name: 'سكر الدم', unit: 'mg/dL', placeholder: '110', numeric: true },
  drain: { key: 'drain', label: 'Drain', name: 'التصريف', unit: 'ml', placeholder: '50', numeric: true },
  uop: { key: 'uop', label: 'UOP', name: 'الإدرار', unit: 'ml', placeholder: '400', numeric: true },
  weight: { key: 'weight', label: 'Wt', name: 'الوزن', unit: 'g', placeholder: '2500', numeric: true },
}

export const VITAL_ORDER: VitalKey[] = ['bp', 'pulse', 'spo2', 'temp', 'rr', 'rbs', 'drain', 'uop', 'weight']

/* ------------------------------ حالات السرير ------------------------------ */

export type Tone = 'brand' | 'critical' | 'info' | 'warn' | 'neutral' | 'muted'

export const STATUS: Record<BedStatus, { label: string; tone: Tone; hasPatient: boolean }> = {
  occupied: { label: 'مستقر', tone: 'brand', hasPatient: true },
  critical: { label: 'حرج', tone: 'critical', hasPatient: true },
  discharge: { label: 'جاهز للخروج', tone: 'info', hasPatient: true },
  empty: { label: 'شاغر', tone: 'neutral', hasPatient: false },
  reserved: { label: 'محجوز', tone: 'warn', hasPatient: false },
  cleaning: { label: 'تنظيف وتعقيم', tone: 'muted', hasPatient: false },
}

export const PATIENT_STATUSES: BedStatus[] = ['occupied', 'critical', 'discharge']
export const FREE_STATUSES: BedStatus[] = ['empty', 'reserved', 'cleaning']

export const DISCHARGE_TYPES = [
  'خروج بتحسّن',
  'تحويل إلى مستشفى آخر',
  'خروج على مسؤولية المريض',
  'وفاة',
]

export const EMPTY_PATIENT: PatientData = {
  patientName: '',
  age: '',
  sex: '',
  doctorName: '',
  procedure: '',
  familyPhone: '',
  notes: '',
}

/* ------------------------------ الردهات ------------------------------ */

export const PROCEDURE_LABELS = ['نوع العملية', 'نوع الإجراء', 'التشخيص']

/** الردهات الافتراضية للمستشفى — تُعدَّل وتُضاف ردهات أخرى من الإدارة */
export const DEFAULT_WARDS: Ward[] = [
  {
    id: 'surgery',
    order: 1,
    name: 'ردهة الجراحة',
    unit: 'room',
    beds: 20,
    procedureLabel: 'نوع العملية',
    vitals: ['bp', 'pulse', 'spo2', 'temp', 'drain', 'uop'],
    population: 'adult',
  },
  {
    id: 'cathlab',
    order: 2,
    name: 'ردهة القسطرة',
    unit: 'bed',
    beds: 5,
    procedureLabel: 'نوع الإجراء',
    vitals: ['bp', 'pulse', 'spo2', 'rr', 'uop'],
    population: 'adult',
  },
  {
    id: 'nicu',
    order: 3,
    name: 'ردهة الخدج',
    unit: 'bed',
    beds: 5,
    procedureLabel: 'التشخيص',
    vitals: ['pulse', 'spo2', 'temp', 'rr', 'weight'],
    population: 'neonate',
  },
]

export const MAX_BEDS = 60

/* ------------------------------ الأقسام ------------------------------ */

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'surgical-ward',
    name: 'ردهة العمليات الجراحية',
    description: 'رعاية المرضى قبل العمليات الجراحية وبعدها ومتابعة حالتهم على مدار الساعة.',
    position: 'surgeon',
  },
  {
    id: 'cathlab',
    name: 'صالة قسطرة القلب والشرايين',
    description: 'القسطرة التشخيصية والعلاجية للقلب والشرايين وزرع الدعامات.',
  },
  { id: 'nicu', name: 'الخدج', description: 'العناية بالأطفال حديثي الولادة والخدج.' },
  {
    id: 'theatre',
    name: 'العمليات',
    description: 'صالات العمليات الكبرى والصغرى وفريق التخدير.',
    position: 'anesthesia',
  },
  {
    id: 'lab',
    name: 'المختبر',
    description: 'التحاليل المرضية والكيمياوية وبنك الدم على مدار ٢٤ ساعة.',
    position: 'lab',
  },
  {
    id: 'radiology',
    name: 'الأشعة والسونار',
    description: 'الأشعة السينية والسونار والفحوصات التصويرية.',
    position: 'radiology',
  },
]

/** حرف القسم حسب ترتيبه: A, B, C ... */
export const deptLetter = (index: number) => String.fromCharCode(65 + (index % 26))

export const DEFAULT_SETTINGS: AppSettings = {
  shiftStart: '08:00',
  wardsInitialized: false,
  departments: DEFAULT_DEPARTMENTS,
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

export const SHIFT_OPTIONS = ['صباحي', 'مسائي', 'ليلي', '٢٤ ساعة']

/* ------------------------------ دليل الهواتف ------------------------------ */

const GENERAL_GROUPS: { id: string; label: string }[] = [
  { id: 'residents', label: 'الأطباء المقيمون' },
  { id: 'specialists', label: 'الأطباء الاختصاص' },
  { id: 'nursing', label: 'التمريض' },
  { id: 'inquiries', label: 'الاستعلامات' },
  { id: 'administration', label: 'الإدارة' },
  { id: 'other', label: 'أخرى' },
]

export function contactGroups(departments: Department[]): { id: string; label: string }[] {
  return [...departments.map((d) => ({ id: d.id, label: d.name })), ...GENERAL_GROUPS]
}

export function groupLabel(id: string, departments: Department[]): string {
  return contactGroups(departments).find((g) => g.id === id)?.label ?? 'أخرى'
}

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
