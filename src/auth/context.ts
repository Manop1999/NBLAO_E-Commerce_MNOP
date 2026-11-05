import { createContext } from 'react'
import type { AuthCtx } from './types'

export const AuthContext = createContext<AuthCtx | null>(null)
