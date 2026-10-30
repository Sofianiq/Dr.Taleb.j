import { useSyncExternalStore } from 'react'
import { ROLE_LABEL } from './constants'
import type { Role } from '../data/types'

/*
 * الحسابان مشتركان بين أكثر من شخص، لذلك يُسجَّل اسم مستخدم الجهاز محلياً
 * ويُرفق بكل تعديل حتى يُعرف من قام به.
 */

const KEY = 'operator-name'
const listeners = new Set<() => void>()

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

let current = read()

export function setOperatorName(name: string) {
  current = name.trim().slice(0, 60)
  try {
    if (current) localStorage.setItem(KEY, current)
    else localStorage.removeItem(KEY)
  } catch {
    /* التخزين غير متاح */
  }
  listeners.forEach((l) => l())
}

export function useOperatorName(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** "د. حسن — الكادر الطبي" أو اسم الدور فقط */
export function operatorLabel(role: Role): string {
  return current ? `${current} — ${ROLE_LABEL[role]}` : ROLE_LABEL[role]
}

/** هل سبق أن سُئل المستخدم عن اسمه على هذا الجهاز؟ */
export function operatorPrompted(): boolean {
  try {
    return localStorage.getItem(KEY + '-asked') === '1'
  } catch {
    return true
  }
}

export function markOperatorPrompted() {
  try {
    localStorage.setItem(KEY + '-asked', '1')
  } catch {
    /* التخزين غير متاح */
  }
}
