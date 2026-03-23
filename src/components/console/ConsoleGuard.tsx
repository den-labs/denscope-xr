'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/auth/ConnectButton'

export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
            Owner Console
          </h2>
          <p className="mt-2 text-sm text-foreground-secondary max-w-md">
            Connect your wallet to access your agent dashboard. You must be the on-chain owner of an ERC-8004 agent.
          </p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  return <>{children}</>
}
