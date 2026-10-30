import { useState, type FormEvent } from 'react'
import { PasswordInput } from '../components/AccountSheet'
import { Field, Spinner } from '../components/ui'
import { login } from '../lib/auth'
import { ACCOUNTS, MANAGED_BY } from '../lib/constants'
import type { Role } from '../data/types'
import { BrandPanel } from './Intro'

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
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="lg:hidden">
        <BrandPanel compact />
      </div>
      <div className="hidden lg:block">
        <BrandPanel />
      </div>

      <section className="flex flex-col justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 lg:px-16">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-[1.4rem] font-bold text-ink">تسجيل الدخول</h1>
            <p className="mt-1 text-[0.88rem] text-muted">اختر نوع الحساب ثم أدخل كلمة المرور.</p>
          </div>

          <fieldset>
            <legend className="field-label">نوع الحساب</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['staff', 'admin'] as Role[]).map((r) => {
                const active = role === r
                return (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                      active ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-faint'
                    }`}
                  >
                    <input type="radio" name="role" className="mt-1 accent-[var(--brand)]" checked={active} onChange={() => pickRole(r)} />
                    <span>
                      <span className="block text-[0.9rem] font-bold text-ink">{ACCOUNTS[r].label}</span>
                      <span className="block text-[0.74rem] text-muted">{ACCOUNTS[r].description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <Field label="البريد الإلكتروني">
            <input
              className="input ltr-input"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="كلمة المرور">
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>

          {error && (
            <div role="alert" className="rounded-md border border-critical/25 bg-critical-soft px-3 py-2 text-[0.86rem] leading-relaxed text-critical">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
            {busy && <Spinner size={17} />}
            دخول
          </button>

          <p className="pt-2 text-[0.82rem] text-muted lg:hidden">{MANAGED_BY}</p>
        </form>
      </section>
    </div>
  )
}
