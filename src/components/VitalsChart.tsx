import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { Observation, Population, VitalKey } from '../data/types'
import { VITALS } from '../lib/constants'
import { shortDateTime } from '../lib/dates'
import { BANDS, num, parseBp } from '../lib/vitals'

interface Point {
  t: number
  values: number[]
}

const H = 200
const PAD = { top: 14, right: 40, bottom: 26, left: 38 }

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(4)))
  return ticks
}

/**
 * مخطط تطوّر علامة حيوية عبر الزمن (الزمن من اليسار إلى اليمين).
 * ضغط الدم يُرسم كسلسلتين: الانقباضي والانبساطي.
 */
export function VitalsChart({ list, vital, population }: { list: Observation[]; vital: VitalKey; population: Population }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [W, setW] = useState(640)
  const isBp = vital === 'bp'
  const series = isBp ? ['الانقباضي', 'الانبساطي'] : [VITALS[vital].name]
  const colors = ['var(--chart)', 'var(--chart-2)']

  const points = useMemo<Point[]>(() => {
    const out: Point[] = []
    for (const o of list) {
      const t = o.at?.toMillis()
      if (!t) continue
      if (isBp) {
        const bp = parseBp(o.values.bp)
        if (bp) out.push({ t, values: bp })
      } else {
        const n = num(o.values[vital])
        if (n !== null) out.push({ t, values: [n] })
      }
    }
    return out
  }, [list, vital, isBp])

  // عرض المخطط يساوي عرض الحاوية فعلياً حتى تبقى النصوص بحجمها الحقيقي على الهاتف
  const drawable = points.length >= 2
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setW(Math.max(280, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [drawable])

  if (!drawable) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-[0.86rem] text-muted">
        {points.length === 0 ? `لا توجد قراءات مسجّلة لـ${VITALS[vital].name} بعد.` : 'يظهر المخطط بعد تسجيل قراءتين على الأقل.'}
      </div>
    )
  }

  const band = isBp ? undefined : BANDS[population][vital]
  const all = points.flatMap((p) => p.values)
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (band) {
    lo = Math.min(lo, band[1])
    hi = Math.max(hi, Math.min(band[2], hi + (hi - lo) * 0.5 + 1))
  }
  const padV = (hi - lo) * 0.12 || 1
  lo -= padV
  hi += padV
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)
  const ticks = niceTicks(lo, hi)

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let best = 0
    let dist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(x(p.t) - px)
      if (d < dist) {
        dist = d
        best = i
      }
    })
    setHover(best)
  }

  const hp = hover !== null ? points[hover] : null
  const last = points[points.length - 1]

  return (
    <div ref={wrapRef} className="relative" dir="ltr">
      {isBp && (
        <div className="mb-2 flex justify-end gap-4 text-[0.76rem] text-ink-2" dir="rtl">
          {series.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="h-[2px] w-4 rounded" style={{ background: colors[i] }} />
              {s}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none select-none" role="img" aria-label={`مخطط ${VITALS[vital].name}`}>
        {band && (
          <rect
            x={PAD.left}
            width={W - PAD.left - PAD.right}
            y={y(Math.min(band[2], hi))}
            height={Math.max(0, y(Math.max(band[1], lo)) - y(Math.min(band[2], hi)))}
            fill="var(--brand)"
            opacity={0.07}
          />
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} fontSize={11} fill="var(--muted)">
          {shortDateTime(new Date(t0))}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
          {shortDateTime(new Date(t1))}
        </text>

        {series.map((_, si) => (
          <g key={si}>
            <polyline
              points={points.map((p) => `${x(p.t)},${y(p.values[si])}`).join(' ')}
              fill="none"
              stroke={colors[si]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <circle key={i} cx={x(p.t)} cy={y(p.values[si])} r={4} fill={colors[si]} stroke="var(--surface)" strokeWidth={2} />
            ))}
            <text x={x(last.t) + 9} y={y(last.values[si])} dominantBaseline="middle" fontSize={12} fontWeight={700} fill="var(--ink)">
              {last.values[si]}
            </text>
          </g>
        ))}

        {hp && (
          <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--faint)" strokeWidth={1} />
        )}
        <rect
          x={PAD.left - 10}
          y={0}
          width={W - PAD.left - PAD.right + 20}
          height={H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-6 z-10 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[0.76rem] shadow-[0_6px_20px_-8px_rgb(0_0_0/0.35)]"
          style={{
            left: `${(x(hp.t) / W) * 100}%`,
            transform: x(hp.t) > W / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
          }}
        >
          <div className="text-muted">{shortDateTime(new Date(hp.t))}</div>
          {series.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 font-semibold text-ink" dir="rtl">
              <span className="h-[2px] w-3 rounded" style={{ background: colors[i] }} />
              {s}: <span className="tabular-nums">{hp.values[i]}</span> <span className="font-normal text-muted">{VITALS[vital].unit}</span>
            </div>
          ))}
        </div>
      )}
      {band && <div className="mt-1 text-[0.72rem] text-faint" dir="rtl">المنطقة المظللة: المدى المعتاد التقريبي</div>}
    </div>
  )
}
