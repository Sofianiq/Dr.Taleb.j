import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// إعدادات مشروع Firebase الخاص بالمستشفى (هذه القيم عامة بطبيعتها، والحماية تتم عبر قواعد الأمان firestore.rules)
const firebaseConfig = {
  apiKey: 'AIzaSyDWfdzZZvlCF_WHooQYXhPjP64MYu_1V10',
  authDomain: 'dr-taleb-j.firebaseapp.com',
  projectId: 'dr-taleb-j',
  storageBucket: 'dr-taleb-j.firebasestorage.app',
  messagingSenderId: '377214294650',
  appId: '1:377214294650:web:5efaff17c878ad2b8d79c3',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
auth.languageCode = 'ar'

// ذاكرة محلية دائمة: يعمل التطبيق حتى عند انقطاع الإنترنت ثم يزامن التغييرات تلقائياً عند عودة الاتصال
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// للتطوير والاختبار المحلي فقط: VITE_FIREBASE_EMULATOR=true npm run dev
if (import.meta.env.VITE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
