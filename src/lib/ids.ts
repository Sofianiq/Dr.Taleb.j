import type { SectionKey } from '../data/types'

const pad2 = (n: number) => String(n).padStart(2, '0')

export const wardIdOf = (order: number) => `w${pad2(order)}`

export const slotIdOf = (wardId: string, section: SectionKey, index: number) =>
  `${wardId}_${section}_${pad2(index)}`

export const twoDigits = pad2
