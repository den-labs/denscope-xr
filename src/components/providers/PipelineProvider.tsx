'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { fetchHistoricalEvents, subscribeToEvents } from '@/lib/supabase/fetch-events'
import { chains } from '@/config/chains'
import { startPipeline, type PipelineHandle } from '@/lib/pipeline/ingest'

function shouldRunPipelineForPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === '/' || pathname.startsWith('/discovery') || pathname.startsWith('/graph')
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bootstrappedHistory = useRef(false)

  useEffect(() => {
    if (!shouldRunPipelineForPath(pathname)) return

    let cancelled = false

    if (supabase) {
      // Supabase mode: fetch historical + subscribe to realtime
      let unsubscribe: (() => void) | null = null
      const startRealtime = () => {
        if (cancelled) return
        unsubscribe = subscribeToEvents()
      }

      if (!bootstrappedHistory.current) {
        fetchHistoricalEvents()
          .then((count) => {
            if (cancelled) return
            bootstrappedHistory.current = true
            console.log(`Loaded ${count} historical events from Supabase`)
            startRealtime()
          })
          .catch((err) => {
            if (cancelled) return
            console.error('Supabase fetch failed:', err)
            // Still try realtime even if historical fetch fails.
            startRealtime()
          })
      } else {
        startRealtime()
      }

      return () => {
        cancelled = true
        unsubscribe?.()
      }
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
  }, [pathname])

  return <>{children}</>
}
