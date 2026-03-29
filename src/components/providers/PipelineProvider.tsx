'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { fetchHistoricalEvents, subscribeToEvents } from '@/lib/supabase/fetch-events'
import { seedDiscoveryFromDB } from '@/lib/discovery/engine'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useGraphStore } from '@/stores/graph'
import { chains } from '@/config/chains'
import { startPipeline, type PipelineHandle } from '@/lib/pipeline/ingest'

function shouldRunPipelineForPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === '/' || pathname.startsWith('/discovery') || pathname.startsWith('/graph')
}

function getChainIdFromURL(): number | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const v = params.get('chain')
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clearAllStores() {
  useEventStore.getState().clear()
  useAgentStore.getState().clear()
  useGraphStore.getState().clear()
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const activeChainRef = useRef<number | null | undefined>(undefined)
  const bootstrappingRef = useRef(false)
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState !== 'hidden'
  })

  useEffect(() => {
    function handleVisibilityChange() {
      setIsVisible(document.visibilityState !== 'hidden')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Poll URL for chain changes (useFeedFilters uses URL as source of truth)
  const [activeChainId, setActiveChainId] = useState<number | null>(getChainIdFromURL)

  useEffect(() => {
    function syncChain() {
      const current = getChainIdFromURL()
      setActiveChainId((prev) => {
        if (prev === current) return prev
        return current
      })
    }

    // Listen for popstate (back/forward) and custom URL changes
    window.addEventListener('popstate', syncChain)

    // Poll for replaceState changes (useFeedFilters uses replaceState)
    const interval = window.setInterval(syncChain, 300)

    return () => {
      window.removeEventListener('popstate', syncChain)
      window.clearInterval(interval)
    }
  }, [])

  // Core pipeline effect: reacts to chain changes
  useEffect(() => {
    if (!shouldRunPipelineForPath(pathname) || !isVisible) return

    // Skip if chain hasn't actually changed (undefined = first run)
    if (activeChainRef.current !== undefined && activeChainRef.current === activeChainId) return
    if (bootstrappingRef.current) return

    const chainId = activeChainId
    activeChainRef.current = chainId
    bootstrappingRef.current = true

    // Tear down previous subscription
    unsubscribeRef.current?.()
    unsubscribeRef.current = null

    // Clear stores for fresh chain data
    clearAllStores()

    if (supabase) {
      // Subscribe to realtime for the selected chain
      unsubscribeRef.current = subscribeToEvents(chainId)

      // Fetch historical events for the selected chain
      seedDiscoveryFromDB()
        .then(() => fetchHistoricalEvents(chainId))
        .then((count) => {
          bootstrappingRef.current = false
          console.log(`Loaded ${count} events${chainId != null ? ` for chain ${chainId}` : ' (all chains)'}`)
        })
        .catch((err) => {
          bootstrappingRef.current = false
          console.error('Supabase bootstrap failed:', err)
        })
    } else {
      // Fallback: direct RPC pipeline (no Supabase)
      const handles: PipelineHandle[] = []
      const targetChains = chainId != null
        ? chains.filter((c) => c.id === chainId)
        : chains
      for (const chain of targetChains) {
        startPipeline(chain).then((handle) => {
          handles.push(handle)
        })
          .catch((err) => console.error(`Pipeline failed for ${chain.name}:`, err))
      }
      bootstrappingRef.current = false
      return () => {
        for (const h of handles) h.stop()
      }
    }

    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [pathname, isVisible, activeChainId])

  return <>{children}</>
}
