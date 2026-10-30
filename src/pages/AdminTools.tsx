import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { EmptyState, Field, PageHeader, Sheet, useConfirm, useToast } from '../components/ui'
import { WardEditor } from '../components/WardEditor'
import { deleteArchived, reorderWards, saveSettings } from '../data/actions'
import { useAuth } from '../data/auth'
import { useActivity, useArchive, useCensus, useData } from '../data/store'
import type { Department, Ward } from '../data/types'
import { deptLetter, UNITS, unitCount, VITALS } from '../lib/constants'
import { AR_MONTHS, AR_WEEKDAYS, dateTime, stayDay, stayLength } from '../lib/dates'
import { shortId } from '../lib/ids'
import { ActivityList, ListRowControls, moveItem } from './Admin'

const BACK = { to: '/admin', label: 'الإدارة' }

/* ------------------------------ إدارة الردهات ------------------------------ */

export function WardsManagerPage() {
  const { isAdmin } = useAuth()
  const { wards, wardsVirtual } = useData()
  const { byWard } = useCensus()
  const toast = useToast()
  const [editing, setEditing] = useState<Ward | null | 'new'>(null)

  if (!isAdmin) return <Navigate to="/admin" replace />

  const move = (i: number, d: number) => {
    const ids = moveItem(wards, i, d).map((w) => w.id)
    reorderWards(wards, wardsVirtual, ids).catch(() => toast('تعذّر تغيير الترتيب', 'error'))
  }

  return (
    <div>
      <PageHeader
        back={BACK}
        title="الردهات"
        subtitle="إضافة الردهات وتعديل أسمائها وأعداد أسرّتها والعلامات الحيوية المتابَعة فيها"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Plus size={15} />
            ردهة جديدة
          </button>
        }
      />
      <div className="panel overflow-hidden">
        {wards.length === 0 ? (
          <EmptyState title="لا توجد ردهات" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>إضافة ردهة</button>} />
        ) : (
          <ul className="divide-y divide-line">
            {wards.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setEditing(w)}>
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-bold text-ink">{w.name}</span>
                    <span className="shrink-0 text-[0.78rem] text-muted">{unitCount(w.beds, w.unit)}</span>
                  </div>
                  <div className="truncate text-[0.76rem] text-muted">
                    {byWard[w.id]?.patients ?? 0} مريض حالياً · {w.population === 'neonate' ? 'حديثو الولادة' : 'بالغون وأطفال'} · {w.procedureLabel}
                  </div>
                  <div className="truncate text-[0.74rem] text-faint" dir="ltr" style={{ textAlign: 'right' }}>
                    {w.vitals.map((k) => VITALS[k].label).join(' · ') || '—'}
                  </div>
                </button>
                <div className="flex shrink-0">
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="تحريك للأعلى">
                    ↑
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, 1)} disabled={i === wards.length - 1} aria-label="تحريك للأسفل">
                    ↓
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(w)}>
                    تعديل
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[0.78rem] text-muted">
        نوع الوحدة ({Object.values(UNITS).map((u) => u.one).join(' / ')}) يحدد التسمية في البطاقات والاستمارات. لا يمكن حذف ردهة أو تقليل عدد أسرّتها إذا كان فيها مرضى.
      </p>
      <WardEditor open={editing !== null} onClose={() => setEditing(null)} ward={editing === 'new' ? null : editing} />
    </div>
  )
}

/* ------------------------------ إدارة الأقسام ------------------------------ */

export function DepartmentsManagerPage() {
  const { isAdmin } = useAuth()
  const { settings } = useData()
  const toast = useToast()
  const [list, setList] = useState<Department[]>(settings.departments)
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  useEffect(() => setList(settings.departments), [settings.departments])

  if (!isAdmin) return <Navigate to="/admin" replace />

  const persist = (next: Department[]) => {
    setList(next)
    saveSettings({ departments: next.map((d) => ({ id: d.id, name: d.name, description: d.description, position: d.position ?? '' })) as Department[] }).catch(() =>
      toast('تعذّر الحفظ', 'error'),
    )
  }

  return (
    <div>
      <PageHeader
        back={BACK}
        title="أقسام الكادر الطبي"
        subtitle="تظهر في تبويب «الكادر الطبي» وفي تصنيف دليل الهواتف"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Plus size={15} />
            قسم جديد
          </button>
        }
      />
      <div className="panel overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="لا توجد أقسام" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((d, i) => (
              <li key={d.id} className="flex items-center gap-2 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line-strong text-[0.8rem] font-bold" dir="ltr">
                  {deptLetter(i)}
                </span>
                <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setEditing(i)}>
                  <div className="truncate font-semibold text-ink">{d.name}</div>
                  <div className="truncate text-[0.76rem] text-muted">
                    {d.description || '—'}
                    {d.position && ` · خفارة: ${settings.positions.find((p) => p.id === d.position)?.label ?? ''}`}
                  </div>
                </button>
                <ListRowControls
                  index={i}
                  length={list.length}
                  onMove={(dir) => persist(moveItem(list, i, dir))}
                  onDelete={() => {
                    if (window.confirm(`حذف قسم «${d.name}»؟ لن تُحذف جهات الاتصال المرتبطة به.`)) persist(list.filter((_, k) => k !== i))
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <DepartmentEditor
        open={editing !== null}
        dept={typeof editing === 'number' ? list[editing] : null}
        onClose={() => setEditing(null)}
        onSave={(d) => {
          persist(typeof editing === 'number' ? list.map((x, k) => (k === editing ? d : x)) : [...list, d])
          toast('تم حفظ القسم')
          setEditing(null)
        }}
      />
    </div>
  )
}

