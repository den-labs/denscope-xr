'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { fetchHistoricalEvents, subscribeToEvents } from '@/lib/supabase/fetch-events'
import { chains } from '@/config/chains'
import { startPipeline, type PipelineHandle } from '@/lib/pipeline/ingest'

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (supabase) {
      // Supabase mode: fetch historical + subscribe to realtime
      let unsubscribe: (() => void) | null = null
      fetchHistoricalEvents()
        .then((count) => {
          console.log(`Loaded ${count} historical events from Supabase`)
          unsubscribe = subscribeToEvents()
        })
        .catch((err) => console.error('Supabase fetch failed:', err))

      return () => { unsubscribe?.() }
    } else {
      // Fallback: direct RPC pipeline (no Supabase)
      const handles: PipelineHandle[] = []
      for (const chain of chains) {
        startPipeline(chain).then((handle) => handles.push(handle))
          .catch((err) => console.error(`Pipeline failed for ${chain.name}:`, err))
      }
      return () => { for (const h of handles) h.stop() }
    }
  }, [])

  return <>{children}</>
}
