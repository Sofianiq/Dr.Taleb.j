import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BedDouble,
  BookUser,
  Building2,
  DoorOpen,
  KeyRound,
  ListChecks,
  LogOut,
  Megaphone,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChangePasswordSheet } from '../components/AccountSheet'
import { EmptyState, Field, Logo, PageHeader, Segmented, Sheet, StatTile, useConfirm, useToast } from '../components/ui'
import { addAnnouncement, deleteAnnouncement, deleteArchived, saveSettings } from '../data/actions'
import { useAuth } from '../data/auth'
import { useArchive, useData } from '../data/store'
import type { AnnouncementLevel, Position } from '../data/types'
import { logout } from '../lib/auth'
import { HOSPITAL_AR, MANAGED_BY, ROLE_LABEL, SECTIONS } from '../lib/constants'
import { dateTime, timeAgo } from '../lib/dates'
import { twoDigits } from '../lib/ids'
import { useWardOccupancy } from './Resident'

const LEVELS: Record<AnnouncementLevel, { label: string; cls: string; bar: string }> = {
  normal: { label: 'عادي', cls: 'bg-surface-3 text-ink-2', bar: 'bg-line-strong' },
  important: { label: 'مهم', cls: 'bg-warn-soft text-warn', bar: 'bg-warn' },
  urgent: { label: 'عاجل', cls: 'bg-accent-soft text-accent', bar: 'bg-accent' },
}

