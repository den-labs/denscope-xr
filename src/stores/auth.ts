import { create } from 'zustand'

type AuthState = {
  address: string | null
  isConnected: boolean
  /** True only after a successful SIWE sign-in (session cookie created). */
  authenticated: boolean
  setAddress: (address: string) => void
  setAuthenticated: (value: boolean) => void
  disconnect: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  address: null,
  isConnected: false,
  authenticated: false,
  setAddress: (address) => set({ address, isConnected: true }),
  setAuthenticated: (value) => set({ authenticated: value }),
  disconnect: () => set({ address: null, isConnected: false, authenticated: false }),
}))
