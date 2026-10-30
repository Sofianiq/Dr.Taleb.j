import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { ChangePasswordSheet } from '../components/AccountSheet'
import { EmptyState, Field, MetricStrip, PageHeader, SectionHeader, Segmented, Sheet, StatusTag, useConfirm, useToast } from '../components/ui'
import { addAnnouncement, deleteAnnouncement, saveSettings } from '../data/actions'
import { useAuth } from '../data/auth'
import { bedLabel, hasPatient, useActivity, useArchive, useCensus, useData, wardBeds } from '../data/store'
import type { Activity, AnnouncementLevel, Position } from '../data/types'
import { logout } from '../lib/auth'
import { HOSPITAL_AR, MANAGED_BY, UNITS } from '../lib/constants'
import { clock, isToday, timeAgo } from '../lib/dates'
import { shortId } from '../lib/ids'

export const LEVELS: Record<AnnouncementLevel, { label: string; cls: string; bar: string }> = {
  normal: { label: 'عادي', cls: 'bg-surface-3 text-muted', bar: 'border-s-line-strong' },
  important: { label: 'مهم', cls: 'bg-warn-soft text-warn', bar: 'border-s-warn' },
  urgent: { label: 'عاجل', cls: 'bg-critical-soft text-critical', bar: 'border-s-critical' },
}

export const ACTION_LABEL: Record<Activity['action'], string> = {
  admit: 'دخول',
  discharge: 'خروج',
  transfer: 'نقل',
  vitals: 'علامات حيوية',
  status: 'حالة',
  update: 'تحديث',
  ward: 'ردهة',
}

