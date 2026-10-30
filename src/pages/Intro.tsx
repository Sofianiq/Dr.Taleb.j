import { ArrowLeft } from 'lucide-react'
import { Logo } from '../components/ui'
import { HOSPITAL_EN, MANAGED_BY } from '../lib/constants'

export function BrandPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`relative flex flex-col bg-[#0b5d3c] text-white ${
        compact ? 'px-6 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]' : 'px-6 pb-9 pt-[max(2.5rem,env(safe-area-inset-top))] lg:px-14 lg:py-14'
      } lg:min-h-dvh lg:justify-between`}
    >
      <div className="hidden text-[0.8rem] font-medium tracking-wide text-white/60 lg:block">الفلوجة — الأنبار · منذ عام ٢٠٠٢</div>
      <div className={`flex items-center gap-4 ${compact ? '' : 'flex-col text-center lg:items-start lg:text-start'}`}>
        <Logo size={compact ? 56 : 104} className="ring-[3px] ring-white/90 lg:size-[132px]" />
        <div>
          <div className={`font-display font-bold leading-snug ${compact ? 'text-[1.15rem]' : 'mt-2 text-[1.7rem] lg:text-[2.2rem]'}`}>
            مستشفى الدكتور طالب الجنابي
          </div>
          <div className={`text-white/65 ${compact ? 'text-[0.74rem]' : 'mt-1 text-[0.82rem] lg:text-[0.9rem]'}`} dir="ltr">
            {HOSPITAL_EN}
          </div>
        </div>
      </div>
      <div className="hidden text-[0.9rem] font-semibold text-white/85 lg:block">{MANAGED_BY}</div>
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#c4161c] lg:inset-x-auto lg:inset-y-0 lg:end-0 lg:h-auto lg:w-[3px]" />
    </section>
  )
}

/** الواجهة الترحيبية التي تظهر عند فتح التطبيق */
export function Intro({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <BrandPanel />
      <section className="flex flex-col justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 lg:px-16 lg:py-16">
        <div className="w-full max-w-lg">
          <h1 className="text-[1.45rem] font-bold leading-snug text-ink lg:text-[1.9rem]">أول مستشفى أهلي في مدينة الفلوجة</h1>
          <div className="mt-4 h-[3px] w-12 bg-brand" />
          <div className="mt-5 space-y-4 text-[1.02rem] leading-[1.95] text-ink-2">
            <p>تأسست عام ٢٠٠٢ بإدارة الدكتور طالب الجنابي، طبيب اختصاص باطنية.</p>
            <p>
              تستقبل المستشفى كافة الحالات المرضية والعمليات الجراحية، وتتمتع بكادر طبي متمرس ومتخصص لتقديم أفضل خدمة علاجية
              للمواطنين الأعزاء وعلى مدار <span className="whitespace-nowrap">٢٤ ساعة</span>.
            </p>
          </div>

          <dl className="mt-7 grid grid-cols-3 border-y border-line">
            {[
              ['٢٠٠٢', 'سنة التأسيس'],
              ['٢٤ ساعة', 'خدمة متواصلة'],
              ['الفلوجة', 'محافظة الأنبار'],
            ].map(([v, l], i) => (
              <div key={l} className={`py-3.5 text-center ${i > 0 ? 'border-s border-line' : ''}`}>
                <dt className="sr-only">{l}</dt>
                <dd className="text-[1.05rem] font-bold text-ink">{v}</dd>
                <dd className="text-[0.76rem] text-muted">{l}</dd>
              </div>
            ))}
          </dl>

          <button type="button" onClick={onNext} className="btn btn-primary btn-lg mt-8 w-full">
            التالي
            <ArrowLeft size={18} />
          </button>
          <p className="mt-4 text-center text-[0.84rem] font-semibold text-muted lg:hidden">{MANAGED_BY}</p>
        </div>
      </section>
    </div>
  )
}
