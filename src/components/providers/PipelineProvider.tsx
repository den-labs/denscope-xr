'use client'

import { useEffect, useRef } from 'react'
import { chains } from '@/config/chains'
import { startPipeline, type PipelineHandle } from '@/lib/pipeline/ingest'

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const handles: PipelineHandle[] = []
    for (const chain of chains) {
      startPipeline(chain).then((handle) => handles.push(handle))
        .catch((err) => console.error(`Pipeline failed for ${chain.name}:`, err))
    }
    return () => { for (const h of handles) h.stop() }
  }, [])

  return <>{children}</>
}
