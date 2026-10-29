import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from './firebase'
import { roleOf } from './constants'

/*
 * الحسابان (المدير والكادر) يُنشآن مرة واحدة من Firebase Console ← Authentication ← Users.
 * لا تُخزَّن أي كلمة مرور أو بصمة لها في الشيفرة لأن المستودع عام.
 */

export class LoginError extends Error {}

const INVALID_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/user-not-found',
  'auth/wrong-password',
])

export async function login(rawEmail: string, password: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  if (!roleOf(email)) throw new LoginError('هذا البريد الإلكتروني غير مصرّح له بالدخول إلى التطبيق.')
  if (!password) throw new LoginError('يرجى إدخال كلمة المرور.')
  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch (err) {
    throw new LoginError(authMessage(err instanceof FirebaseError ? err.code : ''))
  }
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export async function changePassword(current: string, next: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new LoginError('يجب تسجيل الدخول أولاً.')
  if (next.length < 6) throw new LoginError('يجب أن تتكون كلمة المرور الجديدة من ٦ أحرف أو أرقام على الأقل.')
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current))
  } catch (err) {
    const code = err instanceof FirebaseError ? err.code : ''
    if (INVALID_CREDENTIAL_CODES.has(code)) throw new LoginError('كلمة المرور الحالية غير صحيحة.')
    throw new LoginError(authMessage(code))
  }
  try {
    await updatePassword(user, next)
  } catch (err) {
    throw new LoginError(authMessage(err instanceof FirebaseError ? err.code : ''))
  }
}

export function authMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.'
    case 'auth/too-many-requests':
      return 'محاولات كثيرة متتالية. يرجى الانتظار قليلاً ثم المحاولة مجدداً.'
    case 'auth/network-request-failed':
      return 'تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'كلمة المرور ضعيفة. استخدم ٦ أحرف أو أرقام على الأقل.'
    case 'auth/requires-recent-login':
      return 'لأسباب أمنية يرجى تسجيل الخروج ثم الدخول مجدداً قبل تغيير كلمة المرور.'
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
    case 'auth/admin-restricted-operation':
      return 'خدمة تسجيل الدخول غير مفعّلة بعد في مشروع Firebase (Authentication ← Email/Password). راجع دليل الإعداد.'
    case 'auth/user-disabled':
      return 'تم إيقاف هذا الحساب.'
    default:
      return 'حدث خطأ غير متوقع أثناء تسجيل الدخول' + (code ? ` (${code})` : '') + '.'
  }
}
