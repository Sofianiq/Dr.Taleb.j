import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null
  needRefresh: boolean
  offlineReady: boolean
}

let state: PwaState = { installEvent: null, needRefresh: false, offlineReady: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null

/** يُستدعى مرة واحدة عند بدء التطبيق */
export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    set({ installEvent: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => set({ installEvent: null }))
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => set({ needRefresh: true }),
      onOfflineReady: () => set({ offlineReady: true }),
      onRegisteredSW: (_url, reg) => {
        // فحص دوري للتحديثات كل ساعة
        if (reg) window.setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      },
    })
  }
}

export function usePwa() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
  return {
    ...snap,
    isStandalone: isStandalone(),
    isIOS: isIOS(),
    canInstall: !!snap.installEvent,
    async install() {
      const ev = state.installEvent
      if (!ev) return false
      await ev.prompt()
      const choice = await ev.userChoice
      set({ installEvent: null })
      return choice.outcome === 'accepted'
    },
    applyUpdate() {
      void updateSW?.(true)
    },
    dismissUpdate() {
      set({ needRefresh: false })
    },
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
