'use client'

import { useAccount, useConnect, useDisconnect, useSignMessage, useChainId } from 'wagmi'
import { injected } from '@wagmi/connectors'
import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import { SiweMessage } from 'siwe'

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'denscope.vercel.app'
const APP_URI = process.env.NEXT_PUBLIC_APP_URL ?? 'https://denscope.vercel.app'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const setAddress = useAuthStore((s) => s.setAddress)
  const authDisconnect = useAuthStore((s) => s.disconnect)
  const signingRef = useRef(false)

  const signIn = useCallback(async (addr: string) => {
    if (signingRef.current) return
    signingRef.current = true
    try {
      const nonceRes = await fetch('/api/auth/nonce')
      const { nonce } = await nonceRes.json()

      const message = new SiweMessage({
        domain: APP_DOMAIN,
        address: addr,
        statement: 'Sign in to DenScope',
        uri: APP_URI,
        version: '1',
        chainId,
        nonce,
      }).prepareMessage()

      const signature = await signMessageAsync({ message })

      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })
    } catch {
      // User rejected signature or network error — silent, session just won't be created
    } finally {
      signingRef.current = false
    }
  }, [chainId, signMessageAsync])

  useEffect(() => {
    if (isConnected && address) {
      setAddress(address)
      signIn(address)
    } else {
      authDisconnect()
    }
  }, [isConnected, address, setAddress, authDisconnect, signIn])

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