export function AdminPage() {
  const { isAdmin, role } = useAuth()
  const { wards, contacts, announcements } = useData()
  const occupancy = useWardOccupancy()
  const confirm = useConfirm()
  const toast = useToast()
  const [annOpen, setAnnOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const totals = useMemo(() => {
    let rooms = 0
    let icu = 0
    for (const w of wards) {
      rooms += occupancy[w.id]?.rooms ?? 0
      icu += occupancy[w.id]?.icu ?? 0
    }
    return { rooms, icu }
  }, [wards, occupancy])

  const removeAnnouncement = async (id: string, title: string) => {
    const ok = await confirm({ title: 'حذف التبليغ', message: `هل تريد حذف «${title}»؟`, confirmLabel: 'حذف', danger: true })
    if (!ok) return
    deleteAnnouncement(id).catch(() => toast('تعذّر الحذف', 'error'))
  }

  return (
    <div className="anim-fade-up">
      <PageHeader title="الإدارة" subtitle={isAdmin ? 'لوحة التحكم — صلاحيات كاملة' : 'التبليغات والإحصائيات'} icon={<Building2 size={22} />} />

      {/* هوية المستشفى */}
      <div className="relative mb-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-l from-[#06432a] via-[#0b6a40] to-[#14935a] p-5 text-white shadow-card">
        <div className="pattern-bg absolute inset-0 opacity-60" />
        <div className="relative flex items-center gap-4">
          <Logo size={68} className="ring-2 ring-white/70" />
          <div className="min-w-0">
            <div className="font-display text-[1.1rem] font-bold leading-snug">{HOSPITAL_AR}</div>
            <div className="text-[0.88rem] font-semibold text-white/90">{MANAGED_BY}</div>
            <div className="mt-1 text-[0.76rem] text-white/70">تأسست عام ٢٠٠٢ — الفلوجة — خدمة على مدار ٢٤ ساعة</div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="إجمالي المرضى" value={totals.rooms + totals.icu} icon={<Users size={20} />} />
        <StatTile label="غرف العمليات المشغولة" value={totals.rooms} icon={<DoorOpen size={20} />} tone="info" />
        <StatTile label="أسرّة الإنعاش المشغولة" value={totals.icu} icon={<BedDouble size={20} />} tone="accent" />
        <StatTile label="أرقام الكادر" value={contacts.length} icon={<BookUser size={20} />} tone="coral" />
      </div>

      {/* التبليغات */}
      <section className="mb-6">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="section-title flex items-center gap-2">
            <Megaphone size={18} className="text-brand" />
            التعاميم والتبليغات
          </h2>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAnnOpen(true)}>
              <Plus size={16} />
              تبليغ جديد
            </button>
          )}
        </div>
        {announcements.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Megaphone size={26} />} title="لا توجد تبليغات">
              {isAdmin ? 'أرسل تبليغاً يظهر فوراً لجميع الكادر.' : 'تظهر هنا تبليغات الإدارة فور نشرها.'}
            </EmptyState>
          </div>
        ) : (
          <div className="space-y-2.5">
            {announcements.map((a) => {
              const lv = LEVELS[a.level]
              const at = a.createdAt?.toDate?.()
              return (
                <article key={a.id} className="card relative overflow-hidden p-4 ps-5">
                  <span className={`absolute inset-y-0 start-0 w-1.5 ${lv.bar}`} />
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink">{a.title}</h3>
                        {a.level !== 'normal' && <span className={`chip ${lv.cls}`}>{lv.label}</span>}
                      </div>
                      {a.body && <p className="mt-1 whitespace-pre-line text-[0.92rem] leading-relaxed text-ink-2">{a.body}</p>}
                      <div className="mt-2 text-[0.75rem] text-muted">
                        {a.author} {at && `• ${timeAgo(at)}`}
                      </div>
                    </div>
                    {isAdmin && (
                      <button type="button" className="btn btn-ghost btn-icon -me-2 -mt-1 text-muted hover:text-accent" onClick={() => removeAnnouncement(a.id, a.title)} aria-label="حذف التبليغ">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* نسبة الإشغال */}
      <section className="mb-6">
        <h2 className="section-title mb-0.5 flex items-center gap-2">
          <BarChart3 size={18} className="text-brand" />
          إشغال الردهات
        </h2>
        <p className="mb-2.5 text-[0.8rem] text-muted">عدد المرضى من السعة الكلية (غرف العمليات + أسرّة الإنعاش) لكل ردهة</p>
        <div className="card space-y-1 p-4">
          {wards.map((w) => {
            const occ = (occupancy[w.id]?.rooms ?? 0) + (occupancy[w.id]?.icu ?? 0)
            const cap = w.rooms + w.beds
            const pct = cap ? Math.round((occ / cap) * 100) : 0
            return (
              <Link
                key={w.id}
                to={`/resident/ward/${w.id}`}
                className="group flex items-center gap-3 rounded-lg py-1 hover:bg-surface-2"
                title={`ردهة ${w.number}: ${occ} من ${cap} (${pct}%) — غرف ${occupancy[w.id]?.rooms ?? 0}، إنعاش ${occupancy[w.id]?.icu ?? 0}`}
              >
                <span className="w-16 shrink-0 truncate text-[0.82rem] font-semibold text-ink-2">ردهة {w.number}</span>
                <span className="relative h-3 flex-1 overflow-hidden rounded-[4px] bg-chart-track">
                  <span
                    className="absolute inset-y-0 start-0 rounded-e-[4px] bg-chart transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-14 shrink-0 text-end text-[0.8rem] font-semibold text-ink-2 tabular-nums">
                  {occ}/{cap}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* أدوات المدير */}
      <section className="mb-6">
        <h2 className="section-title mb-2.5 flex items-center gap-2">
          <Settings2 size={18} className="text-brand" />
          {isAdmin ? 'أدوات الإدارة' : 'السجلات والحساب'}
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {isAdmin && (
            <>
              <ToolButton icon={<Settings2 size={20} />} title="إعدادات الردهات والخفارة" sub="عدد الردهات والغرف والأسرّة ووقت بدء الخفارة" onClick={() => setSettingsOpen(true)} />
              <ToolButton icon={<ListChecks size={20} />} title="مناصب جدول الخفارات" sub="تعديل أعمدة جدول الكولات" onClick={() => setPositionsOpen(true)} />
              <ToolLink icon={<BookUser size={20} />} title="إدارة دليل الهواتف" sub="إضافة وتعديل أرقام الكادر" to="/staff/directory" />
            </>
          )}
          <ToolButton icon={<Archive size={20} />} title="سجل المرضى المُخرَجين" sub="آخر ١٠٠ مريض تم إخراجهم" onClick={() => setArchiveOpen(true)} />
          <ToolButton icon={<KeyRound size={20} />} title="تغيير كلمة المرور" sub={`حساب ${role ? ROLE_LABEL[role] : ''}`} onClick={() => setPwOpen(true)} />
          <ToolButton
            icon={<LogOut size={20} />}
            title="تسجيل الخروج"
            sub="الخروج من هذا الجهاز"
            danger
            onClick={async () => {
              if (await confirm({ title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج؟', confirmLabel: 'خروج', danger: true })) await logout()
            }}
          />
        </div>
      </section>

      <AnnouncementSheet open={annOpen} onClose={() => setAnnOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PositionsSheet open={positionsOpen} onClose={() => setPositionsOpen(false)} />
      <ArchiveSheet open={archiveOpen} onClose={() => setArchiveOpen(false)} />
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}

function ToolButton({ icon, title, sub, onClick, danger }: { icon: ReactNode; title: string; sub: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="card flex items-center gap-3 p-3.5 text-start transition hover:shadow-card">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${danger ? 'bg-accent-soft text-accent' : 'bg-brand-soft text-brand-ink'}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`block font-bold ${danger ? 'text-accent' : 'text-ink'}`}>{title}</span>
        <span className="block truncate text-[0.8rem] text-muted">{sub}</span>
      </span>
    </button>
  )
}

function ToolLink({ icon, title, sub, to }: { icon: ReactNode; title: string; sub: string; to: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-3.5 transition hover:shadow-card">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        <span className="block truncate text-[0.8rem] text-muted">{sub}</span>
      </span>
    </Link>
  )
}

function AnnouncementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role } = useAuth()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [level, setLevel] = useState<AnnouncementLevel>('normal')

  useEffect(() => {
    if (open) {
      setTitle('')
      setBody('')
      setLevel('normal')
    }
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!role || !title.trim()) return
    addAnnouncement(title, body, level, role).catch(() => toast('تعذّر النشر', 'error'))
    toast('تم نشر التبليغ لجميع المستخدمين')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="تبليغ جديد" subtitle="يظهر فوراً على أجهزة جميع الكادر">
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Field label="العنوان">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus />
        </Field>
        <Field label="التفاصيل">
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} />
        </Field>
        <div>
          <div className="field-label">الأهمية</div>
          <Segmented<AnnouncementLevel>
            value={level}
            onChange={setLevel}
            options={(Object.keys(LEVELS) as AnnouncementLevel[]).map((k) => ({ value: k, label: LEVELS[k].label }))}
          />
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={!title.trim()}>
          <Megaphone size={18} />
          نشر التبليغ
        </button>
      </form>
    </Sheet>
  )
}

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useData()
  const toast = useToast()
  const [form, setForm] = useState({ wardCount: 20, defaultRooms: 20, defaultBeds: 10, shiftStart: '08:00' })

  useEffect(() => {
    if (open)
      setForm({
        wardCount: settings.wardCount,
        defaultRooms: settings.defaultRooms,
        defaultBeds: settings.defaultBeds,
        shiftStart: settings.shiftStart,
      })
  }, [open, settings])

  const clamp = (v: number) => Math.max(1, Math.min(60, Math.floor(v) || 1))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveSettings({
      wardCount: clamp(form.wardCount),
      defaultRooms: clamp(form.defaultRooms),
      defaultBeds: clamp(form.defaultBeds),
      shiftStart: form.shiftStart || '08:00',
    }).catch(() => toast('تعذّر حفظ الإعدادات', 'error'))
    toast('تم حفظ الإعدادات')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="إعدادات الردهات والخفارة">
      <form onSubmit={submit} className="space-y-4 pb-2">
        <Field label="عدد الردهات" hint="الافتراضي ٢٠ ردهة">
          <input className="input tabular-nums" type="number" min={1} max={60} inputMode="numeric" value={form.wardCount} onChange={(e) => setForm({ ...form, wardCount: Number(e.target.value) })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${SECTIONS.rooms.letter}: عدد الغرف الافتراضي`}>
            <input className="input tabular-nums" type="number" min={1} max={60} inputMode="numeric" value={form.defaultRooms} onChange={(e) => setForm({ ...form, defaultRooms: Number(e.target.value) })} />
          </Field>
          <Field label={`${SECTIONS.icu.letter}: عدد الأسرّة الافتراضي`}>
            <input className="input tabular-nums" type="number" min={1} max={60} inputMode="numeric" value={form.defaultBeds} onChange={(e) => setForm({ ...form, defaultBeds: Number(e.target.value) })} />
          </Field>
        </div>
        <p className="-mt-2 text-[0.78rem] text-muted">يمكن تخصيص عدد الغرف والأسرّة لكل ردهة على حدة من زر التعديل ✎ على الردهة.</p>
        <Field label="وقت بدء الخفارة (٢٤ ساعة)">
          <input className="input" type="time" value={form.shiftStart} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} />
        </Field>
        <button type="submit" className="btn btn-primary w-full">
          حفظ الإعدادات
        </button>
      </form>
    </Sheet>
  )
}

function PositionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useData()
  const toast = useToast()
  const [list, setList] = useState<Position[]>([])
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => {
    if (open) {
      setList(settings.positions.map((p) => ({ ...p })))
      setNewLabel('')
    }
  }, [open, settings.positions])

  const move = (i: number, d: number) =>
    setList((l) => {
      const j = i + d
      if (j < 0 || j >= l.length) return l
      const c = [...l]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    setList((l) => [...l, { id: `p${Date.now().toString(36)}`, label }])
    setNewLabel('')
  }

  const save = () => {
    const cleaned = list.map((p) => ({ id: p.id, label: p.label.trim() })).filter((p) => p.label)
    if (!cleaned.length) return toast('يجب وجود منصب واحد على الأقل', 'error')
    saveSettings({ positions: cleaned }).catch(() => toast('تعذّر الحفظ', 'error'))
    toast('تم حفظ مناصب الخفارة')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="مناصب جدول الخفارات"
      subtitle="تظهر كأعمدة في جدول الكولات وفي النسخة المطبوعة"
      footer={
        <button type="button" className="btn btn-primary w-full" onClick={save}>
          حفظ
        </button>
      }
    >
      <div className="space-y-2 pb-2">
        {list.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <input className="input min-h-11 flex-1" value={p.label} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} maxLength={40} />
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="تحريك للأعلى">
              <ArrowUp size={17} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="تحريك للأسفل">
              <ArrowDown size={17} />
            </button>
            <button type="button" className="btn btn-ghost btn-icon text-accent" onClick={() => setList((l) => l.filter((_, k) => k !== i))} aria-label="حذف">
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <input
            className="input min-h-11 flex-1"
            placeholder="منصب جديد، مثال: طبيب الأطفال الخافر"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            maxLength={40}
          />
          <button type="button" className="btn btn-soft" onClick={add}>
            <Plus size={17} />
            إضافة
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function ArchiveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const { list, loading } = useArchive(open)
  const confirm = useConfirm()
  const toast = useToast()
  const [q, setQ] = useState('')
  const needle = q.trim()
  const filtered = needle ? list.filter((p) => [p.patientName, p.doctorName, p.operation].some((f) => f.includes(needle))) : list

  return (
    <Sheet open={open} onClose={onClose} size="lg" title="سجل المرضى المُخرَجين" subtitle="آخر ١٠٠ عملية إخراج">
      <div className="relative mb-3">
        <Search size={17} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-muted" />
        <input className="input min-h-10 ps-9" placeholder="بحث بالاسم أو الطبيب…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? (
        <div className="py-10 text-center text-muted">جارٍ التحميل…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Archive size={26} />} title="السجل فارغ">
          يُضاف المريض إلى السجل عند الضغط على «إخراج المريض» من بطاقته.
        </EmptyState>
      ) : (
        <div className="space-y-2 pb-3">
          {filtered.map((p) => {
            const at = p.dischargedAt?.toDate?.()
            return (
              <div key={p.id} className="rounded-2xl border border-line bg-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink">{p.patientName}</div>
                    <div className="text-[0.8rem] text-muted">
                      ردهة {p.wardNumber} — {SECTIONS[p.section].unit} {p.roomNo || twoDigits(p.index)}
                      {p.doctorName && ` • ${p.doctorName}`}
                      {p.operation && ` • ${p.operation}`}
                    </div>
                    {at && <div className="mt-0.5 text-[0.75rem] text-muted">أُخرج في {dateTime(at)}</div>}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon text-muted hover:text-accent"
                      aria-label="حذف من السجل"
                      onClick={async () => {
                        if (await confirm({ title: 'حذف من السجل', message: `حذف سجل «${p.patientName}» نهائياً؟`, confirmLabel: 'حذف', danger: true }))
                          deleteArchived(p.id).catch(() => toast('تعذّر الحذف', 'error'))
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