function DepartmentEditor({ open, dept, onClose, onSave }: { open: boolean; dept: Department | null; onClose: () => void; onSave: (d: Department) => void }) {
  const { settings } = useData()
  const [form, setForm] = useState<Department>({ id: '', name: '', description: '' })
  useEffect(() => {
    if (open) setForm(dept ?? { id: shortId('d'), name: '', description: '', position: '' })
  }, [open, dept])
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="sm"
      title={dept ? 'تعديل القسم' : 'قسم جديد'}
      footer={
        <button type="button" className="btn btn-primary" disabled={!form.name.trim()} onClick={() => onSave({ ...form, name: form.name.trim(), description: form.description.trim() })}>
          حفظ
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="اسم القسم">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} autoFocus />
        </Field>
        <Field label="وصف مختصر">
          <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} />
        </Field>
        <Field label="منصب الخفارة المرتبط (اختياري)" hint="يظهر اسم الخافر اليوم في صفحة القسم">
          <select className="input" value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })}>
            <option value="">— بدون —</option>
            {settings.positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Sheet>
  )
}

/* ------------------------------ سجل النشاطات ------------------------------ */

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function ActivityPage() {
  const { list, loading } = useActivity(true, 150)
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: typeof list }[] = []
    for (const a of list) {
      const d = a.at?.toDate() ?? new Date()
      const key = dayKey(d)
      let g = out.find((x) => x.key === key)
      if (!g) {
        g = { key, label: `${AR_WEEKDAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]}`, items: [] }
        out.push(g)
      }
      g.items.push(a)
    }
    return out
  }, [list])

  return (
    <div>
      <PageHeader back={BACK} title="سجل النشاطات" subtitle="آخر ١٥٠ تعديلاً في المستشفى مع الوقت واسم من قام بها" />
      {loading ? (
        <div className="py-10 text-center text-muted">جارٍ التحميل…</div>
      ) : groups.length === 0 ? (
        <div className="panel">
          <EmptyState title="لا توجد نشاطات بعد" />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="eyebrow mb-1.5">{g.label}</div>
              <div className="panel overflow-hidden">
                <ActivityList list={g.items} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------ سجل المرضى المُخرَجين ------------------------------ */

export function ArchivePage() {
  const { isAdmin } = useAuth()
  const { list, loading } = useArchive(true)
  const confirm = useConfirm()
  const toast = useToast()
  const [q, setQ] = useState('')
  const needle = q.trim()
  const filtered = needle ? list.filter((p) => [p.patientName, p.doctorName, p.procedure, p.wardName].some((f) => f.includes(needle))) : list

  return (
    <div>
      <PageHeader back={BACK} title="سجل المرضى المُخرَجين" subtitle="آخر ٢٠٠ حالة خروج" />
      <div className="relative mb-3">
        <Search size={17} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-faint" />
        <input className="input ps-9" placeholder="بحث بالاسم أو الطبيب أو الردهة" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </div>
      <div className="panel overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-muted">جارٍ التحميل…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="السجل فارغ">يُضاف المريض إلى السجل عند إخراجه من بطاقة السرير.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((p) => {
              const adm = p.admittedAt?.toDate()
              const out = p.dischargedAt?.toDate()
              const days = adm && out ? stayDay(adm, out) : 0
              return (
                <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{p.patientName}</span>
                      {p.dischargeType && (
                        <span className={`tag ${p.dischargeType === 'وفاة' ? 'bg-critical-soft text-critical' : 'bg-surface-3 text-muted'}`}>{p.dischargeType}</span>
                      )}
                    </div>
                    <div className="text-[0.78rem] text-muted">
                      {p.wardName}
                      {p.bedLabel && ` · ${UNITS[p.unit].one} ${p.bedLabel}`}
                      {p.doctorName && ` · ${p.doctorName}`}
                      {p.procedure && ` · ${p.procedure}`}
                    </div>
                    <div className="text-[0.74rem] text-faint">
                      {adm && `دخل ${dateTime(adm)}`}
                      {out && ` — خرج ${dateTime(out)}`}
                      {days > 0 && ` (${stayLength(days)})`}
                    </div>
                    {p.dischargeNote && <div className="mt-1 text-[0.8rem] text-ink-2">{p.dischargeNote}</div>}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon text-faint hover:text-critical"
                      aria-label="حذف من السجل"
                      onClick={async () => {
                        if (await confirm({ title: 'حذف من السجل', message: `حذف سجل «${p.patientName}» نهائياً؟`, confirmLabel: 'حذف', danger: true }))
                          deleteArchived(p.id).catch(() => toast('تعذّر الحذف', 'error'))
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
