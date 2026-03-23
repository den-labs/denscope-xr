'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from '@wagmi/connectors'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const setAddress = useAuthStore((s) => s.setAddress)
  const authDisconnect = useAuthStore((s) => s.disconnect)

  useEffect(() => {
    if (isConnected && address) {
      setAddress(address)
    } else {
      authDisconnect()
    }
  }, [isConnected, address, setAddress, authDisconnect])

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-secondary">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="border border-border bg-surface px-3 py-1 text-xs font-mono text-text-muted hover:text-text-secondary hover:border-border-bright transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-mono text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors"
    >
      Connect Wallet
    </button>
  )
}
