import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, type FirestoreError } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_SETTINGS, EMPTY_SLOT } from '../lib/constants'
import { currentShiftDate, monthId } from '../lib/dates'
import { wardIdOf } from '../lib/ids'
import { useAuth } from './auth'
import type {
  Announcement,
  AppSettings,
  ArchivedPatient,
  Contact,
  SectionKey,
  ShiftDay,
  ShiftMonth,
  Sheet,
  Slot,
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
  sheets: Record<string, Sheet>
  slots: Record<string, Slot>
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
  const [wardDocs, setWardDocs] = useState<Record<string, Raw>>({})
  const [sheets, setSheets] = useState<Record<string, Sheet>>({})
  const [slots, setSlots] = useState<Record<string, Slot>>({})
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
      ? (r.positions as Raw[])
          .map((p) => ({ id: s(p.id), label: s(p.label) }))
          .filter((p) => p.id && p.label)
      : DEFAULT_SETTINGS.positions
    return {
      wardCount: Math.min(n(r.wardCount, DEFAULT_SETTINGS.wardCount), 60),
      defaultRooms: Math.min(n(r.defaultRooms, DEFAULT_SETTINGS.defaultRooms), 60),
      defaultBeds: Math.min(n(r.defaultBeds, DEFAULT_SETTINGS.defaultBeds), 60),
      shiftStart: /^\d{1,2}:\d{2}$/.test(s(r.shiftStart)) ? s(r.shiftStart) : DEFAULT_SETTINGS.shiftStart,
      positions: positions.length ? positions : DEFAULT_SETTINGS.positions,
    }
  }, [settingsRaw])

  const shiftDate = useMemo(() => currentShiftDate(settings.shiftStart, new Date(clock)), [settings.shiftStart, clock])
  const todayMonth = monthId(shiftDate)
  const todayDay = shiftDate.getDate()

  useEffect(() => {
    if (!user) {
      setSettingsRaw(null)
      setWardDocs({})
      setSheets({})
      setSlots({})
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
          const map: Record<string, Raw> = {}
          snap.forEach((d) => (map[d.id] = d.data()))
          setWardDocs(map)
        },
        onError,
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
        collection(db, 'slots'),
        { includeMetadataChanges: true },
        (snap) => {
          const map: Record<string, Slot> = {}
          snap.forEach((d) => {
            const r = d.data({ serverTimestamps: 'estimate' })
            const section: SectionKey = r.section === 'icu' ? 'icu' : 'rooms'
            map[d.id] = {
              ...EMPTY_SLOT,
              id: d.id,
              wardId: s(r.wardId),
              section,
              index: typeof r.index === 'number' ? r.index : 0,
              roomNo: s(r.roomNo),
              patientName: s(r.patientName),
              doctorName: s(r.doctorName),
              operation: s(r.operation),
              bp: s(r.bp),
              pulse: s(r.pulse),
              spo2: s(r.spo2),
              drain: s(r.drain),
              uop: s(r.uop),
              notes: s(r.notes),
              updatedAt: r.updatedAt ?? null,
              updatedBy: s(r.updatedBy),
              pending: d.metadata.hasPendingWrites,
            }
          })
          setSlots(map)
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
              createdAt: r.createdAt ?? null,
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

  const wards = useMemo<Ward[]>(() => {
    const list: Ward[] = []
    for (let i = 1; i <= settings.wardCount; i++) {
      const id = wardIdOf(i)
      const r = wardDocs[id] ?? {}
      list.push({
        id,
        order: i,
        number: s(r.number) || String(i),
        name: s(r.name),
        rooms: Math.min(n(r.rooms, settings.defaultRooms), 60),
        beds: Math.min(n(r.beds, settings.defaultBeds), 60),
      })
    }
    return list
  }, [wardDocs, settings])

  const value = useMemo<DataState>(
    () => ({
      settings,
      wards,
      sheets,
      slots,
      contacts,
      announcements,
      today: { monthId: todayMonth, day: todayDay, assignments: shiftDoc?.days?.[String(todayDay)] ?? {} },
      status,
    }),
    [settings, wards, sheets, slots, contacts, announcements, todayMonth, todayDay, shiftDoc, status],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataState {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}

/** هل الغرفة/السرير مشغول بمريض؟ */
export const isOccupied = (slot: Slot | undefined) => !!slot && slot.patientName.trim() !== ''

/** الاشتراك بجدول خفارات شهر معيّن */
export function useShiftMonth(id: string): { data: ShiftMonth | null; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ id: string; data: ShiftMonth | null; loading: boolean }>({
    id,
    data: null,
    loading: true,
  })
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

/** سجل المرضى المُخرَجين (آخر 100) */
export function useArchive(enabled: boolean): { list: ArchivedPatient[]; loading: boolean } {
  const { user } = useAuth()
  const [state, setState] = useState<{ list: ArchivedPatient[]; loading: boolean }>({ list: [], loading: true })
  useEffect(() => {
    if (!user || !enabled) return
    return onSnapshot(
      query(collection(db, 'archive'), orderBy('dischargedAt', 'desc'), limit(100)),
      (snap) => {
        const list: ArchivedPatient[] = []
        snap.forEach((d) => {
          const r = d.data({ serverTimestamps: 'estimate' })
          list.push({
            ...EMPTY_SLOT,
            id: d.id,
            wardId: s(r.wardId),
            wardNumber: s(r.wardNumber),
            section: r.section === 'icu' ? 'icu' : 'rooms',
            index: typeof r.index === 'number' ? r.index : 0,
            roomNo: s(r.roomNo),
            patientName: s(r.patientName),
            doctorName: s(r.doctorName),
            operation: s(r.operation),
            bp: s(r.bp),
            pulse: s(r.pulse),
            spo2: s(r.spo2),
            drain: s(r.drain),
            uop: s(r.uop),
            notes: s(r.notes),
            dischargedAt: r.dischargedAt ?? null,
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
