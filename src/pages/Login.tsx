import { useState, type FormEvent } from 'react'
import { Building2, LogIn, Mail, Stethoscope } from 'lucide-react'
import { PasswordInput } from '../components/AccountSheet'
import { Field, Logo, Segmented, Spinner } from '../components/ui'
import { login } from '../lib/auth'
import { ACCOUNTS, HOSPITAL_AR, HOSPITAL_EN, MANAGED_BY } from '../lib/constants'
import type { Role } from '../data/types'

export function Login() {
  const [role, setRole] = useState<Role>('staff')
  const [email, setEmail] = useState(ACCOUNTS.staff.email)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pickRole = (r: Role) => {
    setRole(r)
    setEmail(ACCOUNTS[r].email)
    setError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول.')
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="absolute inset-x-0 top-0 -z-0 h-[19rem] overflow-hidden rounded-b-[2.5rem] bg-[#0b6a40]">
        <div className="absolute inset-0 bg-[radial-gradient(100%_90%_at_85%_0%,#18a564_0%,#0b6a40_45%,#06432a_100%)]" />
        <div className="pattern-bg absolute inset-0 opacity-80" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-l from-transparent via-[#ff6b70] to-transparent opacity-70" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="anim-fade-up flex flex-col items-center text-center text-white">
          <Logo size={92} className="shadow-[0_14px_36px_-10px_rgba(0,0,0,0.55)] ring-4 ring-white/80" />
          <h1 className="mt-4 font-display text-[1.35rem] font-extrabold">{HOSPITAL_AR}</h1>
          <div className="text-[0.76rem] text-white/70" dir="ltr">
            {HOSPITAL_EN}
          </div>
        </div>

        <form
          onSubmit={submit}
          className="anim-fade-up card mt-7 space-y-4 p-5 shadow-float sm:p-6"
          style={{ animationDelay: '90ms' }}
        >
          <div>
            <h2 className="text-[1.2rem] font-bold">تسجيل الدخول</h2>
            <p className="text-[0.86rem] text-muted">اختر نوع الحساب ثم أدخل كلمة المرور</p>
          </div>

          <Segmented<Role>
            value={role}
            onChange={pickRole}
            options={[
              { value: 'staff', label: <><Stethoscope size={17} /> الكادر الطبي</> },
              { value: 'admin', label: <><Building2 size={17} /> الإدارة</> },
            ]}
          />

          <Field label="البريد الإلكتروني">
            <div className="relative">
              <input
                className="input input-ltr pe-11"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Mail size={18} className="pointer-events-none absolute inset-y-0 end-3.5 my-auto text-muted" />
            </div>
          </Field>

          <Field label="كلمة المرور">
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>

          {error && (
            <div role="alert" className="rounded-xl bg-accent-soft px-3.5 py-2.5 text-[0.88rem] font-medium leading-relaxed text-accent">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary h-12 w-full text-[1.02rem]" disabled={busy}>
            {busy ? <Spinner size={19} /> : <LogIn size={19} className="-scale-x-100" />}
            دخول
          </button>
        </form>

        <div className="mt-auto pt-8 text-center text-[0.84rem] font-semibold text-muted">{MANAGED_BY}</div>
      </div>
    </div>
  )
}
