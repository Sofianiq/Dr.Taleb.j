import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileCheck2, Share2 } from 'lucide-react'
import { Sheet, Spinner, useToast } from '../components/ui'
import './print.css'

type Mode = 'print' | 'pdf'

interface Job {
  id: number
  mode: Mode
  filename: string
  content: ReactNode
}

interface PrintApi {
  /** طباعة مباشرة (أو "حفظ كـ PDF" من نافذة الطباعة) */
  print: (content: ReactNode, filename: string) => void
  /** إنشاء ملف PDF جاهز للتنزيل أو المشاركة عبر واتساب */
  pdf: (content: ReactNode, filename: string) => void
  busy: boolean
}

const PrintContext = createContext<PrintApi>({ print: () => {}, pdf: () => {}, busy: false })

async function waitForAssets(root: HTMLElement) {
  try {
    await document.fonts?.ready
  } catch {
    /* ignore */
  }
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))))
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

async function renderPdf(root: HTMLElement): Promise<Blob> {
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.pp-page'))
  const fontEmbedCSS = await getFontEmbedCSS(pages[0])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  for (const [i, page] of pages.entries()) {
    const url = await toJpeg(page, {
      quality: 0.93,
      pixelRatio: 2.4,
      backgroundColor: '#ffffff',
      fontEmbedCSS,
    })
    if (i > 0) pdf.addPage()
    pdf.addImage(url, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  }
  return pdf.output('blob')
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ file: File; url: string } | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
  const toast = useToast()

  useEffect(() => {
    rootRef.current = document.getElementById('print-root')
  }, [])

  const start = useCallback((mode: Mode, content: ReactNode, filename: string) => {
    setBusy(true)
    setJob({ id: Date.now(), mode, content, filename })
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!job || !root) return
    let cancelled = false
    ;(async () => {
      await waitForAssets(root)
      if (cancelled) return
      if (job.mode === 'print') {
        const prevTitle = document.title
        document.title = job.filename
        document.body.classList.add('printing')
        const done = () => {
          document.title = prevTitle
          document.body.classList.remove('printing')
          window.removeEventListener('afterprint', done)
        }
        window.addEventListener('afterprint', done)
        setBusy(false)
        window.print()
      } else {
        try {
          const blob = await renderPdf(root)
          if (cancelled) return
          const file = new File([blob], `${job.filename}.pdf`, { type: 'application/pdf' })
          setResult({ file, url: URL.createObjectURL(blob) })
        } catch (err) {
          console.error(err)
          toast('تعذّر إنشاء ملف PDF — جرّب خيار الطباعة ثم «حفظ كـ PDF»', 'error')
        } finally {
          setBusy(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job, toast])

  const closeResult = () => {
    if (result) URL.revokeObjectURL(result.url)
    setResult(null)
  }

  const canShare = !!result && typeof navigator.canShare === 'function' && navigator.canShare({ files: [result.file] })

  const share = async () => {
    if (!result) return
    try {
      await navigator.share({ files: [result.file], title: result.file.name })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast('تعذّرت المشاركة — استخدم زر التنزيل', 'error')
    }
  }

  return (
    <PrintContext.Provider
      value={{
        print: (c, f) => start('print', c, f),
        pdf: (c, f) => start('pdf', c, f),
        busy,
      }}
    >
      {children}
      {job && rootRef.current && createPortal(<div key={job.id}>{job.content}</div>, rootRef.current)}

      {busy && job?.mode === 'pdf' && (
        <div className="anim-fade fixed inset-0 z-[60] grid place-items-center bg-[var(--overlay)]">
          <div className="panel flex items-center gap-3 px-5 py-4">
            <Spinner size={18} className="text-brand" />
            <span className="text-[0.92rem] font-semibold">جارٍ إنشاء ملف PDF…</span>
          </div>
        </div>
      )}

      <Sheet open={!!result} onClose={closeResult} size="sm" title="ملف PDF جاهز">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <FileCheck2 size={22} className="shrink-0 text-brand-ink" />
          <div className="min-w-0">
            <div className="truncate text-[0.88rem] font-semibold text-ink" dir="ltr" style={{ textAlign: 'right' }}>
              {result?.file.name}
            </div>
            <div className="text-[0.76rem] text-muted">{result ? `${Math.max(1, Math.round(result.file.size / 1024))} KB` : ''}</div>
          </div>
        </div>
        <p className="mt-3 text-[0.86rem] text-muted">يمكنك تنزيل الملف أو مشاركته مباشرة عبر واتساب أو أي تطبيق آخر.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <a href={result?.url} download={result?.file.name} className="btn btn-primary flex-1" onClick={() => window.setTimeout(closeResult, 1500)}>
            <Download size={17} />
            تنزيل الملف
          </a>
          {canShare && (
            <button type="button" className="btn btn-wa flex-1" onClick={share}>
              <Share2 size={17} />
              مشاركة (واتساب…)
            </button>
          )}
        </div>
      </Sheet>
    </PrintContext.Provider>
  )
}

export const usePrint = () => useContext(PrintContext)
