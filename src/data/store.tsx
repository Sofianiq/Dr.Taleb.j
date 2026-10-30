import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_SETTINGS, DEFAULT_WARDS, EMPTY_PATIENT, MAX_BEDS, STATUS, UNITS, VITAL_ORDER } from '../lib/constants'
import { currentShiftDate, monthId } from '../lib/dates'
import { bedIdOf, twoDigits } from '../lib/ids'
import { useAuth } from './auth'
import type {
  Activity,
  ActivityAction,
  Announcement,
  AppSettings,
  ArchivedPatient,
  Bed,
  BedStatus,
  Contact,
  Department,
  Observation,
  Sex,
  ShiftDay,
  ShiftMonth,
  Sheet,
  UnitKind,
  VitalKey,
  Ward,
} from './types'

interface SyncStatus {
  loaded: boolean
  fromCache: boolean
  pendingWrites: boolean
  error: string | null
}

interface DataState {
  settings: AppSettings
  wards: Ward[]
  /** اكتمل تحميل قائمة الردهات (من الخادم أو من ذاكرة الجهاز) */
  wardsReady: boolean
  /** الردهات افتراضية ولم تُحفظ بعد (أول تشغيل) */
  wardsVirtual: boolean
  beds: Record<string, Bed>
  sheets: Record<string, Sheet>
  contacts: Contact[]
  announcements: Announcement[]
  /** خفارة اليوم الحالي (حسب موعد بدء الخفارة) */
  today: { monthId: string; day: number; assignments: ShiftDay }
  status: SyncStatus
}

const DataContext = createContext<DataState | null>(null)

type Raw = Record<string, unknown>
const s = (v: unknown, fallback = '') => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback)
const n = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback)
const ts = (v: unknown) => (v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp) : null)

const UNIT_KEYS = Object.keys(UNITS) as UnitKind[]
const STATUS_KEYS = Object.keys(STATUS) as BedStatus[]

function parseVitals(v: unknown): Partial<Record<VitalKey, string>> {
  const out: Partial<Record<VitalKey, string>> = {}
  if (v && typeof v === 'object') {
    for (const k of VITAL_ORDER) {
      const val = (v as Raw)[k]
      if (typeof val === 'string' || typeof val === 'number') out[k] = String(val)
    }
  }
  return out
}

function parseWard(id: string, r: Raw, fallbackOrder: number): Ward | null {
  // نتجاهل مستندات الإصدار الأول التي لا تحتوي على اسم ونوع وحدة
  if (typeof r.name !== 'string' || !UNIT_KEYS.includes(r.unit as UnitKind)) return null
  const vitals = Array.isArray(r.vitals) ? (r.vitals as unknown[]).filter((k): k is VitalKey => VITAL_ORDER.includes(k as VitalKey)) : []
  return {
    id,
    order: typeof r.order === 'number' ? r.order : fallbackOrder,
    name: r.name,
    unit: r.unit as UnitKind,
    beds: Math.min(n(r.beds, 1), MAX_BEDS),
    procedureLabel: s(r.procedureLabel, 'نوع العملية') || 'نوع العملية',
    vitals,
    population: r.population === 'neonate' ? 'neonate' : 'adult',
  }
}

export function parseBed(id: string, r: Raw, pending = false): Bed {
  const patientName = s(r.patientName)
  let status = STATUS_KEYS.includes(r.status as BedStatus) ? (r.status as BedStatus) : 'empty'
  if (!STATUS[status].hasPatient && patientName) status = 'occupied'
  if (STATUS[status].hasPatient && !patientName) status = 'empty'
  const sex = r.sex === 'ذكر' || r.sex === 'أنثى' ? (r.sex as Sex) : ''
  return {
    id,
    wardId: s(r.wardId),
    index: typeof r.index === 'number' ? r.index : 0,
    label: s(r.label),
    status,
    patientName,
    age: s(r.age),
    sex,
    doctorName: s(r.doctorName),
    procedure: s(r.procedure),
    familyPhone: s(r.familyPhone),
    notes: s(r.notes),
    admissionId: s(r.admissionId),
    admittedAt: ts(r.admittedAt),
    vitals: parseVitals(r.vitals),
    vitalsAt: ts(r.vitalsAt),
    vitalsBy: s(r.vitalsBy),
    updatedAt: ts(r.updatedAt),
    updatedBy: s(r.updatedBy),
    pending,
  }
}

