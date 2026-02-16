import { create } from 'zustand'

type AuthState = {
  address: string | null
  isConnected: boolean
  setAddress: (address: string) => void
  disconnect: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  address: null,
  isConnected: false,
  setAddress: (address) => set({ address, isConnected: true }),
  disconnect: () => set({ address: null, isConnected: false }),
}))
