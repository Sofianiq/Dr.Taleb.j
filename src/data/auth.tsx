import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { roleOf } from '../lib/constants'
import type { Role } from './types'

interface AuthState {
  ready: boolean
  user: User | null
  role: Role | null
  isAdmin: boolean
}

const AuthContext = createContext<AuthState>({ ready: false, user: null, role: null, isAdmin: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, user: null, role: null, isAdmin: false })

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        const role = user ? roleOf(user.email) : null
        setState({ ready: true, user: role ? user : null, role, isAdmin: role === 'admin' })
      }),
    [],
  )

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