/** سرير فارغ افتراضي (لم يُكتب في قاعدة البيانات بعد) */
export function emptyBed(ward: Ward, index: number): Bed {
  return {
    ...EMPTY_PATIENT,
    id: bedIdOf(ward.id, index),
    wardId: ward.id,
    index,
    label: '',
    status: 'empty',
    admissionId: '',
    admittedAt: null,
    vitals: {},
    vitalsAt: null,
    vitalsBy: '',
    updatedAt: null,
    updatedBy: '',
  }
}

export const bedLabel = (bed: Bed) => bed.label || twoDigits(bed.index)

export const hasPatient = (bed: Bed | undefined) => !!bed && STATUS[bed.status].hasPatient && bed.patientName.trim() !== ''

/** جميع أسرّة الردهة بالترتيب (المحفوظة والافتراضية) */
export function wardBeds(ward: Ward, beds: Record<string, Bed>): Bed[] {
  const list: Bed[] = []
  for (let i = 1; i <= ward.beds; i++) list.push(beds[bedIdOf(ward.id, i)] ?? emptyBed(ward, i))
  return list
}

function errorMessage(err: FirestoreError): string {
  if (err.code === 'permission-denied')
    return 'لا توجد صلاحية للوصول إلى قاعدة البيانات. تأكد من نشر قواعد الأمان (firestore.rules) في Firebase.'
  if (err.code === 'not-found' || err.code === 'failed-precondition')
    return 'قاعدة بيانات Firestore غير مُنشأة بعد في مشروع Firebase. راجع دليل الإعداد.'
  if (err.code === 'unavailable') return 'تعذّر الاتصال بالخادم — يعمل التطبيق حالياً بالبيانات المحفوظة على الجهاز.'
  return `خطأ في المزامنة: ${err.message}`
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settingsRaw, setSettingsRaw] = useState<Raw | null>(null)
  const [wardDocs, setWardDocs] = useState<Ward[]>([])
  const [wardsLoaded, setWardsLoaded] = useState(false)
  const [sheets, setSheets] = useState<Record<string, Sheet>>({})
  const [beds, setBeds] = useState<Record<string, Bed>>({})
  const [contacts, setContacts] = useState<Contact[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [shiftDoc, setShiftDoc] = useState<ShiftMonth | null>(null)
  const [status, setStatus] = useState<SyncStatus>({ loaded: false, fromCache: true, pendingWrites: false, error: null })
  const [clock, setClock] = useState(() => Date.now())

  // تحديث "اليوم الحالي" كل دقيقة
  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const settings = useMemo<AppSettings>(() => {
    const r = settingsRaw ?? {}
    const positions = Array.isArray(r.positions)
      ? (r.positions as Raw[]).map((p) => ({ id: s(p.id), label: s(p.label) })).filter((p) => p.id && p.label)
      : []
    const departments: Department[] = Array.isArray(r.departments)
      ? (r.departments as Raw[])
          .map((d) => ({ id: s(d.id), name: s(d.name), description: s(d.description), position: s(d.position) || undefined }))
          .filter((d) => d.id && d.name)
      : DEFAULT_SETTINGS.departments
    return {
      shiftStart: /^\d{1,2}:\d{2}$/.test(s(r.shiftStart)) ? s(r.shiftStart) : DEFAULT_SETTINGS.shiftStart,
      positions: positions.length ? positions : DEFAULT_SETTINGS.positions,
      departments,
      wardsInitialized: r.wardsInitialized === true,
    }
  }, [settingsRaw])

  const shiftDate = useMemo(() => currentShiftDate(settings.shiftStart, new Date(clock)), [settings.shiftStart, clock])
  const todayMonth = monthId(shiftDate)
  const todayDay = shiftDate.getDate()

  useEffect(() => {
    if (!user) {
      setSettingsRaw(null)
      setWardDocs([])
      setWardsLoaded(false)
      setSheets({})
      setBeds({})
      setContacts([])
      setAnnouncements([])
      setStatus({ loaded: false, fromCache: true, pendingWrites: false, error: null })
      return
    }

    const onError = (err: FirestoreError) => setStatus((st) => ({ ...st, loaded: true, error: errorMessage(err) }))
    const unsubs: (() => void)[] = []

    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'app'),
        { includeMetadataChanges: true },
        (snap) => {
          setSettingsRaw(snap.exists() ? (snap.data() as Raw) : null)
          setStatus((st) => ({
            ...st,
            loaded: true,
            fromCache: snap.metadata.fromCache,
            error: snap.metadata.fromCache ? st.error : null,
          }))
        },
        onError,
      ),
    )

    unsubs.push(
      onSnapshot(
        collection(db, 'wards'),
        (snap) => {
          const list: Ward[] = []
          snap.forEach((d) => {
            const w = parseWard(d.id, d.data(), list.length + 1)
            if (w) list.push(w)
          })
          list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ar'))
          setWardDocs(list)
          setWardsLoaded(true)
        },
        (err) => {
          setWardsLoaded(true)
          onError(err)
        },
      ),
    )

    unsubs.push(
      onSnapshot(
        collection(db, 'sheets'),
        (snap) => {
          const map: Record<string, Sheet> = {}
          snap.forEach((d) => {
            const r = d.data()
            map[d.id] = { date: s(r.date), shift: s(r.shift), resident: s(r.resident) }
          })
          setSheets(map)
        },
        onError,
      ),
    )

    unsubs.push(
      onSnapshot(
        collection(db, 'beds'),
        { includeMetadataChanges: true },
        (snap) => {
          const map: Record<string, Bed> = {}
          snap.forEach((d) => {
            map[d.id] = parseBed(d.id, d.data({ serverTimestamps: 'estimate' }), d.metadata.hasPendingWrites)
          })
          setBeds(map)
          setStatus((st) => ({ ...st, pendingWrites: snap.metadata.hasPendingWrites }))
        },
        onError,
      ),
    )

    unsubs.push(
      onSnapshot(
        collection(db, 'contacts'),
        (snap) => {
          const list: Contact[] = []
          snap.forEach((d) => {
            const r = d.data()
            list.push({ id: d.id, name: s(r.name), role: s(r.role), dept: s(r.dept, 'other'), phone: s(r.phone), note: s(r.note) })
          })
          list.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
          setContacts(list)
        },
        onError,
      ),
    )

    unsubs.push(
      onSnapshot(
        query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50)),
        (snap) => {
          const list: Announcement[] = []
          snap.forEach((d) => {
            const r = d.data({ serverTimestamps: 'estimate' })
            list.push({
              id: d.id,
              title: s(r.title),
              body: s(r.body),
              level: r.level === 'urgent' || r.level === 'important' ? r.level : 'normal',
              author: s(r.author),
              createdAt: ts(r.createdAt),
            })
          })
          setAnnouncements(list)
        },
        onError,
      ),
    )

    return () => unsubs.forEach((u) => u())
  }, [user])

  // خفارة الشهر الحالي
  useEffect(() => {
    if (!user) {
      setShiftDoc(null)
      return
    }
    return onSnapshot(
      doc(db, 'shifts', todayMonth),
      (snap) => setShiftDoc(snap.exists() ? (snap.data() as ShiftMonth) : null),
      () => setShiftDoc(null),
    )
  }, [user, todayMonth])

  // لا نقرر أن الردهات افتراضية إلا بعد وصول الإعدادات وقائمة الردهات معاً
  const wardsReady = wardsLoaded && status.loaded
  const wardsVirtual = wardsReady && !settings.wardsInitialized && wardDocs.length === 0
  const wards = useMemo<Ward[]>(
    () => (!wardsReady ? [] : wardsVirtual ? DEFAULT_WARDS.map((w) => ({ ...w, virtual: true })) : wardDocs),
    [wardsReady, wardsVirtual, wardDocs],
  )

  const value = useMemo<DataState>(
    () => ({
      settings,
      wards,
      wardsReady,
      wardsVirtual,
      beds,
      sheets,
      contacts,
      announcements,
      today: { monthId: todayMonth, day: todayDay, assignments: shiftDoc?.days?.[String(todayDay)] ?? {} },
      status,
    }),
    [settings, wards, wardsReady, wardsVirtual, beds, sheets, contacts, announcements, todayMonth, todayDay, shiftDoc, status],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

/** إحصاءات الإشغال لكل ردهة وللمستشفى كاملاً */
export function useCensus() {
  const { wards, beds } = useData()
  return useMemo(() => {
    const byWard: Record<string, Record<BedStatus, number> & { patients: number; capacity: number }> = {}
    const total = { patients: 0, capacity: 0, occupied: 0, critical: 0, discharge: 0, empty: 0, reserved: 0, cleaning: 0 }
    for (const w of wards) {
      const row = { patients: 0, capacity: w.beds, occupied: 0, critical: 0, discharge: 0, empty: 0, reserved: 0, cleaning: 0 }
      for (const b of wardBeds(w, beds)) {
        row[b.status]++
        if (STATUS[b.status].hasPatient) row.patients++
      }
      byWard[w.id] = row
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += row[k]
    }
    return { byWard, total }
  }, [wards, beds])
}

/** الاشتراك بجدول خفارات شهر معيّن */
export function useShiftMonth(id: string): { data: ShiftMonth | null; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ id: string; data: ShiftMonth | null; loading: boolean }>({ id, data: null, loading: true })
  useEffect(() => {
    if (!user) return
    setState({ id, data: null, loading: true })
    return onSnapshot(
      doc(db, 'shifts', id),
      (snap) => setState({ id, data: snap.exists() ? (snap.data() as ShiftMonth) : null, loading: false }),
      () => setState({ id, data: null, loading: false }),
    )
  }, [user, id])
  return state.id === id ? { data: state.data, loading: state.loading } : { data: null, loading: true }
}

