import { ArrowLeft, Clock3, HeartPulse, ShieldPlus } from 'lucide-react'
import { Logo } from '../components/ui'
import { HOSPITAL_EN, MANAGED_BY } from '../lib/constants'

/** الواجهة الترحيبية التي تظهر عند فتح التطبيق */
export function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#063d26] text-white">
      {/* الخلفية */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_80%_0%,#14935a_0%,#0b6a40_38%,#063d26_75%)]" />
      <div className="pattern-bg absolute inset-0 -z-10 opacity-70" />
      <svg
        className="pointer-events-none absolute -left-44 top-16 -z-10 h-[36rem] w-[36rem] opacity-[0.32]"
        viewBox="0 0 400 400"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="crescent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a7e" />
            <stop offset="1" stopColor="#ff7a7e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M290 30a175 175 0 1 0 0 340a162 162 0 1 1 0-340z" fill="url(#crescent)" />
      </svg>
      <div className="pointer-events-none absolute -right-24 bottom-10 -z-10 size-72 rounded-full bg-[#e5765b] opacity-20 blur-3xl" />

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="anim-fade-up relative">
            <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-white/15 blur-2xl" />
            <Logo size={136} className="shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] ring-4 ring-white/80" />
          </div>

          <h1
            className="anim-fade-up mt-7 font-display text-[1.95rem] font-extrabold leading-snug tracking-tight sm:text-[2.3rem]"
            style={{ animationDelay: '80ms' }}
          >
            مستشفى الدكتور طالب الجنابي
          </h1>
          <div
            className="anim-fade-up mt-1 text-[0.8rem] font-medium tracking-wide text-white/65"
            dir="ltr"
            style={{ animationDelay: '120ms' }}
          >
            {HOSPITAL_EN}
          </div>

          <div
            className="anim-fade-up mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-1.5 text-[0.98rem] font-bold backdrop-blur"
            style={{ animationDelay: '180ms' }}
          >
            <span className="size-2 rounded-full bg-[#ff6b70]" />
            أول مستشفى أهلي في مدينة الفلوجة
          </div>

          <div
            className="anim-fade-up mt-6 space-y-3 text-[1.04rem] leading-[2] text-white/92"
            style={{ animationDelay: '260ms' }}
          >
            <p>
              تأسست عام <b className="font-bold text-white">٢٠٠٢</b> بإدارة الدكتور طالب الجنابي
              <br />
              طبيب اختصاص باطنية
            </p>
            <p>
              تستقبل المستشفى كافة الحالات المرضية والعمليات الجراحية وتتمتع بكادر طبي متمرس ومتخصص لتقديم أفضل خدمة
              علاجية للمواطنين الأعزاء وعلى مدار <b className="whitespace-nowrap font-bold text-white">٢٤ ساعة</b>
            </p>
          </div>

          <div className="anim-fade-up mt-7 grid w-full grid-cols-3 gap-2.5" style={{ animationDelay: '340ms' }}>
            {[
              { icon: <ShieldPlus size={20} />, top: 'منذ ٢٠٠٢', sub: 'خبرة وثقة' },
              { icon: <Clock3 size={20} />, top: '٢٤ ساعة', sub: 'خدمة متواصلة' },
              { icon: <HeartPulse size={20} />, top: 'كادر متخصص', sub: 'أطباء وممرضون' },
            ].map((f) => (
              <div key={f.top} className="rounded-2xl border border-white/15 bg-white/8 px-2 py-3 backdrop-blur-sm">
                <div className="mx-auto mb-1.5 grid size-9 place-items-center rounded-xl bg-white/15 text-white">{f.icon}</div>
                <div className="text-[0.86rem] font-bold leading-tight">{f.top}</div>
                <div className="text-[0.72rem] text-white/65">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="anim-fade-up mt-8" style={{ animationDelay: '420ms' }}>
          <button
            type="button"
            onClick={onNext}
            autoFocus
            className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white font-display text-[1.12rem] font-bold text-[#0a5535] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] transition hover:bg-[#f1fbf5] active:scale-[0.985]"
          >
            التالي
            <span className="grid size-8 place-items-center rounded-full bg-[#0d6b42] text-white transition group-hover:-translate-x-1">
              <ArrowLeft size={18} />
            </span>
          </button>
          <div className="mt-4 text-center text-[0.85rem] font-semibold text-white/75">{MANAGED_BY}</div>
        </div>
      </div>
    </div>
  )
}
