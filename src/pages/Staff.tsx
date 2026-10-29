import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  Baby,
  BedDouble,
  BookUser,
  ChevronLeft,
  FlaskConical,
  HeartPulse,
  LayoutGrid,
  ScanLine,
  Scissors,
  Search,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { AddContactFab, ContactCard, ContactEditor, WhatsAppIcon } from '../components/Contacts'
import { EmptyState, PageHeader } from '../components/ui'
import { useAuth } from '../data/auth'
import { useData } from '../data/store'
import type { Contact } from '../data/types'
import { CONTACT_GROUPS, DEPARTMENTS, type Department } from '../lib/constants'
import { whatsappUrl } from '../lib/phone'

export const DEPT_VISUAL: Record<string, { icon: (s: number) => ReactNode; tone: string; ring: string }> = {
  'surgical-ward': { icon: (s) => <BedDouble size={s} />, tone: 'bg-info-soft text-info', ring: 'from-info/80' },
  cathlab: { icon: (s) => <HeartPulse size={s} />, tone: 'bg-accent-soft text-accent', ring: 'from-accent/80' },
  nicu: { icon: (s) => <Baby size={s} />, tone: 'bg-coral-soft text-coral', ring: 'from-coral/80' },
  theatre: { icon: (s) => <Scissors size={s} />, tone: 'bg-brand-soft text-brand-ink', ring: 'from-brand/80' },
  lab: { icon: (s) => <FlaskConical size={s} />, tone: 'bg-warn-soft text-warn', ring: 'from-warn/80' },
  radiology: { icon: (s) => <ScanLine size={s} />, tone: 'bg-info-soft text-info', ring: 'from-info/80' },
}

/** البحث عن جهة اتصال باسم الشخص المناوب لعرض زر واتساب بجانبه */
export function findContactByName(contacts: Contact[], name: string | undefined): Contact | undefined {
  const n = (name ?? '').replace(/^(د\.|د |دكتور|الدكتور)\s*/, '').trim()
  if (!n) return undefined
  return contacts.find((c) => c.name.replace(/^(د\.|د |دكتور|الدكتور)\s*/, '').trim() === n) ?? contacts.find((c) => c.name.includes(n))
}

export function StaffPage() {
  const { contacts, today, settings } = useData()

  const countBy = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of contacts) m[c.dept] = (m[c.dept] ?? 0) + 1
    return m
  }, [contacts])

  return (
    <div className="anim-fade-up">
      <PageHeader title="الكادر الطبي" subtitle="الأقسام الطبية ودليل هواتف الأطباء والممرضين" icon={<Users size={22} />} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((d) => {
          const v = DEPT_VISUAL[d.id]
          const onCall = d.position ? today.assignments[d.position] : undefined
          const posLabel = settings.positions.find((p) => p.id === d.position)?.label
          return (
            <Link
              key={d.id}
              to={`/staff/${d.id}`}
              className="card group relative flex items-center gap-3.5 overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className={`absolute inset-y-0 start-0 w-1 bg-gradient-to-b ${v.ring} to-transparent`} />
              <div className={`relative grid size-14 shrink-0 place-items-center rounded-2xl ${v.tone}`}>
                {v.icon(26)}
                <span className="absolute -bottom-1 -start-1 grid size-6 place-items-center rounded-lg bg-ink font-display text-[0.72rem] font-bold text-bg" dir="ltr">
                  {d.letter}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[1rem] font-bold text-ink">{d.name}</div>
                <div className="text-[0.8rem] text-muted">{countBy[d.id] ? `${countBy[d.id]} من الكادر` : 'لم تُضف أرقام بعد'}</div>
                {onCall && posLabel && (
                  <div className="mt-0.5 flex items-center gap-1 truncate text-[0.78rem] font-semibold text-brand-ink">
                    <UserRoundCheck size={13} /> خفارة اليوم: {onCall}
                  </div>
                )}
              </div>
              <ChevronLeft size={20} className="shrink-0 text-muted transition group-hover:-translate-x-1" />
            </Link>
          )
        })}
      </div>

      <Link
        to="/staff/directory"
        className="relative mt-4 flex items-center gap-4 overflow-hidden rounded-[1.4rem] bg-gradient-to-l from-[#0b6a40] to-[#14935a] p-4 text-white shadow-card transition hover:brightness-105"
      >
        <div className="pattern-bg absolute inset-0 opacity-60" />
        <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
          <BookUser size={24} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="font-display text-[1.05rem] font-bold">دليل الهواتف</div>
          <div className="text-[0.82rem] text-white/80">{contacts.length} جهة اتصال — تواصل مباشر عبر واتساب</div>
        </div>
        <span className="relative grid size-10 place-items-center rounded-full bg-white text-[#1ea952]">
          <WhatsAppIcon size={22} />
        </span>
      </Link>
    </div>
  )
}

export function DepartmentPage() {
  const { deptId = '' } = useParams()
  if (deptId === 'directory') return <DirectoryPage />
  const dept = DEPARTMENTS.find((d) => d.id === deptId)
  if (!dept) return <Navigate to="/staff" replace />
  return <DepartmentView dept={dept} />
}

