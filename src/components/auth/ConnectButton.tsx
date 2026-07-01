'use client'

import { useAccount, useConnect, useDisconnect, useSignMessage, useChainId } from 'wagmi'
import { injected } from '@wagmi/connectors'
import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import { SiweMessage } from 'siwe'
import { browserSiweOrigin } from '@/lib/auth/siwe'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const setAddress = useAuthStore((s) => s.setAddress)
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated)
  const authenticated = useAuthStore((s) => s.authenticated)
  const authDisconnect = useAuthStore((s) => s.disconnect)
  const signingRef = useRef(false)

  // Sign-in is user-initiated only — never auto-fired on reconnect. Builds the
  // SIWE message with the live browser origin so wallets pass domain binding.
  const signIn = useCallback(async (addr: string) => {
    if (signingRef.current) return
    signingRef.current = true
    try {
      const nonceRes = await fetch('/api/auth/nonce')
      const { nonce } = await nonceRes.json()

      const { domain, uri } = browserSiweOrigin()
      const message = new SiweMessage({
        domain,
        address: addr,
        statement: 'Sign in to DenScope',
        uri,
        version: '1',
        chainId,
        nonce,
      }).prepareMessage()

      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })
      setAuthenticated(res.ok)
    } catch {
      // User rejected signature or network error — silent, no session created
    } finally {
      signingRef.current = false
    }
  }, [chainId, signMessageAsync, setAuthenticated])

  // On (re)connect: restore the address for display only. No signature prompt.
  useEffect(() => {
    if (isConnected && address) {
      setAddress(address)
    } else {
      authDisconnect()
    }
  }, [isConnected, address, setAddress, authDisconnect])

  const handleConnect = useCallback(async () => {
    try {
      const result = await connectAsync({ connector: injected() })
      const addr = result.accounts[0]
      if (addr) await signIn(addr)
    } catch {
      // User dismissed the wallet connection prompt
    }
  }, [connectAsync, signIn])

  if (isConnected && address && authenticated) {
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

  // Connected (e.g. restored on reload) but no session yet — explicit sign-in.
  if (isConnected && address) {
    return (
      <button
        onClick={() => signIn(address)}
        className="border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-mono text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors"
      >
        Sign in
      </button>
    )
  }

  return (
    <button
      onClick={handleConnect}
      className="border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-mono text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors"
    >
      Connect Wallet
    </button>
  )
}
