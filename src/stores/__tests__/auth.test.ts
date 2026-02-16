import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().disconnect()
  })

  it('starts disconnected', () => {
    const state = useAuthStore.getState()
    expect(state.address).toBeNull()
    expect(state.isConnected).toBe(false)
  })

  it('sets address on connect', () => {
    useAuthStore.getState().setAddress('0xabc123')
    const state = useAuthStore.getState()
    expect(state.address).toBe('0xabc123')
    expect(state.isConnected).toBe(true)
  })

  it('clears state on disconnect', () => {
    useAuthStore.getState().setAddress('0xabc123')
    useAuthStore.getState().disconnect()
    const state = useAuthStore.getState()
    expect(state.address).toBeNull()
    expect(state.isConnected).toBe(false)
  })
})
