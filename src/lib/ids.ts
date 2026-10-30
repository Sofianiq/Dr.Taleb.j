const pad2 = (n: number) => String(n).padStart(2, '0')

export const bedIdOf = (wardId: string, index: number) => `${wardId}_${pad2(index)}`

export const twoDigits = pad2

/** معرّف فريد قصير لكل دخول (رقود) مريض */
export const newAdmissionId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/** معرّف قصير لعنصر جديد (ردهة، قسم، منصب) */
export const shortId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
