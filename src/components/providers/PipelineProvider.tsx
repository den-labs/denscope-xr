'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { fetchHistoricalEvents, subscribeToEvents } from '@/lib/supabase/fetch-events'
import { seedDiscoveryFromDB } from '@/lib/discovery/engine'
import { chains } from '@/config/chains'
import { startPipeline, type PipelineHandle } from '@/lib/pipeline/ingest'

function shouldRunPipelineForPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === '/' || pathname.startsWith('/discovery') || pathname.startsWith('/graph')
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bootstrappedHistory = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
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

  // Realtime subscription — lives for the lifetime of the provider,
  // independent of pathname changes. Events arriving while the user
  // navigates to /agent/* or /console are still captured.
  useEffect(() => {
    if (!supabase) return

    if (!unsubscribeRef.current) {
      unsubscribeRef.current = subscribeToEvents()
    }

    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [])

  // Bootstrap: historical fetch + discovery seeding (once per session)
  useEffect(() => {
    if (!shouldRunPipelineForPath(pathname) || !isVisible) return
    if (bootstrappedHistory.current) return

    let cancelled = false

    if (supabase) {
      // Seed discovery counts from DB before processing events
      // so first_blood doesn't fire for agents with existing feedback
      seedDiscoveryFromDB()
        .then(() => fetchHistoricalEvents())
        .then((count) => {
          if (cancelled) return
          bootstrappedHistory.current = true
          console.log(`Loaded ${count} historical events from Supabase`)
        })
        .catch((err) => {
          if (cancelled) return
          console.error('Supabase bootstrap failed:', err)
          bootstrappedHistory.current = true
        })
    } else {
      // Fallback: direct RPC pipeline (no Supabase)
      const handles: PipelineHandle[] = []
      for (const chain of chains) {
        startPipeline(chain).then((handle) => {
          if (cancelled) {
            handle.stop()
            return
          }
          handles.push(handle)
        })
          .catch((err) => console.error(`Pipeline failed for ${chain.name}:`, err))
      }
      return () => {
        cancelled = true
        for (const h of handles) h.stop()
      }
    }

    return () => { cancelled = true }
  }, [pathname, isVisible])

  return <>{children}</>
}