function DepartmentView({ dept }: { dept: Department }) {
  const { contacts, today, settings } = useData()
  const { isAdmin } = useAuth()
  const [editing, setEditing] = useState<Contact | null | 'new'>(null)
  const v = DEPT_VISUAL[dept.id]
  const list = contacts.filter((c) => c.dept === dept.id)
  const onCall = dept.position ? today.assignments[dept.position] : undefined
  const posLabel = settings.positions.find((p) => p.id === dept.position)?.label
  const onCallContact = findContactByName(contacts, onCall)

  return (
    <div className="anim-fade-up">
      <PageHeader back="/staff" title={`${dept.letter} — ${dept.name}`} subtitle="الكادر الطبي" />

      <div className="card mb-4 flex items-start gap-4 p-4">
        <div className={`grid size-16 shrink-0 place-items-center rounded-2xl ${v.tone}`}>{v.icon(30)}</div>
        <div className="min-w-0">
          <p className="text-[0.92rem] leading-relaxed text-ink-2">{dept.description}</p>
          {dept.id === 'surgical-ward' && (
            <Link to="/resident" className="btn btn-soft btn-sm mt-2.5">
              <LayoutGrid size={16} />
              عرض الردهات والغرف
            </Link>
          )}
        </div>
      </div>

      {posLabel && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-3.5">
          <UserRoundCheck size={22} className="shrink-0 text-brand-ink" />
          <div className="min-w-0 flex-1">
            <div className="text-[0.78rem] font-semibold text-brand-ink/80">خفارة اليوم — {posLabel}</div>
            <div className="truncate font-bold text-ink">{onCall || 'لم يُحدَّد بعد'}</div>
          </div>
          {onCallContact && (
            <a href={whatsappUrl(onCallContact.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-icon" aria-label="مراسلة عبر واتساب">
              <WhatsAppIcon size={20} />
            </a>
          )}
        </div>
      )}

      <h2 className="section-title mb-2.5 flex items-center gap-2">
        <Users size={18} className="text-brand" />
        كادر القسم
        <span className="chip bg-surface-3 text-muted">{list.length}</span>
      </h2>

      {list.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="لا توجد أرقام في هذا القسم بعد">
          {isAdmin ? 'اضغط «إضافة رقم» لإضافة الأطباء والممرضين والفنيين.' : 'تتم إضافة الأرقام من قبل الإدارة.'}
        </EmptyState>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {list.map((c) => (
            <ContactCard key={c.id} contact={c} showGroup={false} onEdit={isAdmin ? () => setEditing(c) : undefined} />
          ))}
        </div>
      )}

      {isAdmin && <div className="h-16" aria-hidden="true" />}
      <AddContactFab onClick={() => setEditing('new')} />
      <ContactEditor open={editing !== null} onClose={() => setEditing(null)} contact={editing === 'new' ? null : editing} defaultDept={dept.id} />
    </div>
  )
}

export function DirectoryPage() {
  const { contacts } = useData()
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('all')
  const [editing, setEditing] = useState<Contact | null | 'new'>(null)

  const needle = q.trim()
  const filtered = contacts.filter(
    (c) =>
      (group === 'all' || c.dept === group) &&
      (!needle || c.name.includes(needle) || c.role.includes(needle) || c.note.includes(needle) || c.phone.includes(needle.replace(/^0/, ''))),
  )
  const groups = CONTACT_GROUPS.filter((g) => contacts.some((c) => c.dept === g.id))

  return (
    <div className="anim-fade-up">
      <PageHeader back="/staff" title="دليل الهواتف" subtitle="الأطباء والممرضون والفنيون والموظفون" />

      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute inset-y-0 start-3.5 my-auto text-muted" />
        <input className="input ps-10" placeholder="ابحث بالاسم أو الاختصاص أو الرقم…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {[{ id: 'all', label: 'الكل' }, ...groups].map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup(g.id)}
            className={`chip min-h-9 shrink-0 px-3.5 text-[0.82rem] ${group === g.id ? 'bg-ink text-bg' : 'border border-line bg-surface text-ink-2'}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<BookUser size={28} />} title={contacts.length ? 'لا توجد نتائج مطابقة' : 'دليل الهواتف فارغ'}>
          {contacts.length ? 'جرّب كلمة بحث أخرى.' : isAdmin ? 'اضغط «إضافة رقم» لإضافة أول جهة اتصال.' : 'تتم إضافة الأرقام من قبل الإدارة.'}
        </EmptyState>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} onEdit={isAdmin ? () => setEditing(c) : undefined} />
          ))}
        </div>
      )}

      {isAdmin && <div className="h-16" aria-hidden="true" />}
      <AddContactFab onClick={() => setEditing('new')} />
      <ContactEditor
        open={editing !== null}
        onClose={() => setEditing(null)}
        contact={editing === 'new' ? null : editing}
        defaultDept={group !== 'all' ? group : undefined}
      />
    </div>
  )
}
