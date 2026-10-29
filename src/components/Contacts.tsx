import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Phone, Plus, Trash2, UserPlus } from 'lucide-react'
import { addContact, deleteContact, updateContact, type ContactInput } from '../data/actions'
import { useAuth } from '../data/auth'
import type { Contact } from '../data/types'
import { CONTACT_GROUPS, CONTACT_ROLES, groupLabel } from '../lib/constants'
import { formatPhone, isValidPhone, normalizePhone, telUrl, whatsappUrl } from '../lib/phone'
import { Field, Sheet, useConfirm, useToast } from './ui'

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.43-9.43 2.52 0 4.89.98 6.67 2.76a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.43 9.43zm8.03-17.46A11.27 11.27 0 0 0 12.04.72C5.79.72.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.3 11.3 0 0 0 5.76 1.47h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02z" />
    </svg>
  )
}

function initials(name: string) {
  const parts = name.replace(/^(د\.|د |دكتور|الدكتور)\s*/, '').trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

const AVATAR_TONES = [
  'bg-brand-soft text-brand-ink',
  'bg-info-soft text-info',
  'bg-coral-soft text-coral',
  'bg-accent-soft text-accent',
  'bg-warn-soft text-warn',
]

export function ContactCard({ contact, onEdit, showGroup = true }: { contact: Contact; onEdit?: () => void; showGroup?: boolean }) {
  const tone = AVATAR_TONES[[...contact.name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length]
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className={`grid size-12 shrink-0 place-items-center rounded-2xl font-display text-[1rem] font-bold ${tone}`}>
        {initials(contact.name) || '؟'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-bold text-ink">{contact.name}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-brand" aria-label={`تعديل ${contact.name}`}>
              <Pencil size={14} />
            </button>
          )}
        </div>
        <div className="truncate text-[0.8rem] text-muted">
          {[contact.role, showGroup ? groupLabel(contact.dept) : '', contact.note].filter(Boolean).join(' • ')}
        </div>
        <div className="text-[0.8rem] font-medium text-ink-2 tabular-nums" dir="ltr" style={{ textAlign: 'right' }}>
          {formatPhone(contact.phone)}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <a href={telUrl(contact.phone)} className="btn btn-secondary btn-icon" aria-label={`اتصال بـ ${contact.name}`}>
          <Phone size={18} />
        </a>
        <a
          href={whatsappUrl(contact.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-wa btn-icon"
          aria-label={`مراسلة ${contact.name} عبر واتساب`}
        >
          <WhatsAppIcon size={20} />
        </a>
      </div>
    </div>
  )
}

const EMPTY: ContactInput = { name: '', role: CONTACT_ROLES[0], dept: 'other', phone: '', note: '' }

export function ContactEditor({
  open,
  onClose,
  contact,
  defaultDept,
}: {
  open: boolean
  onClose: () => void
  contact?: Contact | null
  defaultDept?: string
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState<ContactInput>(EMPTY)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(
      contact
        ? { name: contact.name, role: contact.role, dept: contact.dept, phone: contact.phone, note: contact.note }
        : { ...EMPTY, dept: defaultDept ?? 'other' },
    )
  }, [open, contact, defaultDept])

  const set = (k: keyof ContactInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('يرجى إدخال الاسم.')
    if (!isValidPhone(form.phone)) return setError('رقم الهاتف غير صحيح. مثال: 07701234567')
    const data: ContactInput = { ...form, name: form.name.trim(), note: form.note.trim(), phone: normalizePhone(form.phone) }
    const p = contact ? updateContact(contact.id, data) : addContact(data)
    p.catch(() => toast('تعذّر الحفظ — هذه الميزة متاحة للإدارة فقط', 'error'))
    toast(contact ? 'تم تحديث جهة الاتصال' : 'تمت إضافة جهة الاتصال')
    onClose()
  }

  const remove = async () => {
    if (!contact) return
    const ok = await confirm({ title: 'حذف جهة الاتصال', message: `هل تريد حذف «${contact.name}» من دليل الهواتف؟`, confirmLabel: 'حذف', danger: true })
    if (!ok) return
    deleteContact(contact.id).catch(() => toast('تعذّر الحذف', 'error'))
    toast('تم الحذف')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={contact ? 'تعديل جهة اتصال' : 'إضافة جهة اتصال'}
      subtitle="للتواصل المباشر عبر واتساب أو الاتصال الهاتفي"
      footer={
        <div className="flex gap-2.5">
          <button type="submit" form="contact-form" className="btn btn-primary flex-1">
            {contact ? <Pencil size={18} /> : <UserPlus size={18} />}
            {contact ? 'حفظ التعديلات' : 'إضافة'}
          </button>
          {contact && (
            <button type="button" className="btn btn-danger" onClick={remove}>
              <Trash2 size={18} />
              حذف
            </button>
          )}
        </div>
      }
    >
      <form id="contact-form" onSubmit={submit} className="space-y-4 pb-2">
        <Field label="الاسم الكامل">
          <input className="input" value={form.name} onChange={set('name')} maxLength={120} placeholder="مثال: د. أحمد محمد" autoFocus={!contact} />
        </Field>
        <Field label="رقم الهاتف (واتساب)" hint="يمكن كتابته بالصيغة المحلية مثل 07701234567">
          <input className="input input-ltr tabular-nums" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} maxLength={30} placeholder="07xx xxx xxxx" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الصفة">
            <select className="input" value={form.role} onChange={set('role')}>
              {CONTACT_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="القسم">
            <select className="input" value={form.dept} onChange={set('dept')}>
              {CONTACT_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="الاختصاص / ملاحظة (اختياري)">
          <input className="input" value={form.note} onChange={set('note')} maxLength={300} placeholder="مثال: اختصاص جراحة عامة" />
        </Field>
        {error && <div className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[0.88rem] font-medium text-accent">{error}</div>}
      </form>
    </Sheet>
  )
}

/** زر إضافة عائم للمدير */
export function AddContactFab({ onClick }: { onClick: () => void }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-primary fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] end-4 z-30 h-14 rounded-2xl px-5 shadow-float sm:end-[max(1rem,calc(50vw-30rem))]"
    >
      <Plus size={20} />
      إضافة رقم
    </button>
  )
}