export function ActivityList({ list }: { list: Activity[] }) {
  return (
    <ul className="divide-y divide-line">
      {list.map((a) => {
        const at = a.at?.toDate()
        return (
          <li key={a.id} className="flex gap-3 px-4 py-2.5">
            <span className="w-14 shrink-0 pt-0.5 text-[0.74rem] tabular-nums text-faint">{at ? clock(at) : ''}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.86rem] text-ink">
                <span className="me-1.5 rounded bg-surface-3 px-1.5 py-px text-[0.7rem] font-semibold text-muted">{ACTION_LABEL[a.action]}</span>
                {a.text}
              </div>
              <div className="truncate text-[0.74rem] text-muted">
                {[a.wardName, a.by, at && !isToday(at) ? timeAgo(at) : ''].filter(Boolean).join(' · ')}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ToolRow({ title, sub, to, onClick, danger }: { title: string; sub?: string; to?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${danger ? 'text-critical' : 'text-ink'}`}>{title}</span>
        {sub && <span className="block truncate text-[0.78rem] text-muted">{sub}</span>}
      </span>
      {!danger && <ChevronLeft size={17} className="shrink-0 text-faint" />}
    </>
  )
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-2'
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export function AdminPage() {
  const { isAdmin, role } = useAuth()
  const { wards, beds, announcements, contacts, settings } = useData()
  const { byWard, total } = useCensus()
  const { list: activity } = useActivity(true, 12)
  const { list: archive } = useArchive(true)
  const confirm = useConfirm()
  const toast = useToast()
  const [annOpen, setAnnOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)

  const today = useMemo(() => {
    let admitted = 0
    for (const w of wards) for (const b of wardBeds(w, beds)) if (hasPatient(b) && isToday(b.admittedAt?.toDate())) admitted++
    admitted += archive.filter((a) => isToday(a.admittedAt?.toDate())).length
    const discharged = archive.filter((a) => isToday(a.dischargedAt?.toDate())).length
    return { admitted, discharged }
  }, [wards, beds, archive])

  const criticalList = useMemo(
    () => wards.flatMap((w) => wardBeds(w, beds).filter((b) => b.status === 'critical').map((b) => ({ ward: w, bed: b }))),
    [wards, beds],
  )

  const occupancy = total.capacity ? Math.round((total.patients / total.capacity) * 100) : 0

  const removeAnnouncement = async (id: string, title: string) => {
    const ok = await confirm({ title: 'حذف التبليغ', message: `هل تريد حذف «${title}»؟`, confirmLabel: 'حذف', danger: true })
    if (!ok) return
    deleteAnnouncement(id).catch(() => toast('تعذّر الحذف', 'error'))
  }

  return (
    <div>
      <PageHeader
        title="الإدارة"
        subtitle={`${HOSPITAL_AR} — ${MANAGED_BY}`}
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAnnOpen(true)}>
              <Plus size={15} />
              تبليغ جديد
            </button>
          )
        }
      />

      <div className="mb-6">
        <MetricStrip
          items={[
            { label: 'المرضى الحاليون', value: total.patients },
            { label: 'نسبة الإشغال', value: `${occupancy}%`, hint: `${total.patients} من ${total.capacity}` },
            { label: 'حالات حرجة', value: total.critical, tone: total.critical ? 'critical' : undefined },
            { label: 'جاهز للخروج', value: total.discharge, tone: total.discharge ? 'info' : undefined },
            { label: 'دخول اليوم', value: today.admitted },
            { label: 'خروج اليوم', value: today.discharged },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section>
            <SectionHeader title="إشغال الردهات" meta="عدد المرضى من السعة الكلية لكل ردهة" />
            <div className="panel space-y-3 p-4">
              {wards.length === 0 && <div className="text-[0.86rem] text-muted">لا توجد ردهات.</div>}
              {wards.map((w) => {
                const c = byWard[w.id]
                const pct = c.capacity ? (c.patients / c.capacity) * 100 : 0
                return (
                  <Link key={w.id} to={`/resident/ward/${w.id}`} className="block" title={`${w.name}: ${c.patients} من ${c.capacity}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-[0.84rem]">
                      <span className="font-semibold text-ink">{w.name}</span>
                      <span className="num text-muted">
                        {c.patients} / {c.capacity}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-[4px] bg-chart-track">
                      <div className="h-full rounded-e-[4px] bg-chart" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <section>
            <SectionHeader title="الحالات الحرجة" meta={criticalList.length ? `${criticalList.length} مريض` : undefined} />
            <div className="panel overflow-hidden">
              {criticalList.length === 0 ? (
                <EmptyState title="لا توجد حالات حرجة حالياً" />
              ) : (
                <ul className="divide-y divide-line">
                  {criticalList.map(({ ward, bed }) => (
                    <li key={bed.id}>
                      <Link to={`/resident/ward/${ward.id}?bed=${bed.index}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-ink">{bed.patientName}</div>
                          <div className="truncate text-[0.76rem] text-muted">
                            {ward.name} · {UNITS[ward.unit].one} {bedLabel(bed)}
                            {bed.doctorName && ` · ${bed.doctorName}`}
                          </div>
                        </div>
                        <StatusTag status={bed.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionHeader title="التعاميم والتبليغات" />
            <div className="space-y-2">
              {announcements.length === 0 ? (
                <div className="panel">
                  <EmptyState title="لا توجد تبليغات">{isAdmin ? 'أرسل تبليغاً يظهر فوراً لجميع الكادر.' : 'تظهر هنا تبليغات الإدارة فور نشرها.'}</EmptyState>
                </div>
              ) : (
                announcements.slice(0, 6).map((a) => {
                  const lv = LEVELS[a.level]
                  const at = a.createdAt?.toDate()
                  return (
                    <article key={a.id} className={`panel border-s-[3px] px-4 py-3 ${lv.bar}`}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-ink">{a.title}</h3>
                            {a.level !== 'normal' && <span className={`tag ${lv.cls}`}>{lv.label}</span>}
                          </div>
                          {a.body && <p className="mt-1 whitespace-pre-line text-[0.9rem] leading-relaxed text-ink-2">{a.body}</p>}
                          <div className="mt-1.5 text-[0.74rem] text-muted">
                            {a.author}
                            {at && ` · ${timeAgo(at)}`}
                          </div>
                        </div>
                        {isAdmin && (
                          <button type="button" className="btn btn-ghost btn-sm btn-icon -me-2 text-faint hover:text-critical" onClick={() => removeAnnouncement(a.id, a.title)} aria-label="حذف التبليغ">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </section>

          <section>
            <SectionHeader
              title="آخر النشاطات"
              actions={
                <Link to="/admin/activity" className="text-[0.82rem] font-semibold text-brand-ink hover:underline">
                  عرض الكل
                </Link>
              }
            />
            <div className="panel overflow-hidden">
              {activity.length === 0 ? <EmptyState title="لا توجد نشاطات بعد" /> : <ActivityList list={activity} />}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-6">
        <SectionHeader title={isAdmin ? 'الإعدادات والسجلات' : 'السجلات والحساب'} />
        <div className="panel divide-y divide-line overflow-hidden">
          {isAdmin && (
            <>
              <ToolRow title="الردهات" sub={`${wards.length} ردهات — إضافة وتعديل الأسماء والأعداد والعلامات الحيوية`} to="/admin/wards" />
              <ToolRow title="أقسام الكادر الطبي" sub={`${settings.departments.length} أقسام`} to="/admin/departments" />
              <ToolRow title="مناصب جدول الخفارات" sub={settings.positions.map((p) => p.label).join('، ')} onClick={() => setPositionsOpen(true)} />
              <ToolRow title="وقت بدء الخفارة" sub="الخفارة ٢٤ ساعة" onClick={() => setSettingsOpen(true)} />
              <ToolRow title="دليل الهواتف" sub={`${contacts.length} جهة اتصال`} to="/staff/directory" />
            </>
          )}
          <ToolRow title="سجل المرضى المُخرَجين" sub="البحث في المرضى الذين غادروا المستشفى" to="/admin/archive" />
          <ToolRow title="سجل النشاطات" sub="كل التعديلات مع الوقت واسم من قام بها" to="/admin/activity" />
          <ToolRow title="تغيير كلمة المرور" sub={role === 'admin' ? 'حساب الإدارة' : 'حساب الكادر الطبي'} onClick={() => setPwOpen(true)} />
          <ToolRow
            title="تسجيل الخروج"
            danger
            onClick={async () => {
              if (await confirm({ title: 'تسجيل الخروج', message: 'هل تريد تسجيل الخروج؟', confirmLabel: 'خروج', danger: true })) await logout()
            }}
          />
        </div>
      </section>

      <AnnouncementSheet open={annOpen} onClose={() => setAnnOpen(false)} />
      <ShiftStartSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PositionsSheet open={positionsOpen} onClose={() => setPositionsOpen(false)} />
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
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
    <Sheet
      open={open}
      onClose={onClose}
      title="تبليغ جديد"
      subtitle="يظهر فوراً على أجهزة جميع الكادر"
      footer={
        <button type="submit" form="ann-form" className="btn btn-primary" disabled={!title.trim()}>
          نشر التبليغ
        </button>
      }
    >
      <form id="ann-form" onSubmit={submit} className="space-y-4">
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
      </form>
    </Sheet>
  )
}

function ShiftStartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useData()
  const toast = useToast()
  const [value, setValue] = useState(settings.shiftStart)
  useEffect(() => {
    if (open) setValue(settings.shiftStart)
  }, [open, settings.shiftStart])
  return (
    <Sheet open={open} onClose={onClose} size="sm" title="وقت بدء الخفارة" subtitle="تُحسب «خفارة اليوم» ابتداءً من هذا الوقت ولمدة ٢٤ ساعة">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          saveSettings({ shiftStart: value || '08:00' }).catch(() => toast('تعذّر الحفظ', 'error'))
          toast('تم الحفظ')
          onClose()
        }}
        className="space-y-4"
      >
        <input className="input" type="time" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn btn-primary w-full">
          حفظ
        </button>
      </form>
    </Sheet>
  )
}

/** محرّر قائمة مرتّبة بسيطة (للمناصب والأقسام) */
export function ListRowControls({ index, length, onMove, onDelete }: { index: number; length: number; onMove: (d: number) => void; onDelete: () => void }): ReactNode {
  return (
    <div className="flex shrink-0">
      <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="تحريك للأعلى">
        ↑
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onMove(1)} disabled={index === length - 1} aria-label="تحريك للأسفل">
        ↓
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-icon text-critical" onClick={onDelete} aria-label="حذف">
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export function moveItem<T>(list: T[], i: number, d: number): T[] {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const c = [...list]
  ;[c[i], c[j]] = [c[j], c[i]]
  return c
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

  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    setList((l) => [...l, { id: shortId('p'), label }])
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
        <button type="button" className="btn btn-primary" onClick={save}>
          حفظ
        </button>
      }
    >
      <div className="space-y-2">
        {list.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1">
            <input className="input flex-1" value={p.label} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} maxLength={40} />
            <ListRowControls index={i} length={list.length} onMove={(d) => setList((l) => moveItem(l, i, d))} onDelete={() => setList((l) => l.filter((_, k) => k !== i))} />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <input
            className="input flex-1"
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
          <button type="button" className="btn btn-secondary" onClick={add}>
            إضافة
          </button>
        </div>
      </div>
    </Sheet>
  )
}
