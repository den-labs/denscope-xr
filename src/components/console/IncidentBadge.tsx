'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { fetchOpenIncidentCount } from '@/lib/supabase/incidents'

export function IncidentBadge() {
  const { address, isConnected } = useAccount()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isConnected || !address) return
    fetchOpenIncidentCount(address).then(setCount)
  }, [isConnected, address])

  if (count === 0) return null

  return (
    <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-critical text-white rounded-full">
      {count > 9 ? '9+' : count}
    </span>
  )
}