/** سجل العلامات الحيوية لرقود معيّن (مرتّب من الأقدم للأحدث) */
export function useObservations(admissionId: string | undefined): { list: Observation[]; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ key: string; list: Observation[]; loading: boolean }>({ key: '', list: [], loading: true })
  useEffect(() => {
    if (!user || !admissionId) return
    setState({ key: admissionId, list: [], loading: true })
    return onSnapshot(
      query(collection(db, 'observations'), where('admissionId', '==', admissionId)),
      (snap) => {
        const list: Observation[] = []
        snap.forEach((d) => {
          const r = d.data({ serverTimestamps: 'estimate' })
          list.push({ id: d.id, admissionId: s(r.admissionId), values: parseVitals(r.values), at: ts(r.at), by: s(r.by) })
        })
        list.sort((a, b) => (a.at?.toMillis() ?? 0) - (b.at?.toMillis() ?? 0))
        setState({ key: admissionId, list, loading: false })
      },
      () => setState({ key: admissionId, list: [], loading: false }),
    )
  }, [user, admissionId])
  if (!admissionId) return { list: [], loading: false }
  return state.key === admissionId ? { list: state.list, loading: state.loading } : { list: [], loading: true }
}

/** سجل المرضى المُخرَجين (آخر 200) */
export function useArchive(enabled: boolean): { list: ArchivedPatient[]; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ list: ArchivedPatient[]; loading: boolean }>({ list: [], loading: true })
  useEffect(() => {
    if (!user || !enabled) return
    return onSnapshot(
      query(collection(db, 'archive'), orderBy('dischargedAt', 'desc'), limit(200)),
      (snap) => {
        const list: ArchivedPatient[] = []
        snap.forEach((d) => {
          const r = d.data({ serverTimestamps: 'estimate' })
          list.push({
            id: d.id,
            admissionId: s(r.admissionId),
            wardId: s(r.wardId),
            wardName: s(r.wardName) || (r.wardNumber ? `ردهة ${s(r.wardNumber)}` : ''),
            bedLabel: s(r.bedLabel) || s(r.roomNo),
            unit: UNIT_KEYS.includes(r.unit as UnitKind) ? (r.unit as UnitKind) : 'bed',
            patientName: s(r.patientName),
            age: s(r.age),
            sex: r.sex === 'ذكر' || r.sex === 'أنثى' ? (r.sex as Sex) : '',
            doctorName: s(r.doctorName),
            procedure: s(r.procedure) || s(r.operation),
            familyPhone: s(r.familyPhone),
            notes: s(r.notes),
            vitals: parseVitals(r.vitals),
            admittedAt: ts(r.admittedAt),
            dischargedAt: ts(r.dischargedAt),
            dischargeType: s(r.dischargeType),
            dischargeNote: s(r.dischargeNote),
            dischargedBy: s(r.dischargedBy),
          })
        })
        setState({ list, loading: false })
      },
      () => setState({ list: [], loading: false }),
    )
  }, [user, enabled])
  return state
}

const ACTIONS: ActivityAction[] = ['admit', 'update', 'vitals', 'status', 'transfer', 'discharge', 'ward']

/** آخر النشاطات في المستشفى */
export function useActivity(enabled: boolean, count = 30): { list: Activity[]; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ list: Activity[]; loading: boolean }>({ list: [], loading: true })
  useEffect(() => {
    if (!user || !enabled) return
    return onSnapshot(
      query(collection(db, 'activity'), orderBy('at', 'desc'), limit(count)),
      (snap) => {
        const list: Activity[] = []
        snap.forEach((d) => {
          const r = d.data({ serverTimestamps: 'estimate' })
          list.push({
            id: d.id,
            action: ACTIONS.includes(r.action as ActivityAction) ? (r.action as ActivityAction) : 'update',
            text: s(r.text),
            wardName: s(r.wardName),
            patientName: s(r.patientName),
            by: s(r.by),
            at: ts(r.at),
          })
        })
        setState({ list, loading: false })
      },
      () => setState({ list: [], loading: false }),
    )
  }, [user, enabled, count])
  return state
}
