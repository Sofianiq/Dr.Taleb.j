import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BookUser, ChevronLeft, Plus, Search, Settings2 } from 'lucide-react'
import { ContactEditor, ContactRow, WhatsAppIcon } from '../components/Contacts'
import { EmptyState, PageHeader, SectionHeader } from '../components/ui'
import { useAuth } from '../data/auth'
import { useData } from '../data/store'
import type { Contact, Department } from '../data/types'
import { contactGroups, deptLetter } from '../lib/constants'
import { whatsappUrl } from '../lib/phone'

/** البحث عن جهة اتصال باسم الشخص المناوب لعرض زر واتساب بجانبه */
export function findContactByName(contacts: Contact[], name: string | undefined): Contact | undefined {
  const strip = (s: string) => s.replace(/^(د\.|د |دكتور|الدكتور)\s*/, '').trim()
  const n = strip(name ?? '')
  if (!n) return undefined
  return contacts.find((c) => strip(c.name) === n) ?? contacts.find((c) => c.name.includes(n))
}

function LetterBadge({ letter }: { letter: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line-strong bg-surface-2 text-[0.85rem] font-bold text-ink" dir="ltr">
      {letter}
    </span>
  )
}

export function StaffPage() {
  const { contacts, today, settings } = useData()
  const { isAdmin } = useAuth()
  const [adding, setAdding] = useState(false)

  const countBy = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of contacts) m[c.dept] = (m[c.dept] ?? 0) + 1
    return m
  }, [contacts])

  return (
    <div>
      <PageHeader
        title="الكادر الطبي"
        subtitle="الأقسام الطبية ودليل هواتف الأطباء والممرضين"
        actions={
          isAdmin && (
            <>
              <Link to="/admin/departments" className="btn btn-secondary btn-sm">
                <Settings2 size={15} />
                إدارة الأقسام
              </Link>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <Plus size={15} />
                إضافة رقم
              </button>
            </>
          )
        }
      />

      <SectionHeader title="الأقسام" meta={`${settings.departments.length} أقسام`} />
      <div className="panel mb-6 divide-y divide-line overflow-hidden">
        {settings.departments.map((d, i) => {
          const onCall = d.position ? today.assignments[d.position] : undefined
          return (
            <Link key={d.id} to={`/staff/${d.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
              <LetterBadge letter={deptLetter(i)} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{d.name}</div>
                <div className="truncate text-[0.78rem] text-muted">
                  {countBy[d.id] ? `${countBy[d.id]} من الكادر` : 'لم تُضف أرقام بعد'}
                  {onCall && <span className="text-brand-ink"> · خفارة اليوم: {onCall}</span>}
                </div>
              </div>
              <ChevronLeft size={17} className="shrink-0 text-faint" />
            </Link>
          )
        })}
      </div>

      <Link to="/staff/directory" className="panel flex items-center gap-3 px-4 py-3.5 transition-colors hover:border-line-strong">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-on-brand">
          <BookUser size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">دليل الهواتف</div>
          <div className="text-[0.78rem] text-muted">{contacts.length} جهة اتصال — اتصال مباشر أو مراسلة عبر واتساب</div>
        </div>
        <ChevronLeft size={17} className="text-faint" />
      </Link>

      <ContactEditor open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

export function DepartmentPage() {
  const { deptId = '' } = useParams()
  const { settings } = useData()
  if (deptId === 'directory') return <DirectoryPage />
  const index = settings.departments.findIndex((d) => d.id === deptId)
  if (index < 0) return <Navigate to="/staff" replace />
  return <DepartmentView dept={settings.departments[index]} letter={deptLetter(index)} />
}

function DepartmentView({ dept, letter }: { dept: Department; letter: string }) {
  const { contacts, today, settings } = useData()
  const { isAdmin } = useAuth()
  const [editing, setEditing] = useState<Contact | null | 'new'>(null)
  const list = contacts.filter((c) => c.dept === dept.id)
  const onCall = dept.position ? today.assignments[dept.position] : undefined
  const posLabel = settings.positions.find((p) => p.id === dept.position)?.label
  const onCallContact = findContactByName(contacts, onCall)

  return (
    <div>
      <PageHeader
        back={{ to: '/staff', label: 'الكادر الطبي' }}
        title={
          <span className="flex items-center gap-2.5">
            <LetterBadge letter={letter} />
            {dept.name}
          </span>
        }
        subtitle={dept.description}
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
              <Plus size={15} />
              إضافة رقم
            </button>
          )
        }
      />

      {posLabel && (
        <div className="panel mb-5 flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.76rem] font-semibold text-muted">خفارة اليوم — {posLabel}</div>
            <div className={`truncate font-bold ${onCall ? 'text-ink' : 'text-faint'}`}>{onCall || 'لم يُحدَّد بعد'}</div>
          </div>
          {onCallContact && (
            <a href={whatsappUrl(onCallContact.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-wa btn-icon" aria-label="مراسلة عبر واتساب">
              <WhatsAppIcon size={19} />
            </a>
          )}
        </div>
      )}

      <SectionHeader title="كادر القسم" meta={`${list.length} جهة اتصال`} />
      <div className="panel divide-y divide-line overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="لا توجد أرقام في هذا القسم بعد">
            {isAdmin ? 'اضغط «إضافة رقم» لإضافة الأطباء والممرضين والفنيين.' : 'تُضاف الأرقام من قبل الإدارة.'}
          </EmptyState>
        ) : (
          list.map((c) => <ContactRow key={c.id} contact={c} showGroup={false} onEdit={isAdmin ? () => setEditing(c) : undefined} />)
        )}
      </div>

      <ContactEditor open={editing !== null} onClose={() => setEditing(null)} contact={editing === 'new' ? null : editing} defaultDept={dept.id} />
    </div>
  )
}

export function DirectoryPage() {
  const { contacts, settings } = useData()
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
  const groups = contactGroups(settings.departments).filter((g) => contacts.some((c) => c.dept === g.id))

  return (
    <div>
      <PageHeader
        back={{ to: '/staff', label: 'الكادر الطبي' }}
        title="دليل الهواتف"
        subtitle={`${contacts.length} جهة اتصال`}
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
              <Plus size={15} />
              إضافة رقم
            </button>
          )
        }
      />

      <div className="relative mb-3">
        <Search size={17} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-faint" />
        <input className="input ps-9" placeholder="ابحث بالاسم أو الاختصاص أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </div>

      {groups.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {[{ id: 'all', label: 'الكل' }, ...groups].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              aria-pressed={group === g.id}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[0.82rem] font-semibold ${
                group === g.id ? 'border-ink bg-ink text-surface' : 'border-line-strong bg-surface text-ink-2 hover:border-faint'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="panel divide-y divide-line overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title={contacts.length ? 'لا توجد نتائج مطابقة' : 'دليل الهواتف فارغ'}>
            {contacts.length ? 'جرّب كلمة بحث أخرى.' : isAdmin ? 'اضغط «إضافة رقم» لإضافة أول جهة اتصال.' : 'تُضاف الأرقام من قبل الإدارة.'}
          </EmptyState>
        ) : (
          filtered.map((c) => <ContactRow key={c.id} contact={c} onEdit={isAdmin ? () => setEditing(c) : undefined} />)
        )}
      </div>

      <ContactEditor
        open={editing !== null}
        onClose={() => setEditing(null)}
        contact={editing === 'new' ? null : editing}
        defaultDept={group !== 'all' ? group : undefined}
      />
    </div>
  )
}
